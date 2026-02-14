import { z } from "zod";
import type { NormalizedMessage } from "./message";

export type SkillType = "connector" | "tool";

export interface SkillMeta {
  name: string;
  displayName: string;
  description: string;
  type: SkillType;
  version: string;
  generated: boolean;
  createdAt: string;
  dependencies?: Record<string, string>;
  envKeys?: string[];
  enabled?: boolean;
}

export interface SkillToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  execute: (
    input: any,
    context: SkillContext
  ) => Promise<{ content: string; data?: any }>;
}

export interface SkillContext {
  sendMessage: (channelId: string, text: string) => Promise<void>;
  emit: (event: string, payload: unknown) => void;
  env: (key: string) => string | undefined;
  db: any;
  log: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
}

export interface Skill {
  meta: SkillMeta;
  start(context: SkillContext): Promise<void>;
  stop(): Promise<void>;
  getTools(): SkillToolDefinition[];
  onMessage?: (
    handler: (msg: NormalizedMessage) => Promise<void>
  ) => void;
}

export type SkillFactory = () => Skill;
