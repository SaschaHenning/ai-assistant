import { Hono } from "hono";
import { readdir, readFile, writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const MEMORY_DIR = join(
  homedir(),
  ".claude/projects/-Users-sascha-Code-ai-automator/memory"
);

export function createMemoryRoutes() {
  const app = new Hono();

  // List all memory files with contents
  app.get("/", async (c) => {
    await mkdir(MEMORY_DIR, { recursive: true });
    const entries = await readdir(MEMORY_DIR);
    const files = await Promise.all(
      entries
        .filter((f) => f.endsWith(".md"))
        .map(async (name) => {
          const content = await readFile(join(MEMORY_DIR, name), "utf-8");
          return { name, content };
        })
    );
    return c.json({ files });
  });

  // Get a single memory file
  app.get("/:name", async (c) => {
    const name = c.req.param("name");
    try {
      const content = await readFile(join(MEMORY_DIR, name), "utf-8");
      return c.json({ name, content });
    } catch {
      return c.json({ error: "File not found" }, 404);
    }
  });

  // Create or update a memory file
  app.put("/:name", async (c) => {
    const name = c.req.param("name");
    if (!name.endsWith(".md")) {
      return c.json({ error: "File must end with .md" }, 400);
    }
    const body = await c.req.json<{ content: string }>();
    await mkdir(MEMORY_DIR, { recursive: true });
    await writeFile(join(MEMORY_DIR, name), body.content, "utf-8");
    return c.json({ ok: true, name });
  });

  // Delete a memory file
  app.delete("/:name", async (c) => {
    const name = c.req.param("name");
    try {
      await unlink(join(MEMORY_DIR, name));
      return c.json({ ok: true });
    } catch {
      return c.json({ error: "File not found" }, 404);
    }
  });

  return app;
}
