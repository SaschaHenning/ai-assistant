import { useState, useEffect, useCallback } from "react";

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/knowledge");
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      console.error("Failed to fetch knowledge entries:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(true);
  }, [fetchEntries]);

  const createEntry = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() }),
      });
      setNewTitle("");
      setNewContent("");
      setCreating(false);
      await fetchEntries();
    } catch (err) {
      console.error("Failed to create entry:", err);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry: KnowledgeEntry) => {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditContent(entry.content);
    setExpandedId(entry.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/knowledge/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), content: editContent.trim() }),
      });
      setEditingId(null);
      setEditTitle("");
      setEditContent("");
      await fetchEntries();
    } catch (err) {
      console.error("Failed to save entry:", err);
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
      if (expandedId === id) setExpandedId(null);
      if (editingId === id) cancelEdit();
      await fetchEntries();
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  const toggleEnabled = async (entry: KnowledgeEntry) => {
    try {
      await fetch(`/api/knowledge/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !entry.enabled }),
      });
      await fetchEntries();
    } catch (err) {
      console.error("Failed to toggle entry:", err);
    }
  };

  const moveEntry = async (index: number, direction: "up" | "down") => {
    const newEntries = [...entries];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newEntries.length) return;
    [newEntries[index], newEntries[swapIndex]] = [newEntries[swapIndex], newEntries[index]];
    setEntries(newEntries);
    try {
      await fetch("/api/knowledge/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: newEntries.map((e) => e.id) }),
      });
    } catch (err) {
      console.error("Failed to reorder:", err);
      await fetchEntries();
    }
  };

  const toggleExpand = (id: string) => {
    if (editingId === id) return;
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-200">Knowledge</h2>
            <p className="text-sm text-gray-500 mt-1">
              Custom instructions that apply to every conversation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                + New Entry
              </button>
            )}
          </div>
        </div>

        {/* Create form */}
        {creating && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-200 mb-3">New Entry</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Entry title"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Content</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Markdown content..."
                  rows={6}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setCreating(false);
                    setNewTitle("");
                    setNewContent("");
                  }}
                  className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createEntry}
                  disabled={!newTitle.trim() || saving}
                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Entry list */}
        {loading ? (
          <p className="text-gray-500 text-center py-12">Loading...</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-base mb-1">No knowledge entries yet</p>
            <p className="text-sm">
              Add custom instructions that Claude will follow in every conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, index) => {
              const isExpanded = expandedId === entry.id;
              const isEditing = editingId === entry.id;

              return (
                <div
                  key={entry.id}
                  className={`bg-gray-800/50 border rounded-xl overflow-hidden transition-colors ${
                    entry.enabled ? "border-gray-700" : "border-gray-800 opacity-60"
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Reorder buttons */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => moveEntry(index, "up")}
                          disabled={index === 0}
                          className="text-xs px-1 py-0.5 text-gray-500 hover:text-gray-200 disabled:text-gray-700 disabled:cursor-not-allowed rounded transition-colors"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveEntry(index, "down")}
                          disabled={index === entries.length - 1}
                          className="text-xs px-1 py-0.5 text-gray-500 hover:text-gray-200 disabled:text-gray-700 disabled:cursor-not-allowed rounded transition-colors"
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>

                      {isEditing ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span
                          className="text-sm font-medium text-gray-200 truncate cursor-pointer"
                          onClick={() => toggleExpand(entry.id)}
                        >
                          {entry.title}
                        </span>
                      )}
                    </div>

                    {/* Toggle switch */}
                    <button
                      onClick={() => toggleEnabled(entry)}
                      className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                        entry.enabled ? "bg-blue-600" : "bg-gray-600"
                      }`}
                      title={entry.enabled ? "Enabled" : "Disabled"}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          entry.enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Content area */}
                  {isEditing ? (
                    <div className="p-4">
                      <label className="block text-xs text-gray-400 mb-1">Content</label>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                        rows={Math.max(8, editContent.split("\n").length + 2)}
                      />
                      <div className="flex justify-end gap-2 mt-3">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(entry.id)}
                          disabled={!editTitle.trim() || saving}
                          className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer"
                      onClick={() => toggleExpand(entry.id)}
                    >
                      {isExpanded ? (
                        <div className="p-4">
                          <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap overflow-x-auto">
                            {entry.content || "(empty)"}
                          </pre>
                          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700/50">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(entry);
                              }}
                              className="text-xs px-3 py-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-md transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteEntry(entry.id, entry.title);
                              }}
                              className="text-xs px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative px-4 py-3">
                          <pre className="text-sm text-gray-400 font-mono whitespace-pre-wrap line-clamp-3 overflow-hidden">
                            {entry.content || "(empty)"}
                          </pre>
                          {entry.content && entry.content.split("\n").length > 3 && (
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-800/80 to-transparent pointer-events-none" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
