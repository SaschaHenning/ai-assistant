import { useState, useEffect, useRef } from "react";

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

export function ActivePage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const hasActive = useRef(false);

  const fetchTasks = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/tasks?includeRecent=true");
      const data = await res.json();
      const items: TaskItem[] = data.tasks || [];
      setTasks(items);
      hasActive.current = items.some(
        (t) => t.status === "running" || t.status === "queued"
      );
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks(true);
  }, []);

  useEffect(() => {
    const poll = () => {
      const interval = hasActive.current ? 2000 : 10000;
      return setInterval(() => fetchTasks(), interval);
    };
    let id = poll();
    // Re-create interval when hasActive changes by checking periodically
    const checker = setInterval(() => {
      clearInterval(id);
      id = poll();
    }, 5000);
    return () => {
      clearInterval(id);
      clearInterval(checker);
    };
  }, []);

  const cancelTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}/cancel`, { method: "POST" });
      await fetchTasks();
    } catch (err) {
      console.error("Failed to cancel task:", err);
    }
  };

  const platformLabel = (p?: string) => {
    if (p === "telegram") return "Telegram";
    if (p === "web") return "Web";
    if (p === "api") return "API";
    return p || "Unknown";
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-200">
            Active Requests
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Live view of running and recent tasks
          </p>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-12">Loading...</p>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">--</div>
            <p className="text-base mb-1">No active requests</p>
            <p className="text-sm">
              Tasks will appear here when messages are being processed.
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
