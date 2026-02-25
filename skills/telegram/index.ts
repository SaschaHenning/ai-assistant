import { Bot, GrammyError } from "grammy";
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

/** Timeout for ffmpeg/whisper subprocesses (60 seconds) */
const SUBPROCESS_TIMEOUT = 60 * 1000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: Timer;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function transcribeAudio(filePath: string): Promise<string> {
  // Convert to 16kHz WAV (required by whisper-cpp)
  const wavPath = filePath + ".wav";
  const ffmpeg = spawn(["ffmpeg", "-y", "-i", filePath, "-ar", "16000", "-ac", "1", "-f", "wav", wavPath], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const ffmpegExit = await withTimeout(ffmpeg.exited, SUBPROCESS_TIMEOUT, "ffmpeg");
  if (ffmpegExit !== 0) {
    await unlink(wavPath).catch(() => {});
    throw new Error(`ffmpeg exited with code ${ffmpegExit}`);
  }

  // Run whisper-cli
  const whisper = spawn(["whisper-cli", "--model", WHISPER_MODEL, "--no-prints", "--no-timestamps", "--language", "de", wavPath], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await withTimeout(
    new Response(whisper.stdout).text(),
    SUBPROCESS_TIMEOUT,
    "whisper-cli"
  );
  const whisperExit = await withTimeout(whisper.exited, 5000, "whisper-cli exit");

  // Cleanup temp files
  await unlink(wavPath).catch(() => {});

  if (whisperExit !== 0) {
    throw new Error(`whisper-cli exited with code ${whisperExit}`);
  }

  return output.trim();
}

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const RESTART_DELAY = 5000; // 5 seconds

function createSkill(): Skill {
  let bot: Bot | null = null;
  let messageHandler: ((msg: NormalizedMessage) => Promise<void>) | null = null;
  let heartbeatTimer: Timer | null = null;
  let restartTimer: Timer | null = null;

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
          // Fire-and-forget — task queue handles typing + response delivery
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

          // Fire-and-forget — task queue handles typing + response delivery
          messageHandler(msg).catch((err) =>
            context.log.error("Voice handler error:", err)
          );
        } catch (err) {
          context.log.error("Voice message error:", err);
          await ctx.reply("Failed to process voice message.");
        }
      });

      // Global error handler — prevents unhandled errors from killing the polling loop
      bot.catch((err) => {
        context.log.error("Telegram bot error:", err.error ?? err);
      });

      // Start long polling with auto-restart on fatal errors
      const startPolling = () => {
        if (!bot) return;
        bot.start({
          onStart: () => context.log.info("Telegram bot polling started"),
        }).catch((err) => {
          context.log.error("Telegram polling stopped unexpectedly:", err);
          const isPermanent = err instanceof GrammyError &&
            (err.error_code === 401 || err.error_code === 409);
          if (isPermanent) {
            context.log.error("Permanent Telegram API error — not restarting");
            return;
          }
          if (bot) {
            context.log.info(`Restarting Telegram polling in ${RESTART_DELAY / 1000}s...`);
            restartTimer = setTimeout(startPolling, RESTART_DELAY);
          }
        });
      };
      startPolling();

      // Heartbeat: periodically ping Telegram API to detect silent connection loss
      heartbeatTimer = setInterval(async () => {
        if (!bot) return;
        try {
          await bot.api.getMe();
        } catch (err) {
          context.log.error("Telegram heartbeat failed:", err);
          context.log.info("Restarting Telegram bot due to heartbeat failure...");
          try {
            await bot.stop();
          } catch {}
          // bot.stop() resolves the bot.start() promise, which triggers the
          // restart logic above via the .catch() handler
        }
      }, HEARTBEAT_INTERVAL);
    },

    async stop() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      if (bot) {
        const b = bot;
        bot = null; // Signal to prevent auto-restart
        await b.stop();
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
