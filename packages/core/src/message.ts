export type Platform = "telegram" | "web" | "api";

export interface NormalizedMessage {
  id: string;
  platform: Platform;
  channelId: string;
  userId: string;
  userName?: string;
  text: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface OutgoingMessage {
  channelId: string;
  text: string;
  platform: Platform;
  replyToId?: string;
  metadata?: Record<string, unknown>;
}
