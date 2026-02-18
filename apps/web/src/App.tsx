import { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { ChatWindow } from "./components/ChatWindow";
import { SkillPanel } from "./components/SkillPanel";
import { RequestsPage } from "./pages/RequestsPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { SchedulesPage } from "./pages/SchedulesPage";

interface HealthChecks {
  claude: boolean;
  telegram: boolean;
}

export default function App() {
  const [skillPanelOpen, setSkillPanelOpen] = useState(false);
  const [checks, setChecks] = useState<HealthChecks | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const location = useLocation();

  useEffect(() => {
    fetch("/health")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setChecks(data.checks ?? null))
      .catch(() => {});
  }, []);

  const dismiss = (key: string) =>
    setDismissed((prev) => new Set(prev).add(key));

  const showClaudeWarning = checks && !checks.claude && !dismissed.has("claude");
  const showTelegramWarning = checks && !checks.telegram && !dismissed.has("telegram");

  return (
    <div className="relative h-screen">
      {/* Status warnings */}
      {(showClaudeWarning || showTelegramWarning) && (
        <div className="fixed top-0 left-0 right-0 z-50 flex flex-col">
          {showClaudeWarning && (
            <div className="flex items-center justify-between px-4 py-2 bg-amber-900/90 border-b border-amber-700 text-amber-200 text-sm">
              <span>
                Claude CLI is not authenticated. Run{" "}
                <code className="bg-amber-800 px-1 rounded">docker exec -it ai-assistant claude login</code>{" "}
                to enable AI responses.
              </span>
              <button onClick={() => dismiss("claude")} className="ml-4 text-amber-400 hover:text-amber-200">
                Dismiss
              </button>
            </div>
          )}
          {showTelegramWarning && (
            <div className="flex items-center justify-between px-4 py-1.5 bg-gray-800/90 border-b border-gray-700 text-gray-400 text-xs">
              <span>Telegram bot token not configured — Telegram connector is inactive.</span>
              <button onClick={() => dismiss("telegram")} className="ml-4 text-gray-500 hover:text-gray-300">
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gray-900/80 backdrop-blur border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-gray-300">AI Assistant</h1>
          <nav className="flex gap-1">
            <Link
              to="/"
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                location.pathname === "/"
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              Chat
            </Link>
            <Link
              to="/requests"
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                location.pathname === "/requests"
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              Requests
            </Link>
            <Link
              to="/knowledge"
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                location.pathname === "/knowledge"
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              Knowledge
            </Link>
            <Link
              to="/schedules"
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                location.pathname === "/schedules"
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              Schedules
            </Link>
          </nav>
        </div>
        <button
          onClick={() => setSkillPanelOpen(!skillPanelOpen)}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-3 py-1 rounded-md hover:bg-gray-800"
        >
          Skills
        </button>
      </div>

      {/* Main content with top padding for header */}
      <div className="pt-10 h-full">
        {/* ChatWindow is always mounted to preserve state (messages, stream, channelId) across navigation */}
        <div className={location.pathname === "/" ? "h-full" : "hidden"}>
          <ChatWindow />
        </div>
        <Routes>
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
        </Routes>
      </div>

      {/* Skills panel overlay */}
      <SkillPanel isOpen={skillPanelOpen} onClose={() => setSkillPanelOpen(false)} />
    </div>
  );
}
