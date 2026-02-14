import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "crypto";
import type { NormalizedMessage } from "@ai-assistant/core";
import type { AppDatabase } from "@ai-assistant/db";
import { handleIncomingMessage } from "../handler";

export function createChatRoutes(db: AppDatabase, mcpConfigPath: string) {
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
      try {
        const result = await handleIncomingMessage({
          message,
          db,
          mcpConfigPath,
          onToken: (text) => {
            stream.writeSSE({
              data: JSON.stringify({ type: "token", text }),
              event: "token",
            });
          },
        });

        await stream.writeSSE({
          data: JSON.stringify({
            type: "done",
            text: result.text,
            sessionId: result.sessionId,
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
