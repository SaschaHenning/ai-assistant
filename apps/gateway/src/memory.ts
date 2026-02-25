import { randomUUID } from "crypto";
import { eq, desc, sql, schema, type AppDatabase, getSqlite } from "@ai-assistant/db";

export interface Memory {
  id: string;
  type: "semantic" | "episodic";
  content: string;
  tags: string | null;
  salience: number;
  source: string;
  channelId: string | null;
  createdAt: Date;
  lastAccessedAt: Date;
}

/** Trigger words that indicate a semantic memory should be extracted */
const SEMANTIC_TRIGGERS = [
  /\bmy\s+(?:name|email|phone|address|company|team|project|preference)\b/i,
  /\bi\s+am\b/i,
  /\bi\s+prefer\b/i,
  /\bremember\s+(?:that|this|my|i)\b/i,
  /\balways\s+(?:use|do|prefer|want|include|add)\b/i,
  /\bnever\s+(?:use|do|include|add|want)\b/i,
  /\bi\s+(?:like|love|hate|dislike|want|need)\b/i,
  /\bcall\s+me\b/i,
  /\bi\s+work\s+(?:at|for|with|on)\b/i,
];

/** Initialize FTS5 virtual table and triggers (idempotent) */
export function initializeMemoryFTS() {
  const sqlite = getSqlite();
  if (!sqlite) {
    console.warn("[memory] SQLite instance not available for FTS5 setup");
    return;
  }

  // Create FTS5 virtual table (content-sync mode using external content)
  sqlite.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      tags,
      content='memories',
      content_rowid='rowid'
    )
  `);

  // Triggers to keep FTS5 in sync with memories table
  // We need to use rowid, so check if triggers exist first
  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, tags) VALUES (NEW.rowid, NEW.content, NEW.tags);
    END
  `);

  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags) VALUES ('delete', OLD.rowid, OLD.content, OLD.tags);
    END
  `);

  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags) VALUES ('delete', OLD.rowid, OLD.content, OLD.tags);
      INSERT INTO memories_fts(rowid, content, tags) VALUES (NEW.rowid, NEW.content, NEW.tags);
    END
  `);

  console.log("[memory] FTS5 virtual table initialized");
}

/** Search memories by relevance using FTS5 full-text search */
export async function searchMemories(
  db: AppDatabase,
  query: string,
  limit = 3
): Promise<Memory[]> {
  const sqlite = getSqlite();
  if (!sqlite) return [];

  // Sanitize query for FTS5: remove special characters, use OR for multiple terms
  const terms = query
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 10);

  if (terms.length === 0) return [];

  const ftsQuery = terms.map((t) => `"${t}"`).join(" OR ");

  try {
    const rows = sqlite
      .query<
        {
          id: string;
          type: string;
          content: string;
          tags: string | null;
          salience: number;
          source: string;
          channel_id: string | null;
          created_at: number;
          last_accessed_at: number;
        },
        [string, number]
      >(
        `SELECT m.id, m.type, m.content, m.tags, m.salience, m.source,
                m.channel_id, m.created_at, m.last_accessed_at
         FROM memories m
         JOIN memories_fts fts ON m.rowid = fts.rowid
         WHERE memories_fts MATCH ?
         AND m.salience >= 0.1
         ORDER BY fts.rank * m.salience DESC
         LIMIT ?`
      )
      .all(ftsQuery, limit);

    return rows.map(rowToMemory);
  } catch (err) {
    console.error("[memory] FTS5 search error:", err);
    return [];
  }
}

/** Get the most recent memories by last access time */
export async function getRecentMemories(
  db: AppDatabase,
  limit = 5
): Promise<Memory[]> {
  const rows = await db.query.memories.findMany({
    orderBy: [desc(schema.memories.lastAccessedAt)],
    limit,
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.type as "semantic" | "episodic",
    content: r.content,
    tags: r.tags,
    salience: r.salience,
    source: r.source,
    channelId: r.channelId,
    createdAt: r.createdAt,
    lastAccessedAt: r.lastAccessedAt,
  }));
}

/** Boost salience when a memory is accessed (capped at 5.0) */
export async function boostSalience(db: AppDatabase, memoryId: string) {
  await db
    .update(schema.memories)
    .set({
      salience: sql`MIN(${schema.memories.salience} + 0.1, 5.0)`,
      lastAccessedAt: new Date(),
    })
    .where(eq(schema.memories.id, memoryId));
}

/** Apply daily salience decay: -2% per day, delete memories below 0.1 */
export async function decayMemories(db: AppDatabase) {
  // Apply decay
  await db
    .update(schema.memories)
    .set({
      salience: sql`${schema.memories.salience} * 0.98`,
      updatedAt: new Date(),
    });

  // Delete memories that fell below threshold
  const deleted = await db
    .delete(schema.memories)
    .where(sql`${schema.memories.salience} < 0.1`);

  return deleted;
}

/** Extract and save semantic memories from a user message */
export async function extractMemories(
  db: AppDatabase,
  userMessage: string,
  channelId?: string
): Promise<number> {
  const triggered = SEMANTIC_TRIGGERS.some((re) => re.test(userMessage));
  if (!triggered) return 0;

  // Don't store very short or very long messages as memories
  if (userMessage.length < 10 || userMessage.length > 2000) return 0;

  // Check for duplicate content (fuzzy: same first 100 chars)
  const prefix = userMessage.slice(0, 100);
  const existing = await db.query.memories.findFirst({
    where: sql`${schema.memories.content} LIKE ${prefix + "%"}`,
  });

  if (existing) {
    // Boost existing memory instead of creating a duplicate
    await boostSalience(db, existing.id);
    return 0;
  }

  // Extract key facts — store the user's statement as-is for now
  // A more sophisticated approach would use Claude to extract structured facts
  const tags = extractTags(userMessage);

  await db.insert(schema.memories).values({
    id: randomUUID(),
    type: "semantic",
    content: userMessage,
    tags: tags.length > 0 ? tags.join(", ") : null,
    salience: 1.0,
    source: "user_extraction",
    channelId: channelId || null,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    updatedAt: new Date(),
  });

  return 1;
}

/** Save an episodic memory (conversation summary) */
export async function saveEpisodicMemory(
  db: AppDatabase,
  summary: string,
  channelId?: string
) {
  await db.insert(schema.memories).values({
    id: randomUUID(),
    type: "episodic",
    content: summary,
    tags: null,
    salience: 0.8, // Episodic memories start slightly lower
    source: "conversation_summary",
    channelId: channelId || null,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    updatedAt: new Date(),
  });
}

/** Deduplicate memories by ID (used when combining search + recent results) */
export function deduplicateMemories(memories: Memory[]): Memory[] {
  const seen = new Set<string>();
  return memories.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/** Format memories as a [Memory context] block for the system prompt */
export function formatMemoryContext(memories: Memory[]): string {
  if (memories.length === 0) return "";

  const lines = memories.map((m) => `- ${m.content}`).join("\n");
  return `\n\n[Memory context]\n${lines}\n[/Memory context]`;
}

/** Extract simple keyword tags from a message */
function extractTags(message: string): string[] {
  const tags: string[] = [];
  const lower = message.toLowerCase();

  if (/\bname\b/.test(lower)) tags.push("name");
  if (/\bemail\b/.test(lower)) tags.push("email");
  if (/\bprefer/.test(lower)) tags.push("preference");
  if (/\bwork\b/.test(lower)) tags.push("work");
  if (/\bcompany\b/.test(lower)) tags.push("company");
  if (/\blanguage\b/.test(lower)) tags.push("language");
  if (/\balways\b/.test(lower)) tags.push("rule");
  if (/\bnever\b/.test(lower)) tags.push("rule");
  if (/\btool\b|\bframework\b|\blibrary\b/.test(lower)) tags.push("tech");

  return tags;
}

function rowToMemory(row: {
  id: string;
  type: string;
  content: string;
  tags: string | null;
  salience: number;
  source: string;
  channel_id: string | null;
  created_at: number;
  last_accessed_at: number;
}): Memory {
  return {
    id: row.id,
    type: row.type as "semantic" | "episodic",
    content: row.content,
    tags: row.tags,
    salience: row.salience,
    source: row.source,
    channelId: row.channel_id,
    createdAt: new Date(row.created_at),
    lastAccessedAt: new Date(row.last_accessed_at),
  };
}
