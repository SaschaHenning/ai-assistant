import { Bot } from "grammy";
import { z } from "zod";
import type {
  Skill,
  SkillContext,
  SkillToolDefinition,
  SkillMeta,
  NormalizedMessage,
} from "@ai-assistant/core";

import meta from "./meta.json";

function createSkill(): Skill {
  let bot: Bot | null = null;
  let messageHandler: ((msg: NormalizedMessage) => Promise<void>) | null = null;

  return {
    meta: meta as SkillMeta,

    async start(context: SkillContext) {
      const token = context.env("TELEGRAM_BOT_TOKEN");
      if (!token) {
        context.log.warn("TELEGRAM_BOT_TOKEN not set, Telegram skill disabled");
        return;
      }

      bot = new Bot(token);

      // Handle incoming text messages
      bot.on("message:text", async (ctx) => {
        const msg: NormalizedMessage = {
          id: String(ctx.message.message_id),
          platform: "telegram",
          channelId: String(ctx.chat.id),
          userId: String(ctx.from.id),
          userName: ctx.from.first_name,
          text: ctx.message.text,
          timestamp: new Date(ctx.message.date * 1000),
        };

        if (messageHandler) {
          await messageHandler(msg);
        }
      });

      // Start long polling
      bot.start({
        onStart: () => {
          context.log.info("Telegram bot started");
        },
      });
    },

    async stop() {
      if (bot) {
        await bot.stop();
        bot = null;
      }
    },

    getTools(): SkillToolDefinition[] {
      return [
        {
          name: "send_telegram_message",
          description: "Send a message to a Telegram chat",
          inputSchema: z.object({
            chatId: z.string().describe("The Telegram chat ID to send the message to"),
            text: z.string().describe("The message text to send"),
          }),
          execute: async (input, context) => {
            if (!bot) {
              return { content: "Telegram bot is not running" };
            }

            try {
              await bot.api.sendMessage(Number(input.chatId), input.text, {
                parse_mode: "Markdown",
              });
              return { content: `Message sent to chat ${input.chatId}` };
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              return { content: `Failed to send message: ${msg}` };
            }
          },
        },
      ];
    },

    onMessage(handler: (msg: NormalizedMessage) => Promise<void>) {
      messageHandler = handler;
    },
  };
}

export default createSkill;
