import { randomUUID } from "crypto";
import type { NormalizedMessage } from "@ai-assistant/core";
import { eq, schema, type AppDatabase } from "@ai-assistant/db";
import { invokeClaude, type ClaudeOptions } from "./claude";

const SYSTEM_PROMPT = `You are a helpful personal AI assistant. You have access to various tools (skills) that you can use to help the user. Be concise and helpful. When you use tools, explain what you're doing briefly.`;

interface HandleMessageOptions {
  message: NormalizedMessage;
  db: AppDatabase;
  mcpConfigPath: string;
  onToken?: (text: string) => void;
}

export async function handleIncomingMessage(
  options: HandleMessageOptions
): Promise<{ text: string; sessionId: string }> {
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

  // Invoke Claude CLI
  const claudeOptions: ClaudeOptions = {
    prompt: message.text,
    systemPrompt: SYSTEM_PROMPT,
    sessionId: existingSession?.claudeSessionId || undefined,
    mcpConfigPath,
    onToken,
  };

  const result = await invokeClaude(claudeOptions);

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

  return { text: result.text, sessionId: result.sessionId };
}
