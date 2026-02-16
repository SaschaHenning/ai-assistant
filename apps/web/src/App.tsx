import { useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { ChatWindow } from "./components/ChatWindow";
import { SkillPanel } from "./components/SkillPanel";
import { LogsPage } from "./pages/LogsPage";
import { MemoryPage } from "./pages/MemoryPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { ActivePage } from "./pages/ActivePage";

export default function App() {
  const [skillPanelOpen, setSkillPanelOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="relative h-screen">
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
              to="/logs"
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                location.pathname === "/logs"
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              Logs
            </Link>
            <Link
              to="/memory"
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                location.pathname === "/memory"
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              Memory
            </Link>
            <Link
              to="/active"
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                location.pathname === "/active"
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              Active
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
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/active" element={<ActivePage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
        </Routes>
      </div>

      {/* Skills panel overlay */}
      <SkillPanel isOpen={skillPanelOpen} onClose={() => setSkillPanelOpen(false)} />
    </div>
  );
}
