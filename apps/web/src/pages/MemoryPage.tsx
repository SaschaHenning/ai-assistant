import { useState, useEffect } from "react";

interface MemoryFile {
  name: string;
  content: string;
}

export function MemoryPage() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memory");
      const data = await res.json();
      setFiles(data.files);
    } catch (err) {
      console.error("Failed to fetch memory files:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const startEdit = (file: MemoryFile) => {
    setEditingFile(file.name);
    setEditContent(file.content);
  };

  const cancelEdit = () => {
    setEditingFile(null);
    setEditContent("");
  };

  const saveFile = async (name: string) => {
    setSaving(true);
    try {
      await fetch(`/api/memory/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      setEditingFile(null);
      setEditContent("");
      await fetchFiles();
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const deleteFile = async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await fetch(`/api/memory/${name}`, { method: "DELETE" });
      await fetchFiles();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const createFile = async () => {
    const name = newFileName.endsWith(".md") ? newFileName : newFileName + ".md";
    if (!name || name === ".md") return;
    setSaving(true);
    try {
      await fetch(`/api/memory/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" }),
      });
      setNewFileName("");
      await fetchFiles();
      setEditingFile(name);
      setEditContent("");
    } catch (err) {
      console.error("Failed to create:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-200">Memory</h2>
            <p className="text-sm text-gray-500 mt-1">
              Persistent knowledge that Claude remembers across sessions
            </p>
          </div>
          <span className="text-sm text-gray-500">{files.length} files</span>
        </div>

        {/* Create new file */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createFile()}
            placeholder="New file name (e.g. preferences.md)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={createFile}
            disabled={!newFileName.trim() || saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            Create
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No memory files yet</p>
            <p className="text-sm">
              Create MEMORY.md to add persistent knowledge that Claude will
              remember across sessions.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {files.map((file) => (
              <div
                key={file.name}
                className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800/80">
                  <span className="text-sm font-mono text-blue-400">
                    {file.name}
                  </span>
                  <div className="flex gap-2">
                    {editingFile === file.name ? (
                      <>
                        <button
                          onClick={() => saveFile(file.name)}
                          disabled={saving}
                          className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(file)}
                          className="text-xs px-3 py-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteFile(file.name)}
                          className="text-xs px-3 py-1 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editingFile === file.name ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-gray-900 text-gray-200 text-sm font-mono p-4 focus:outline-none resize-y min-h-[200px]"
                    rows={Math.max(10, editContent.split("\n").length + 2)}
                  />
                ) : (
                  <pre className="text-sm text-gray-300 font-mono p-4 whitespace-pre-wrap overflow-x-auto max-h-[400px] overflow-y-auto">
                    {file.content || "(empty)"}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
