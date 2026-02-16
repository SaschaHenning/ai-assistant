import { Hono } from "hono";
import type { TaskQueue } from "../task-queue";

export function createTaskRoutes(taskQueue: TaskQueue) {
  const app = new Hono();

  app.get("/channel/:channelId", (c) => {
    const channelId = c.req.param("channelId");
    const active = taskQueue.getActiveTask(channelId);
    const queuedCount = taskQueue.getQueuedCount(channelId);

    return c.json({
      active: active
        ? {
            id: active.id,
            status: active.status,
            createdAt: active.createdAt,
            startedAt: active.startedAt,
          }
        : null,
      queuedCount,
    });
  });

  app.get("/:id", (c) => {
    const id = c.req.param("id");
    const task = taskQueue.getTask(id);
    if (!task) return c.json({ error: "Task not found" }, 404);

    return c.json({
      task: {
        id: task.id,
        channelId: task.channelId,
        status: task.status,
        error: task.error,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
      },
    });
  });

  app.post("/:id/cancel", (c) => {
    const id = c.req.param("id");
    const success = taskQueue.cancelTask(id);
    if (!success) {
      return c.json({ error: "Task not found or cannot be cancelled" }, 400);
    }
    return c.json({ ok: true });
  });

  return app;
}
