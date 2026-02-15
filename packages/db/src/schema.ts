import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(), // telegram | web | api
  externalId: text("external_id").notNull(),
  sessionId: text("session_id"), // Claude CLI session ID for --resume
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  channelId: text("channel_id")
    .notNull()
    .references(() => channels.id),
  role: text("role").notNull(), // user | assistant | system
  content: text("content").notNull(),
  platform: text("platform").notNull(),
  userId: text("user_id"),
  toolCalls: text("tool_calls", { mode: "json" }).$type<any[]>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  channelId: text("channel_id")
    .notNull()
    .references(() => channels.id),
  claudeSessionId: text("claude_session_id"), // For --resume
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const skills = sqliteTable("skills", {
  name: text("name").primaryKey(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // connector | tool
  version: text("version").notNull(),
  generated: integer("generated", { mode: "boolean" }).notNull().default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const requestLogs = sqliteTable("request_logs", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(),
  channelId: text("channel_id").notNull(),
  userId: text("user_id"),
  userMessage: text("user_message").notNull(),
  assistantReply: text("assistant_reply").notNull(),
  costUsd: real("cost_usd"),
  claudeSessionId: text("claude_session_id"),
  durationMs: integer("duration_ms"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
