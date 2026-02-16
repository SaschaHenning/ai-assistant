import { Hono } from "hono";
import { randomUUID } from "crypto";
import { eq, asc, schema, type AppDatabase } from "@ai-assistant/db";

export function createKnowledgeRoutes(db: AppDatabase) {
  const app = new Hono();

  // List all knowledge entries
  app.get("/", async (c) => {
    const entries = await db.query.knowledge.findMany({
      orderBy: [asc(schema.knowledge.sortOrder), asc(schema.knowledge.createdAt)],
    });
    return c.json({ entries });
  });

  // Create a new knowledge entry
  app.post("/", async (c) => {
    const body = await c.req.json<{
      title: string;
      content: string;
      enabled?: boolean;
      sortOrder?: number;
    }>();

    if (!body.title || !body.content) {
      return c.json({ error: "Missing required fields: title, content" }, 400);
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(schema.knowledge).values({
      id,
      title: body.title,
      content: body.content,
      enabled: body.enabled ?? true,
      sortOrder: body.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    });

    const entry = await db.query.knowledge.findFirst({
      where: eq(schema.knowledge.id, id),
    });

    return c.json({ entry }, 201);
  });

  // Bulk reorder — MUST be before /:id to avoid param capture
  app.put("/reorder", async (c) => {
    const body = await c.req.json<{ ids: string[] }>();

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return c.json({ error: "ids must be a non-empty array" }, 400);
    }

    const now = new Date();
    for (let i = 0; i < body.ids.length; i++) {
      await db
        .update(schema.knowledge)
        .set({ sortOrder: i, updatedAt: now })
        .where(eq(schema.knowledge.id, body.ids[i]));
    }

    return c.json({ ok: true });
  });

  // Update a knowledge entry
  app.put("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{
      title?: string;
      content?: string;
      enabled?: boolean;
      sortOrder?: number;
    }>();

    const existing = await db.query.knowledge.findFirst({
      where: eq(schema.knowledge.id, id),
    });
    if (!existing) return c.json({ error: "Knowledge entry not found" }, 404);

    await db
      .update(schema.knowledge)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.knowledge.id, id));

    const updated = await db.query.knowledge.findFirst({
      where: eq(schema.knowledge.id, id),
    });

    return c.json({ entry: updated });
  });

  // Delete a knowledge entry
  app.delete("/:id", async (c) => {
    const id = c.req.param("id");

    const existing = await db.query.knowledge.findFirst({
      where: eq(schema.knowledge.id, id),
    });
    if (!existing) return c.json({ error: "Knowledge entry not found" }, 404);

    await db.delete(schema.knowledge).where(eq(schema.knowledge.id, id));

    return c.json({ ok: true });
  });

  return app;
}
