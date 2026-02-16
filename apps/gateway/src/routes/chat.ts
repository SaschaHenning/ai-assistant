import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "crypto";
import type { NormalizedMessage } from "@ai-assistant/core";
import type { AppDatabase } from "@ai-assistant/db";
import { handleIncomingMessage } from "../handler";
import type { TaskQueue } from "../task-queue";

export function createChatRoutes(db: AppDatabase, mcpConfigPath: string, taskQueue: TaskQueue) {
  const app = new Hono();

  // SSE streaming chat endpoint
  app.post("/", async (c) => {
    const body = await c.req.json<{ message: string; channelId?: string }>();

    if (!body.message) {
      return c.json({ error: "message is required" }, 400);
    }

    const channelId = body.channelId || `web-${randomUUID()}`;

    const message: NormalizedMessage = {
      id: randomUUID(),
      platform: "web",
      channelId,
      userId: "web-user",
      text: body.message,
      timestamp: new Date(),
    };

    return streamSSE(c, async (stream) => {
      let sessionId: string | undefined;

      const task = taskQueue.enqueue(
        channelId,
        async (signal) => {
          const result = await handleIncomingMessage({
            message,
            db,
            mcpConfigPath,
            signal,
            onToken: (text) => {
              stream.writeSSE({
                data: JSON.stringify({ type: "token", text }),
                event: "token",
              });
            },
          });
          sessionId = result.sessionId;
          return result.text;
        },
        {
          messagePreview: body.message.slice(0, 200),
          platform: "web",
        }
      );

      // Bridge task queue completion to SSE stream
      const { promise, resolve, reject } = Promise.withResolvers<string>();

      const onComplete = ({ task: t }: { task: { id: string; result?: string } }) => {
        if (t.id !== task.id) return;
        cleanup();
        resolve(t.result || "");
      };
      const onFailed = ({ task: t }: { task: { id: string; error?: string } }) => {
        if (t.id !== task.id) return;
        cleanup();
        reject(new Error(t.error || "Unknown error"));
      };
      const onCancelled = ({ task: t }: { task: { id: string } }) => {
        if (t.id !== task.id) return;
        cleanup();
        reject(new Error("Task was cancelled"));
      };
      const cleanup = () => {
        taskQueue.off("task:completed", onComplete);
        taskQueue.off("task:failed", onFailed);
        taskQueue.off("task:cancelled", onCancelled);
      };

      taskQueue.on("task:completed", onComplete);
      taskQueue.on("task:failed", onFailed);
      taskQueue.on("task:cancelled", onCancelled);

      try {
        const text = await promise;
        await stream.writeSSE({
          data: JSON.stringify({
            type: "done",
            text,
            sessionId,
            channelId,
          }),
          event: "done",
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await stream.writeSSE({
          data: JSON.stringify({ type: "error", error: msg }),
          event: "error",
        });
      }
    });
  });

  return app;
}
