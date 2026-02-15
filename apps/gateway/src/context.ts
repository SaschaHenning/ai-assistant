import type { SkillContext } from "@ai-assistant/core";
import type { AppDatabase } from "@ai-assistant/db";
import { EventEmitter } from "events";

const emitter = new EventEmitter();

// Map of platform+channelId -> sendMessage function
export const messageSenders = new Map<string, (channelId: string, text: string) => Promise<void>>();

export function registerMessageSender(
  platform: string,
  sender: (channelId: string, text: string) => Promise<void>
) {
  messageSenders.set(platform, sender);
}

export function createSkillContext(db: AppDatabase): SkillContext {
  return {
    sendMessage: async (channelId: string, text: string) => {
      // Try each registered sender until one works
      for (const [, sender] of messageSenders) {
        try {
          await sender(channelId, text);
          return;
        } catch {
          // Try next sender
        }
      }
      console.warn(`No sender could deliver message to channel: ${channelId}`);
    },

    emit: (event: string, payload: unknown) => {
      emitter.emit(event, payload);
    },

    env: (key: string) => process.env[key],

    db,

    log: {
      info: (...args: any[]) => console.log("[skill]", ...args),
      warn: (...args: any[]) => console.warn("[skill]", ...args),
      error: (...args: any[]) => console.error("[skill]", ...args),
    },
  };
}

export { emitter };
