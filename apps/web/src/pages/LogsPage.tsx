import { useState, useEffect } from "react";

interface RequestLog {
  id: string;
  platform: string;
  channelId: string;
  userId: string | null;
  userMessage: string;
  assistantReply: string;
  costUsd: number | null;
  claudeSessionId: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function LogsPage() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs?page=${page}&limit=50`);
      const data = await res.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

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

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-200">Request Logs</h2>
          <span className="text-sm text-gray-500">{pagination.total} total requests</span>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-gray-500">No request logs yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/50 text-gray-400 text-left">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Platform</th>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Message</th>
                    <th className="px-3 py-2 font-medium">Reply</th>
                    <th className="px-3 py-2 font-medium text-right">Cost</th>
                    <th className="px-3 py-2 font-medium text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td
                        colSpan={7}
                        className="p-0"
                      >
                        <div
                          className="grid grid-cols-[140px_80px_100px_1fr_1fr_80px_80px] px-3 py-2 cursor-pointer hover:bg-gray-800/30 transition-colors items-start"
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        >
                          <span className="text-gray-400 text-xs">{formatTime(log.createdAt)}</span>
                          <span>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                              log.platform === "telegram" ? "bg-blue-900/50 text-blue-300" :
                              log.platform === "web" ? "bg-green-900/50 text-green-300" :
                              "bg-gray-700 text-gray-300"
                            }`}>
                              {log.platform}
                            </span>
                          </span>
                          <span className="text-gray-400 truncate">{log.userId || "-"}</span>
                          <span className="text-gray-200 truncate pr-2">{truncate(log.userMessage)}</span>
                          <span className="text-gray-400 truncate pr-2">{truncate(log.assistantReply)}</span>
                          <span className="text-gray-300 text-right">{formatCost(log.costUsd)}</span>
                          <span className="text-gray-300 text-right">{formatDuration(log.durationMs)}</span>
                        </div>
                        {expandedId === log.id && (
                          <div className="px-3 pb-3 space-y-3 bg-gray-800/20 border-t border-gray-800">
                            <div>
                              <p className="text-xs text-gray-500 mt-2 mb-1">User Message</p>
                              <pre className="text-sm text-gray-200 whitespace-pre-wrap bg-gray-900 rounded p-3 max-h-60 overflow-y-auto">{log.userMessage}</pre>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Assistant Reply</p>
                              <pre className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-900 rounded p-3 max-h-60 overflow-y-auto">{log.assistantReply}</pre>
                            </div>
                            <div className="flex gap-4 text-xs text-gray-500">
                              <span>Session: {log.claudeSessionId || "-"}</span>
                              <span>Channel: {log.channelId}</span>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
      </div>
    </div>
  );
}
