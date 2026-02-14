import { z } from "zod";
import type {
  Skill,
  SkillContext,
  SkillToolDefinition,
  SkillMeta,
  NormalizedMessage,
} from "@ai-assistant/core";

import meta from "./meta.json";

// In-memory map of channelId -> WebSocket connections
const wsClients = new Map<string, Set<WebSocket>>();

export function registerWebSocket(channelId: string, ws: WebSocket) {
  if (!wsClients.has(channelId)) {
    wsClients.set(channelId, new Set());
  }
  wsClients.get(channelId)!.add(ws);

  ws.addEventListener("close", () => {
    wsClients.get(channelId)?.delete(ws);
    if (wsClients.get(channelId)?.size === 0) {
      wsClients.delete(channelId);
    }
  });
}

export function sendToChannel(channelId: string, data: any): boolean {
  const clients = wsClients.get(channelId);
  if (!clients || clients.size === 0) return false;

  const payload = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
  return true;
}

function createSkill(): Skill {
  let messageHandler: ((msg: NormalizedMessage) => Promise<void>) | null = null;

  return {
    meta: meta as SkillMeta,

    async start(context: SkillContext) {
      context.log.info("Web chat connector started");
    },

    async stop() {
      // Close all WebSocket connections
      for (const [, clients] of wsClients) {
        for (const ws of clients) {
          ws.close();
        }
      }
      wsClients.clear();
    },

    getTools(): SkillToolDefinition[] {
      return [
        {
          name: "send_web_message",
          description: "Send a message to a web chat channel via WebSocket",
          inputSchema: z.object({
            channelId: z.string().describe("The web channel ID"),
            text: z.string().describe("The message text to send"),
          }),
          execute: async (input) => {
            const sent = sendToChannel(input.channelId, {
              type: "message",
              text: input.text,
              timestamp: new Date().toISOString(),
            });

            return {
              content: sent
                ? `Message sent to web channel ${input.channelId}`
                : `No active connections for channel ${input.channelId}`,
            };
          },
        },
      ];
    },

    onMessage(handler: (msg: NormalizedMessage) => Promise<void>) {
      messageHandler = handler;
    },
  };
}

// Export for the gateway to wire up WebSocket connections
export { wsClients, messageHandler };

export default createSkill;
