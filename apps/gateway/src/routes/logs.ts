import { Hono } from "hono";
import { desc, count, schema, type AppDatabase } from "@ai-assistant/db";

export function createLogRoutes(db: AppDatabase) {
  const app = new Hono();

  app.get("/", async (c) => {
    const page = Math.max(1, Number(c.req.query("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(c.req.query("limit")) || 50));
    const offset = (page - 1) * limit;

    const [logs, [{ total }]] = await Promise.all([
      db
        .select()
        .from(schema.requestLogs)
        .orderBy(desc(schema.requestLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(schema.requestLogs),
    ]);

    return c.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  return app;
}
