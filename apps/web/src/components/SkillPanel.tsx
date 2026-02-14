import { useState, useEffect } from "react";

interface SkillInfo {
  name: string;
  displayName: string;
  description: string;
  type: string;
  version: string;
  generated: boolean;
  enabled: boolean;
  tools: Array<{ name: string; description: string }>;
}

interface SkillPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SkillPanel({ isOpen, onClose }: SkillPanelProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch("/api/skills")
        .then((r) => r.json())
        .then((data) => setSkills(data.skills || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-gray-900 border-l border-gray-800 shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold">Skills</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 transition-colors"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <p className="text-gray-500">Loading skills...</p>
        ) : skills.length === 0 ? (
          <p className="text-gray-500">No skills loaded</p>
        ) : (
          skills.map((skill) => (
            <div key={skill.name} className="bg-gray-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{skill.displayName}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    skill.type === "connector"
                      ? "bg-purple-900 text-purple-300"
                      : "bg-green-900 text-green-300"
                  }`}
                >
                  {skill.type}
                </span>
                {skill.generated && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900 text-yellow-300">
                    AI
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400">{skill.description}</p>
              {skill.tools.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Tools
                  </p>
                  {skill.tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="text-xs bg-gray-700 rounded px-2 py-1"
                    >
                      <span className="text-blue-400 font-mono">{tool.name}</span>
                      <span className="text-gray-500 ml-2">{tool.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
