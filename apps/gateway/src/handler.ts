import { randomUUID } from "crypto";
import type { NormalizedMessage } from "@ai-assistant/core";
import { eq, schema, type AppDatabase } from "@ai-assistant/db";
import { invokeClaude, type ClaudeOptions } from "./claude";

const SYSTEM_PROMPT = `You are a helpful personal AI assistant. You have access to various tools (skills) that you can use to help the user. Be concise and helpful. When you use tools, explain what you're doing briefly.

Safety rules:
- Never run destructive commands (rm -rf, drop tables, etc.)
- Never modify files outside the project directory
- Never access credentials, tokens, or secrets directly
- Never use sudo or run commands as root
- Explain any risky or potentially destructive command before running it
- Prefer read-only operations when possible`;

interface HandleMessageOptions {
  message: NormalizedMessage;
  db: AppDatabase;
  mcpConfigPath: string;
  onToken?: (text: string) => void;
}

export async function handleIncomingMessage(
  options: HandleMessageOptions
): Promise<{ text: string; sessionId: string; costUsd?: number; durationMs: number }> {
  const { message, db, mcpConfigPath, onToken } = options;

  // Find or create channel
  let channel = await db.query.channels.findFirst({
    where: eq(schema.channels.externalId, message.channelId),
  });

  if (!channel) {
    const channelId = randomUUID();
    await db.insert(schema.channels).values({
      id: channelId,
      platform: message.platform,
      externalId: message.channelId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    channel = await db.query.channels.findFirst({
      where: eq(schema.channels.id, channelId),
    });
  }

  if (!channel) {
    throw new Error("Failed to create channel");
  }

  // Save user message
  await db.insert(schema.messages).values({
    id: randomUUID(),
    channelId: channel.id,
    role: "user",
    content: message.text,
    platform: message.platform,
    userId: message.userId,
    createdAt: new Date(),
  });

  // Look up existing session for conversation continuity
  const existingSession = await db.query.sessions.findFirst({
    where: eq(schema.sessions.channelId, channel.id),
  });

  // Invoke Claude CLI with latency tracking
  const claudeOptions: ClaudeOptions = {
    prompt: message.text,
    systemPrompt: SYSTEM_PROMPT,
    sessionId: existingSession?.claudeSessionId || undefined,
    mcpConfigPath,
    onToken,
  };

  const startTime = performance.now();
  const result = await invokeClaude(claudeOptions);
  const durationMs = Math.round(performance.now() - startTime);

  // Save or update session
  if (existingSession) {
    await db
      .update(schema.sessions)
      .set({
        claudeSessionId: result.sessionId,
        updatedAt: new Date(),
      })
      .where(eq(schema.sessions.id, existingSession.id));
  } else {
    await db.insert(schema.sessions).values({
      id: randomUUID(),
      channelId: channel.id,
      claudeSessionId: result.sessionId,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Save assistant message
  await db.insert(schema.messages).values({
    id: randomUUID(),
    channelId: channel.id,
    role: "assistant",
    content: result.text,
    platform: message.platform,
    createdAt: new Date(),
  });

  // Insert request log
  await db.insert(schema.requestLogs).values({
    id: randomUUID(),
    platform: message.platform,
    channelId: message.channelId,
    userId: message.userId,
    userMessage: message.text,
    assistantReply: result.text,
    costUsd: result.costUsd ?? null,
    claudeSessionId: result.sessionId,
    durationMs,
    createdAt: new Date(),
  });

  return { text: result.text, sessionId: result.sessionId, costUsd: result.costUsd, durationMs };
}
