import { getSqlite } from "@ai-assistant/db";

/** Default retention period: 90 days */
const RETENTION_DAYS = 90;

/** Run data retention cleanup — deletes old messages, logs, and orphaned channels/sessions */
export async function runRetentionCleanup(db: unknown): Promise<{
  deletedMessages: number;
  deletedLogs: number;
  deletedChannels: number;
  deletedSessions: number;
}> {
  const sqlite = getSqlite();
  if (!sqlite) {
    return { deletedMessages: 0, deletedLogs: 0, deletedChannels: 0, deletedSessions: 0 };
  }

  const cutoffTimestamp = Math.floor((Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000) / 1000);

  // Delete old messages
  const msgResult = sqlite.run("DELETE FROM messages WHERE created_at < ?", [cutoffTimestamp]);

  // Delete old request logs
  const logResult = sqlite.run("DELETE FROM request_logs WHERE created_at < ?", [cutoffTimestamp]);

  // Delete orphaned channels FIRST (before sessions, so the session check is meaningful)
  const chanResult = sqlite.run(`
    DELETE FROM channels WHERE id NOT IN (
      SELECT DISTINCT channel_id FROM messages
    ) AND id NOT IN (
      SELECT DISTINCT channel_id FROM sessions
    )
  `);

  // Delete orphaned sessions (channels with no recent messages)
  const sesResult = sqlite.run(`
    DELETE FROM sessions WHERE channel_id NOT IN (
      SELECT DISTINCT channel_id FROM messages
      WHERE created_at >= ?
    )
  `, [cutoffTimestamp]);

  return {
    deletedMessages: msgResult.changes,
    deletedLogs: logResult.changes,
    deletedChannels: chanResult.changes,
    deletedSessions: sesResult.changes,
  };
}
