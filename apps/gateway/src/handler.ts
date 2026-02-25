import { randomUUID } from "crypto";
import type { NormalizedMessage } from "@ai-assistant/core";
import { eq, schema, type AppDatabase } from "@ai-assistant/db";
import { invokeClaude, type ClaudeOptions } from "./claude";
import { getKnowledgeBlock } from "./knowledge";
import {
  searchMemories,
  getRecentMemories,
  deduplicateMemories,
  formatMemoryContext,
  boostSalience,
  extractMemories,
} from "./memory";

const BASE_SYSTEM_PROMPT = `You are a helpful personal AI assistant. You have access to various tools (skills) that you can use to help the user. Be concise and helpful. When you use tools, explain what you're doing briefly.

Safety rules:
- Never run destructive commands (rm -rf, drop tables, etc.)
- Never modify files outside the project directory
- Never access credentials, tokens, or secrets directly
- Never use sudo or run commands as root
- Explain any risky or potentially destructive command before running it
- Prefer read-only operations when possible`;

const PLATFORM_FORMAT_INSTRUCTIONS: Record<string, string> = {
  telegram: `
Response formatting: You are responding on Telegram. Use Telegram HTML formatting:
- <b>bold</b> for emphasis
- <i>italic</i> for secondary emphasis
- <code>inline code</code> for technical terms
- <pre>code blocks</pre> for multi-line code
- Do NOT use Markdown syntax (no **, no ##, no \`\`\`)
- Keep responses concise, Telegram messages should be scannable
- Use line breaks for readability, avoid long walls of text`,
  web: `
Response formatting: You are responding on a web interface that renders Markdown.
Use standard Markdown: **bold**, *italic*, \`code\`, \`\`\`code blocks\`\`\`, ## headings, - lists.`,
};

async function getSystemPrompt(platform: string, db: AppDatabase): Promise<string> {
  const formatInstructions = PLATFORM_FORMAT_INSTRUCTIONS[platform] || PLATFORM_FORMAT_INSTRUCTIONS.web;
  const knowledgeBlock = await getKnowledgeBlock(db);
  return BASE_SYSTEM_PROMPT + knowledgeBlock + formatInstructions;
}

interface HandleMessageOptions {
  message: NormalizedMessage;
  db: AppDatabase;
  mcpConfigPath: string;
  onToken?: (text: string) => void;
  signal?: AbortSignal;
}

export async function handleIncomingMessage(
  options: HandleMessageOptions
): Promise<{ text: string; sessionId: string; costUsd?: number; durationMs: number; model?: string }> {
  const { message, db, mcpConfigPath, onToken, signal } = options;

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

  // --- Memory Context Injection (Layer 2+3) ---
  // 1. FTS5 search for top 3 relevant memories
  // 2. Recency fetch for 5 most recent
  // 3. Deduplicate and format
  let memoryBlock = "";
  try {
    const [relevant, recent] = await Promise.all([
      searchMemories(db, message.text, 3),
      getRecentMemories(db, 5),
    ]);
    const combined = deduplicateMemories([...relevant, ...recent]);

    // Boost salience for all accessed memories
    await Promise.all(combined.map((m) => boostSalience(db, m.id)));

    memoryBlock = formatMemoryContext(combined);
  } catch (err) {
    console.warn("[memory] Context injection error:", err);
  }

  // Invoke Claude CLI with latency tracking
  const systemPrompt = await getSystemPrompt(message.platform, db);
  const claudeOptions: ClaudeOptions = {
    prompt: message.text,
    systemPrompt: systemPrompt + memoryBlock,
    sessionId: existingSession?.claudeSessionId || undefined,
    mcpConfigPath,
    onToken,
    signal,
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

  // --- Post-response Memory Extraction ---
  // Extract semantic memories from user's message (trigger-word based)
  try {
    await extractMemories(db, message.text, channel.id);
  } catch (err) {
    console.warn("[memory] Extraction error:", err);
  }

  // Insert request log
  await db.insert(schema.requestLogs).values({
    id: randomUUID(),
    platform: message.platform,
    channelId: message.channelId,
    userId: message.userId,
    userMessage: message.text,
    assistantReply: result.text,
    costUsd: result.costUsd ?? null,
    model: result.model ?? null,
    claudeSessionId: result.sessionId,
    durationMs,
    createdAt: new Date(),
  });

  return { text: result.text, sessionId: result.sessionId, costUsd: result.costUsd, durationMs, model: result.model };
}
