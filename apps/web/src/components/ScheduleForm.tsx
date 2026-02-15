import { useState, useEffect } from "react";

interface ScheduledJob {
  id: string;
  name: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
  platform: string;
  channelId: string;
  enabled: boolean;
}

interface Props {
  job: ScheduledJob | null;
  onSave: () => void;
  onCancel: () => void;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ScheduleForm({ job, onSave, onCancel }: Props) {
  const [name, setName] = useState(job?.name || "");
  const [prompt, setPrompt] = useState(job?.prompt || "");
  const [platform, setPlatform] = useState<"telegram" | "web">((job?.platform as "telegram" | "web") || "telegram");
  const [channelId, setChannelId] = useState(job?.channelId || "");
  const [timezone, setTimezone] = useState(job?.timezone || "Europe/Berlin");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Visual picker state
  const [scheduleType, setScheduleType] = useState<"daily" | "hourly" | "weekly" | "custom">("daily");
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [hourInterval, setHourInterval] = useState(6);
  const [customCron, setCustomCron] = useState("0 9 * * *");

  // Parse existing cron into visual picker
  useEffect(() => {
    if (!job?.cronExpression) return;
    const cron = job.cronExpression;
    const parts = cron.split(" ");
    if (parts.length !== 5) {
      setScheduleType("custom");
      setCustomCron(cron);
      return;
    }
    const [m, h, dom, mon, dow] = parts;

    if (dom === "*" && mon === "*" && dow === "*" && !h.includes("/") && !h.includes("*")) {
      // Daily: "M H * * *"
      setScheduleType("daily");
      setMinute(parseInt(m) || 0);
      setHour(parseInt(h) || 9);
    } else if (m === "0" && h.startsWith("*/")) {
      // Hourly: "0 */N * * *"
      setScheduleType("hourly");
      setHourInterval(parseInt(h.slice(2)) || 6);
    } else if (dom === "*" && mon === "*" && dow.match(/^\d$/) && !h.includes("/")) {
      // Weekly: "M H * * D"
      setScheduleType("weekly");
      setMinute(parseInt(m) || 0);
      setHour(parseInt(h) || 9);
      setDayOfWeek(parseInt(dow) || 0);
    } else {
      setScheduleType("custom");
      setCustomCron(cron);
    }
  }, [job]);

  const generateCron = (): string => {
    switch (scheduleType) {
      case "daily":
        return `${minute} ${hour} * * *`;
      case "hourly":
        return `0 */${hourInterval} * * *`;
      case "weekly":
        return `${minute} ${hour} * * ${dayOfWeek}`;
      case "custom":
        return customCron;
    }
  };

  const describeCron = (cron: string): string => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const cronExpression = generateCron();

    try {
      const url = job ? `/api/jobs/${job.id}` : "/api/jobs";
      const method = job ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          prompt,
          cronExpression,
          timezone,
          platform,
          channelId,
          enabled: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-5">
            {job ? "Edit Schedule" : "New Schedule"}
          </h3>

          {error && (
            <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Daily morning briefing"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
              />
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                placeholder="e.g. Summarize my calendar for today and list open tasks"
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Schedule Type */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Schedule</label>
              <div className="flex gap-1.5 mb-3">
                {(["daily", "hourly", "weekly", "custom"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setScheduleType(type)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      scheduleType === type
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>

              {/* Daily */}
              {scheduleType === "daily" && (
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 flex items-center gap-3">
                  <span className="text-sm text-gray-400">Every day at</span>
                  <select
                    value={hour}
                    onChange={(e) => setHour(parseInt(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-gray-100"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i.toString().padStart(2, "0")}</option>
                    ))}
                  </select>
                  <span className="text-gray-500">:</span>
                  <select
                    value={minute}
                    onChange={(e) => setMinute(parseInt(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-gray-100"
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i}>{i.toString().padStart(2, "0")}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Hourly */}
              {scheduleType === "hourly" && (
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 flex items-center gap-3">
                  <span className="text-sm text-gray-400">Every</span>
                  <select
                    value={hourInterval}
                    onChange={(e) => setHourInterval(parseInt(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-gray-100"
                  >
                    {[1, 2, 3, 4, 6, 8, 12].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-400">hours</span>
                </div>
              )}

              {/* Weekly */}
              {scheduleType === "weekly" && (
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-gray-400">Every</span>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-gray-100"
                  >
                    {DAYS.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-400">at</span>
                  <select
                    value={hour}
                    onChange={(e) => setHour(parseInt(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-gray-100"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i.toString().padStart(2, "0")}</option>
                    ))}
                  </select>
                  <span className="text-gray-500">:</span>
                  <select
                    value={minute}
                    onChange={(e) => setMinute(parseInt(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-gray-100"
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i}>{i.toString().padStart(2, "0")}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Custom */}
              {scheduleType === "custom" && (
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                  <input
                    type="text"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="0 9 * * *"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Format: minute hour day month weekday —{" "}
                    <a
                      href="https://crontab.guru"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      crontab.guru
                    </a>
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-2">
                {describeCron(generateCron())} — <code className="text-blue-400/80 font-mono">{generateCron()}</code>
              </p>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            {/* Deliver to */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Deliver to</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="telegram"
                    checked={platform === "telegram"}
                    onChange={() => setPlatform("telegram")}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-gray-300">Telegram</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="web"
                    checked={platform === "web"}
                    onChange={() => setPlatform("web")}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-gray-300">Web UI</span>
                </label>
              </div>
            </div>

            {/* Channel ID */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Channel ID</label>
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                required
                placeholder={platform === "telegram" ? "Telegram chat ID (e.g. 123456789)" : "Web channel ID"}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
              />
              {platform === "telegram" && (
                <p className="text-xs text-gray-500 mt-1">
                  Send /start to @userinfobot on Telegram to get your chat ID
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? "Saving..." : job ? "Update Schedule" : "Create Schedule"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors border border-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
