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

export function ScheduleForm({ job, onSave, onCancel }: Props) {
  const [name, setName] = useState(job?.name || "");
  const [prompt, setPrompt] = useState(job?.prompt || "");
  const [platform, setPlatform] = useState<"telegram" | "web">((job?.platform as "telegram" | "web") || "telegram");
  const [channelId, setChannelId] = useState(job?.channelId || "");
  const [timezone, setTimezone] = useState(job?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scheduleType, setScheduleType] = useState<"daily" | "hourly" | "weekly" | "custom">("daily");
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [hourInterval, setHourInterval] = useState(6);
  const [customCron, setCustomCron] = useState("");

  useEffect(() => {
    if (job?.cronExpression) {
      const cron = job.cronExpression;
      const parts = cron.split(" ");
      if (parts.length === 5) {
        if (cron.match(/^\d+ \d+ \* \* \*$/)) {
          setScheduleType("daily");
          setMinute(parseInt(parts[0]));
          setHour(parseInt(parts[1]));
        } else if (cron.match(/^0 \*\/\d+ \* \* \*$/)) {
          setScheduleType("hourly");
          const match = cron.match(/\*\/(\d+)/);
          if (match) setHourInterval(parseInt(match[1]));
        } else if (cron.match(/^\d+ \d+ \* \* \d$/)) {
          setScheduleType("weekly");
          setMinute(parseInt(parts[0]));
          setHour(parseInt(parts[1]));
          setDayOfWeek(parseInt(parts[4]));
        } else {
          setScheduleType("custom");
          setCustomCron(cron);
        }
      } else {
        setScheduleType("custom");
        setCustomCron(cron);
      }
    }
  }, [job]);

  const generateCron = (): string => {
    switch (scheduleType) {
      case "daily": return `${minute} ${hour} * * *`;
      case "hourly": return `0 */${hourInterval} * * *`;
      case "weekly": return `${minute} ${hour} * * ${dayOfWeek}`;
      case "custom": return customCron;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

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
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-200 mb-5">
          {job ? "Edit Schedule" : "New Schedule"}
        </h3>

        {error && (
          <div className="mb-4 px-4 py-2 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">
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
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
            />
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              placeholder="e.g. Summarize the latest tech news and send me the top 5 headlines"
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none"
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
                  className={`px-3.5 py-1.5 text-sm rounded-lg transition-colors ${
                    scheduleType === type
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750"
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {scheduleType === "daily" && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex items-center gap-3">
                <span className="text-sm text-gray-400">Every day at</span>
                <input
                  type="number" min={0} max={23} value={hour}
                  onChange={(e) => setHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-14 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-center text-gray-100"
                />
                <span className="text-gray-500">:</span>
                <input
                  type="number" min={0} max={59} value={minute}
                  onChange={(e) => setMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-14 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-center text-gray-100"
                />
              </div>
            )}

            {scheduleType === "hourly" && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex items-center gap-3">
                <span className="text-sm text-gray-400">Every</span>
                <input
                  type="number" min={1} max={23} value={hourInterval}
                  onChange={(e) => setHourInterval(Math.min(23, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-14 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-center text-gray-100"
                />
                <span className="text-sm text-gray-400">hours</span>
              </div>
            )}

            {scheduleType === "weekly" && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-400">Every</span>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                  className="bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-gray-100"
                >
                  {days.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-400">at</span>
                <input
                  type="number" min={0} max={23} value={hour}
                  onChange={(e) => setHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-14 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-center text-gray-100"
                />
                <span className="text-gray-500">:</span>
                <input
                  type="number" min={0} max={59} value={minute}
                  onChange={(e) => setMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-14 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-center text-gray-100"
                />
              </div>
            )}

            {scheduleType === "custom" && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <input
                  type="text"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="0 9 * * *"
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Format: minute hour day month weekday —{" "}
                  <a href="https://crontab.guru" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    crontab.guru
                  </a>
                </p>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-2">
              Cron: <code className="text-blue-400 font-mono">{generateCron()}</code>
            </p>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Timezone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
            />
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Deliver to</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio" value="telegram"
                  checked={platform === "telegram"}
                  onChange={() => setPlatform("telegram")}
                  className="text-blue-500"
                />
                <span className="text-sm text-gray-300">Telegram</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio" value="web"
                  checked={platform === "web"}
                  onChange={() => setPlatform("web")}
                  className="text-blue-500"
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
              placeholder={platform === "telegram" ? "Telegram chat ID" : "Web channel ID"}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              {platform === "telegram"
                ? "Your Telegram chat ID (get it from @userinfobot)"
                : "Web session channel ID"}
            </p>
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
  );
}
