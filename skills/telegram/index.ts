import { Bot } from "grammy";
import { z } from "zod";
import { spawn } from "bun";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { unlink } from "fs/promises";
import type {
  Skill,
  SkillContext,
  SkillToolDefinition,
  SkillMeta,
  NormalizedMessage,
} from "@ai-assistant/core";

import meta from "./meta.json";

const PROJECT_ROOT = resolve(import.meta.dir, "../..");
const WHISPER_MODEL = join(PROJECT_ROOT, "data/models/ggml-small.bin");

async function transcribeAudio(filePath: string): Promise<string> {
  // Convert to 16kHz WAV (required by whisper-cpp)
  const wavPath = filePath + ".wav";
  const ffmpeg = spawn(["ffmpeg", "-y", "-i", filePath, "-ar", "16000", "-ac", "1", "-f", "wav", wavPath], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await ffmpeg.exited;

  // Run whisper-cli
  const whisper = spawn(["whisper-cli", "--model", WHISPER_MODEL, "--no-prints", "--no-timestamps", "--language", "de", wavPath], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(whisper.stdout).text();
  await whisper.exited;

  // Cleanup temp files
  await unlink(wavPath).catch(() => {});

  return output.trim();
}

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

      // Parse allowed user IDs from env (comma-separated)
      const allowedUsersRaw = context.env("TELEGRAM_ALLOWED_USERS");
      const allowedUsers = allowedUsersRaw
        ? new Set(allowedUsersRaw.split(",").map((id) => id.trim()))
        : null;

      if (allowedUsers) {
        context.log.info(`Telegram restricted to user IDs: ${[...allowedUsers].join(", ")}`);
      }

      // Handle incoming text messages
      bot.on("message:text", async (ctx) => {
        const userId = String(ctx.from.id);

        // Reject unauthorized users
        if (allowedUsers && !allowedUsers.has(userId)) {
          await ctx.reply("Sorry, you are not authorized to use this bot.");
          return;
        }

        const msg: NormalizedMessage = {
          id: String(ctx.message.message_id),
          platform: "telegram",
          channelId: String(ctx.chat.id),
          userId,
          userName: ctx.from.first_name,
          text: ctx.message.text,
          timestamp: new Date(ctx.message.date * 1000),
        };

        if (messageHandler) {
          // Fire-and-forget: typing indicators are managed by the task queue
          messageHandler(msg).catch((err) =>
            context.log.error("Message handler error:", err)
          );
        }
      });

      // Handle voice messages
      bot.on("message:voice", async (ctx) => {
        const userId = String(ctx.from.id);

        if (allowedUsers && !allowedUsers.has(userId)) {
          await ctx.reply("Sorry, you are not authorized to use this bot.");
          return;
        }

        if (!messageHandler) return;

        const chatId = ctx.chat.id;

        try {
          // Download voice file from Telegram
          const file = await ctx.getFile();
          const filePath = join(tmpdir(), `tg-voice-${randomUUID()}.ogg`);
          const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
          const res = await fetch(url);
          await Bun.write(filePath, await res.arrayBuffer());

          // Transcribe
          const transcript = await transcribeAudio(filePath);
          await unlink(filePath).catch(() => {});

          if (!transcript) {
            await ctx.reply("Could not transcribe the voice message.");
            return;
          }

          context.log.info(`Voice transcription: ${transcript.slice(0, 100)}...`);

          // Send transcription confirmation before processing
          await bot!.api.sendMessage(chatId, `🎤 Ich habe erkannt: "${transcript}"`);

          const msg: NormalizedMessage = {
            id: String(ctx.message.message_id),
            platform: "telegram",
            channelId: String(chatId),
            userId,
            userName: ctx.from.first_name,
            text: transcript,
            timestamp: new Date(ctx.message.date * 1000),
          };

          // Fire-and-forget: typing indicators are managed by the task queue
          messageHandler(msg).catch((err) =>
            context.log.error("Voice handler error:", err)
          );
        } catch (err) {
          context.log.error("Voice message error:", err);
          await ctx.reply("Failed to process voice message.");
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
                parse_mode: "HTML",
              });
              return { content: `Message sent to chat ${input.chatId}` };
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              return { content: `Failed to send message: ${msg}` };
            }
          },
        },
        {
          name: "send_chat_action",
          description: "Send a chat action (e.g. typing indicator) to a Telegram chat",
          inputSchema: z.object({
            chatId: z.string().describe("The Telegram chat ID"),
            action: z.string().describe("The action to send, e.g. 'typing'").default("typing"),
          }),
          execute: async (input) => {
            if (!bot) {
              return { content: "Telegram bot is not running" };
            }

            try {
              await bot.api.sendChatAction(Number(input.chatId), input.action as any);
              return { content: `Action '${input.action}' sent to chat ${input.chatId}` };
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              return { content: `Failed to send action: ${msg}` };
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
