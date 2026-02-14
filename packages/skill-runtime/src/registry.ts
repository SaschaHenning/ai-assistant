import type { Skill, SkillToolDefinition, SkillContext } from "@ai-assistant/core";

export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private messageHandlers: Array<(msg: any) => Promise<void>> = [];

  register(skill: Skill): void {
    if (this.skills.has(skill.meta.name)) {
      throw new Error(`Skill "${skill.meta.name}" is already registered`);
    }
    this.skills.set(skill.meta.name, skill);
  }

  unregister(name: string): void {
    this.skills.delete(name);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  getConnectors(): Skill[] {
    return this.getAll().filter((s) => s.meta.type === "connector");
  }

  getToolSkills(): Skill[] {
    return this.getAll().filter((s) => s.meta.type === "tool");
  }

  getAllTools(): Map<string, SkillToolDefinition> {
    const tools = new Map<string, SkillToolDefinition>();
    for (const skill of this.skills.values()) {
      for (const tool of skill.getTools()) {
        tools.set(tool.name, tool);
      }
    }
    return tools;
  }

  async startAll(context: SkillContext): Promise<void> {
    for (const skill of this.skills.values()) {
      if (skill.meta.enabled !== false) {
        await skill.start(context);
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const skill of this.skills.values()) {
      await skill.stop();
    }
  }

  onMessage(handler: (msg: any) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  async dispatchMessage(msg: any): Promise<void> {
    for (const handler of this.messageHandlers) {
      await handler(msg);
    }
  }
}
