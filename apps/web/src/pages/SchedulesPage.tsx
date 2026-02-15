import { useState, useEffect } from "react";
import { ScheduleForm } from "../components/ScheduleForm";

interface ScheduledJob {
  id: string;
  name: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
  platform: string;
  channelId: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

export function SchedulesPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  const deleteJob = async (id: string, name: string) => {
    if (!confirm(`Delete schedule "${name}"?`)) return;
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    await fetchJobs();
  };

  const toggleEnabled = async (job: ScheduledJob) => {
    await fetch(`/api/jobs/${job.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !job.enabled }),
    });
    await fetchJobs();
  };

  const runNow = async (id: string, name: string) => {
    if (!confirm(`Run "${name}" now?`)) return;
    try {
      await fetch(`/api/jobs/${id}/run`, { method: "POST" });
      setTimeout(fetchJobs, 3000);
    } catch (err) {
      console.error("Failed to run:", err);
    }
  };

  const formatTime = (ts: string | number | null) => {
    if (!ts) return "\u2014";
    const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
    return d.toLocaleString();
  };

  const describeCron = (cron: string, tz: string): string => {
    const parts = cron.split(" ");
    if (parts.length !== 5) return cron;
    const [m, h, dom, mon, dow] = parts;

    if (dom === "*" && mon === "*" && dow === "*" && !h.includes("/") && !m.includes("/")) {
      return `Daily at ${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    }
    if (m === "0" && h.startsWith("*/")) {
      return `Every ${h.replace("*/", "")} hours`;
    }
    if (dom === "*" && mon === "*" && dow.match(/^\d$/)) {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `${days[parseInt(dow)]} at ${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    }
    return cron;
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-200">Scheduled Jobs</h2>
            <p className="text-sm text-gray-500 mt-1">
              Run prompts automatically on a schedule
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            + New Schedule
          </button>
        </div>

        {(creating || editingJob) && (
          <ScheduleForm
            job={editingJob}
            onSave={() => { setCreating(false); setEditingJob(null); fetchJobs(); }}
            onCancel={() => { setCreating(false); setEditingJob(null); }}
          />
        )}

        {loading ? (
          <p className="text-gray-500 text-center py-12">Loading...</p>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">🕐</div>
            <p className="text-base mb-1">No scheduled jobs yet</p>
            <p className="text-sm">Create a schedule to run prompts automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={`bg-gray-800/50 border rounded-xl p-4 transition-colors ${
                  job.enabled ? "border-gray-700" : "border-gray-800 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="text-sm font-medium text-gray-200 truncate">{job.name}</h3>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                        job.enabled
                          ? "bg-green-900/40 text-green-400 border border-green-800/50"
                          : "bg-gray-800 text-gray-500 border border-gray-700"
                      }`}>
                        {job.enabled ? "Active" : "Paused"}
                      </span>
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                        {job.platform === "telegram" ? "📱 Telegram" : "🌐 Web"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-1.5">
                      {describeCron(job.cronExpression, job.timezone)} · {job.timezone}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2">{job.prompt}</p>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => runNow(job.id, job.name)}
                      className="text-xs px-2.5 py-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-md transition-colors"
                      title="Run now">
                      ▶ Run
                    </button>
                    <button onClick={() => toggleEnabled(job)}
                      className="text-xs px-2.5 py-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-md transition-colors">
                      {job.enabled ? "Pause" : "Resume"}
                    </button>
                    <button onClick={() => setEditingJob(job)}
                      className="text-xs px-2.5 py-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-md transition-colors">
                      Edit
                    </button>
                    <button onClick={() => deleteJob(job.id, job.name)}
                      className="text-xs px-2.5 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-colors">
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-5 pt-3 mt-3 border-t border-gray-700/50 text-xs text-gray-500">
                  <span>Next: {formatTime(job.nextRunAt)}</span>
                  {job.lastRunAt && (
                    <>
                      <span>Last: {formatTime(job.lastRunAt)}</span>
                      {job.lastRunStatus === "success" && (
                        <span className="text-green-400">✓ Success</span>
                      )}
                      {job.lastRunStatus === "error" && (
                        <span className="text-red-400" title={job.lastRunError || ""}>
                          ✗ {job.lastRunError?.slice(0, 60) || "Error"}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
