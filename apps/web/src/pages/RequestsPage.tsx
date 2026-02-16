import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DOMPurify from "dompurify";

// --- Active tasks types & helpers ---

interface TaskItem {
  id: string;
  channelId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  messagePreview?: string;
  platform?: string;
  userName?: string;
}

function Duration({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const start = new Date(since).getTime();
    const update = () => {
      const s = Math.floor((Date.now() - start) / 1000);
      if (s < 60) setElapsed(`${s}s`);
      else if (s < 3600) setElapsed(`${Math.floor(s / 60)}m ${s % 60}s`);
      else setElapsed(`${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [since]);

  return <span>{elapsed}</span>;
}

const statusConfig: Record<string, { label: string; classes: string; dot?: string }> = {
  running: {
    label: "Running",
    classes: "bg-blue-900/40 text-blue-400 border border-blue-800/50",
    dot: "bg-blue-400 animate-pulse",
  },
  queued: {
    label: "Queued",
    classes: "bg-yellow-900/40 text-yellow-400 border border-yellow-800/50",
  },
  completed: {
    label: "Completed",
    classes: "bg-green-900/40 text-green-400 border border-green-800/50",
  },
  failed: {
    label: "Failed",
    classes: "bg-red-900/40 text-red-400 border border-red-800/50",
  },
  cancelled: {
    label: "Cancelled",
    classes: "bg-gray-800 text-gray-400 border border-gray-700",
  },
};

const platformLabel = (p?: string) => {
  if (p === "telegram") return "Telegram";
  if (p === "web") return "Web";
  if (p === "api") return "API";
  return p || "Unknown";
};

// --- Logs types & helpers ---

interface RequestLog {
  id: string;
  platform: string;
  channelId: string;
  userId: string | null;
  userMessage: string;
  assistantReply: string;
  costUsd: number | null;
  claudeSessionId: string | null;
  model: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const formatTime = (ts: string) => {
  const d = new Date(typeof ts === "number" ? (ts as number) * 1000 : ts);
  return d.toLocaleString();
};

const truncate = (text: string, len = 80) =>
  text.length > len ? text.slice(0, len) + "..." : text;

const formatCost = (cost: number | null) =>
  cost != null ? `$${cost.toFixed(4)}` : "-";

const formatDuration = (ms: number | null) => {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// --- Combined page ---

export function RequestsPage() {
  // Active tasks state
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const hasActive = useRef(false);

  // Logs state
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [logsLoading, setLogsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // --- Active tasks fetching ---
  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      const items: TaskItem[] = data.tasks || [];
      setTasks(items);
      hasActive.current = items.some(
        (t) => t.status === "running" || t.status === "queued"
      );
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  };

  useEffect(() => {
    fetchTasks();
    // Re-fetch when tab becomes visible (user switching back to check)
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchTasks();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => {
      fetchTasks();
      timer = setTimeout(poll, hasActive.current ? 2000 : 3000);
    };
    timer = setTimeout(poll, 2000);
    return () => clearTimeout(timer);
  }, []);

  const cancelTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}/cancel`, { method: "POST" });
      await fetchTasks();
    } catch (err) {
      console.error("Failed to cancel task:", err);
    }
  };

  // --- Logs fetching ---
  const fetchLogs = async (page: number) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/logs?page=${page}&limit=50`);
      const data = await res.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  // --- Render ---

  // Sanitize HTML content from Telegram replies to prevent XSS
  const sanitize = (html: string) => DOMPurify.sanitize(html);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Active requests section */}
        {tasks.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-200 mb-3">Active</h2>
            <div className="space-y-3">
              {tasks.map((task) => {
                const cfg = statusConfig[task.status] || statusConfig.cancelled;
                return (
                  <div
                    key={task.id}
                    className={`bg-gray-800/50 border rounded-xl p-4 transition-colors ${
                      task.status === "running"
                        ? "border-blue-800/50"
                        : task.status === "queued"
                        ? "border-yellow-800/50"
                        : "border-gray-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <span
                            className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${cfg.classes}`}
                          >
                            <span className="flex items-center gap-1">
                              {cfg.dot && (
                                <span
                                  className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`}
                                />
                              )}
                              {cfg.label}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                            {platformLabel(task.platform)}
                          </span>
                          {task.userName && (
                            <span className="text-xs text-gray-500 truncate">
                              {task.userName}
                            </span>
                          )}
                        </div>
                        {task.messagePreview && (
                          <p className="text-sm text-gray-300 mt-1 line-clamp-2">
                            {task.messagePreview}
                          </p>
                        )}
                        {task.error && (
                          <p className="text-xs text-red-400 mt-1 line-clamp-2">
                            {task.error}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(task.status === "running" ||
                          task.status === "queued") && (
                          <button
                            onClick={() => cancelTask(task.id)}
                            className="text-xs px-2.5 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-5 pt-3 mt-3 border-t border-gray-700/50 text-xs text-gray-500">
                      {task.startedAt && (task.status === "running" || task.status === "queued") && (
                        <span className="text-blue-400">
                          <Duration since={task.startedAt} />
                        </span>
                      )}
                      {task.completedAt && (
                        <span>
                          Completed{" "}
                          {new Date(task.completedAt).toLocaleTimeString()}
                        </span>
                      )}
                      <span className="text-gray-600 font-mono text-[10px]">
                        {task.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Logs section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-200">History</h2>
            <span className="text-sm text-gray-500">{pagination.total} total</span>
          </div>

          {logsLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-gray-500">No request logs yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[140px]" />
                    <col className="w-[80px]" />
                    <col className="w-[140px]" />
                    <col />
                    <col />
                    <col className="w-[80px]" />
                    <col className="w-[80px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-800/50 text-gray-400 text-left">
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Platform</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium">Message</th>
                      <th className="px-3 py-2 font-medium">Reply</th>
                      <th className="px-3 py-2 font-medium text-right">Cost</th>
                      <th className="px-3 py-2 font-medium text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="cursor-pointer hover:bg-gray-800/30 transition-colors"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        <td className="px-3 py-2 text-gray-400 text-xs align-top">{formatTime(log.createdAt)}</td>
                        <td className="px-3 py-2 align-top">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                            log.platform === "telegram" ? "bg-blue-900/50 text-blue-300" :
                            log.platform === "web" ? "bg-green-900/50 text-green-300" :
                            "bg-gray-700 text-gray-300"
                          }`}>
                            {log.platform}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-400 text-xs truncate align-top">{log.model?.replace("claude-", "") || "-"}</td>
                        <td className="px-3 py-2 text-gray-200 truncate align-top">{truncate(log.userMessage)}</td>
                        <td className="px-3 py-2 text-gray-400 truncate align-top">{truncate(log.assistantReply)}</td>
                        <td className="px-3 py-2 text-gray-300 text-right align-top">{formatCost(log.costUsd)}</td>
                        <td className="px-3 py-2 text-gray-300 text-right align-top">{formatDuration(log.durationMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Expanded detail panel - content is sanitized via DOMPurify */}
              {expandedId && (() => {
                const log = logs.find((l) => l.id === expandedId);
                if (!log) return null;
                return (
                  <div className="mt-2 rounded-lg border border-gray-800 bg-gray-800/20 p-4 space-y-4">
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>Platform: {log.platform}</span>
                      <span>Model: {log.model || "-"}</span>
                      <span>User: {log.userId || "-"}</span>
                      <span>Cost: {formatCost(log.costUsd)}</span>
                      <span>Duration: {formatDuration(log.durationMs)}</span>
                      <span>Session: {log.claudeSessionId?.slice(0, 12) || "-"}...</span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">User Message</p>
                      <pre className="text-sm text-gray-200 whitespace-pre-wrap bg-gray-900 rounded p-3 max-h-60 overflow-y-auto">{log.userMessage}</pre>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Assistant Reply ({log.platform === "telegram" ? "HTML" : "Markdown"})</p>
                      {log.platform === "telegram" ? (
                        <div
                          className="text-sm bg-gray-900 rounded p-3 max-h-96 overflow-y-auto text-gray-300 [&_b]:font-bold [&_i]:italic [&_code]:text-blue-300 [&_code]:bg-gray-800 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-gray-800 [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:my-2"
                          dangerouslySetInnerHTML={{ __html: sanitize(log.assistantReply) }}
                        />
                      ) : (
                        <div className="text-sm bg-gray-900 rounded p-3 max-h-96 overflow-y-auto prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-code:text-blue-300 prose-pre:bg-gray-800 prose-pre:rounded-lg prose-a:text-blue-400">
                          <Markdown remarkPlugins={[remarkGfm]}>
                            {log.assistantReply}
                          </Markdown>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={() => fetchLogs(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1.5 text-sm rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => fetchLogs(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1.5 text-sm rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
