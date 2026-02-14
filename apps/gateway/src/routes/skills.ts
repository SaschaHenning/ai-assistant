import { Hono } from "hono";
import type { SkillRegistry } from "@ai-assistant/skill-runtime";

export function createSkillRoutes(registry: SkillRegistry) {
  const app = new Hono();

  // List all skills
  app.get("/", (c) => {
    const skills = registry.getAll().map((s) => ({
      name: s.meta.name,
      displayName: s.meta.displayName,
      description: s.meta.description,
      type: s.meta.type,
      version: s.meta.version,
      generated: s.meta.generated,
      enabled: s.meta.enabled !== false,
      tools: s.getTools().map((t) => ({
        name: t.name,
        description: t.description,
      })),
    }));

    return c.json({ skills });
  });

  // Get specific skill
  app.get("/:name", (c) => {
    const name = c.req.param("name");
    const skill = registry.get(name);

    if (!skill) {
      return c.json({ error: "Skill not found" }, 404);
    }

    return c.json({
      name: skill.meta.name,
      displayName: skill.meta.displayName,
      description: skill.meta.description,
      type: skill.meta.type,
      version: skill.meta.version,
      generated: skill.meta.generated,
      enabled: skill.meta.enabled !== false,
      tools: skill.getTools().map((t) => ({
        name: t.name,
        description: t.description,
      })),
    });
  });

  return app;
}
