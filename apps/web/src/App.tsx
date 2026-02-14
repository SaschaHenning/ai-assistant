import { useState } from "react";
import { ChatWindow } from "./components/ChatWindow";
import { SkillPanel } from "./components/SkillPanel";

export default function App() {
  const [skillPanelOpen, setSkillPanelOpen] = useState(false);

  return (
    <div className="relative h-screen">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gray-900/80 backdrop-blur border-b border-gray-800">
        <h1 className="text-sm font-semibold text-gray-300">AI Assistant</h1>
        <button
          onClick={() => setSkillPanelOpen(!skillPanelOpen)}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-3 py-1 rounded-md hover:bg-gray-800"
        >
          Skills
        </button>
      </div>

      {/* Main chat area with top padding for header */}
      <div className="pt-10 h-full">
        <ChatWindow />
      </div>

      {/* Skills panel overlay */}
      <SkillPanel isOpen={skillPanelOpen} onClose={() => setSkillPanelOpen(false)} />
    </div>
  );
}
