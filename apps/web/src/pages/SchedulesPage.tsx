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
  updatedAt: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function describeCron(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const [m, h, dom, mon, dow] = parts;

  if (dom === "*" && mon === "*" && dow === "*" && !h.includes("/") && !h.includes("*")) {
    return `Daily at ${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  }
  if (m === "0" && h.startsWith("*/")) {
    return `Every ${h.slice(2)} hours`;
  }
  if (dom === "*" && mon === "*" && dow.match(/^\d$/) && !h.includes("/")) {
    return `Every ${DAYS[parseInt(dow)] || dow} at ${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  }
  return cron;
}

function formatTime(ts: string | null): string {
  if (!ts) return "\u2014";
  const d = new Date(typeof ts === "number" ? (ts as number) * 1000 : ts);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SchedulesPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchJobs = async () => {
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

  useEffect(() => {
    fetchJobs();
  }, []);

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

  const runNow = async (id: string) => {
    await fetch(`/api/jobs/${id}/run`, { method: "POST" });
    setTimeout(fetchJobs, 3000);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Scheduled Jobs</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Run prompts automatically on a recurring schedule
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            + New Schedule
          </button>
        </div>

        {/* Form Modal */}
        {(creating || editingJob) && (
          <ScheduleForm
            job={editingJob}
            onSave={async () => {
              setCreating(false);
              setEditingJob(null);
              await fetchJobs();
            }}
            onCancel={() => {
              setCreating(false);
              setEditingJob(null);
            }}
          />
        )}

        {/* Job List */}
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-1">No scheduled jobs yet</p>
            <p className="text-sm text-gray-500">
              Create a schedule to automatically run prompts at specific times
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={`border rounded-xl p-4 transition-colors ${
                  job.enabled
                    ? "bg-gray-800/40 border-gray-700"
                    : "bg-gray-900/40 border-gray-800 opacity-60"
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-gray-200 truncate">{job.name}</h3>
                      <span
                        className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${
                          job.enabled
                            ? "bg-green-900/50 text-green-400"
                            : "bg-gray-700/50 text-gray-500"
                        }`}
                      >
                        {job.enabled ? "Active" : "Paused"}
                      </span>
                      <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                        {job.platform === "telegram" ? "Telegram" : "Web"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-1.5">
                      {describeCron(job.cronExpression)} &middot; {job.timezone}
                    </p>
                    <p className="text-sm text-gray-500 line-clamp-2">{job.prompt}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => runNow(job.id)}
                      className="text-xs px-2.5 py-1 text-blue-400 hover:text-blue-300 hover:bg-gray-700/50 rounded-md transition-colors"
                      title="Run now"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => toggleEnabled(job)}
                      className="text-xs px-2.5 py-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-md transition-colors"
                    >
                      {job.enabled ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => setEditingJob(job)}
                      className="text-xs px-2.5 py-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-md transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteJob(job.id, job.name)}
                      className="text-xs px-2.5 py-1 text-red-400/70 hover:text-red-300 hover:bg-gray-700/50 rounded-md transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Status footer */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-700/50 text-xs text-gray-500">
                  {job.nextRunAt && (
                    <span>Next: {formatTime(job.nextRunAt)}</span>
                  )}
                  {job.lastRunAt && (
                    <>
                      <span>Last: {formatTime(job.lastRunAt)}</span>
                      <span
                        className={
                          job.lastRunStatus === "success"
                            ? "text-green-400/80"
                            : job.lastRunStatus === "error"
                              ? "text-red-400/80"
                              : ""
                        }
                      >
                        {job.lastRunStatus === "success" && "Success"}
                        {job.lastRunStatus === "error" &&
                          `Error: ${job.lastRunError?.slice(0, 60) || "Error"}`}
                      </span>
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
