import { z } from "zod";
import { join } from "path";
import { readdir } from "fs/promises";
import type {
  Skill,
  SkillContext,
  SkillToolDefinition,
  SkillMeta,
} from "@ai-assistant/core";

import meta from "./meta.json";

// Forbidden patterns for AI-generated skill code
const FORBIDDEN_PATTERNS = [
  /process\.exit/,
  /child_process/,
  /require\s*\(\s*['"]fs['"]\s*\)/,
  /Bun\.spawn/,
  /eval\s*\(/,
  /Function\s*\(/,
  /import\s+.*from\s+['"]node:/,
  /\.env\b/,
  /process\.env/,
  /Bun\.file\s*\(\s*['"]\//, // no absolute path file access
];

function validateCode(code: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(`Forbidden pattern: ${pattern.source}`);
    }
  }

  if (!code.includes("export default") && !code.includes("export function createSkill")) {
    errors.push("Must export a default factory function or named createSkill");
  }

  if (!code.includes("getTools")) {
    errors.push("Must implement getTools() method");
  }

  return { valid: errors.length === 0, errors };
}

function createSkill(): Skill {
  // Resolve skills directory relative to this skill's location
  const skillsDir = join(import.meta.dir, "..");

  return {
    meta: meta as SkillMeta,

    async start(context: SkillContext) {
      context.log.info("Skill creator started");
    },

    async stop() {},

    getTools(): SkillToolDefinition[] {
      return [
        {
          name: "create_skill",
          description:
            "Create a new AI assistant skill. The skill will be saved to disk and available after the MCP server restarts. The code must export a default factory function that returns a Skill object with meta, start, stop, and getTools methods.",
          inputSchema: z.object({
            name: z
              .string()
              .regex(/^[a-z][a-z0-9-]*$/)
              .describe("Skill name (lowercase, hyphens allowed, e.g. 'weather-lookup')"),
            displayName: z.string().describe("Human-readable skill name"),
            description: z.string().describe("What this skill does"),
            code: z.string().describe(
              `TypeScript code for the skill. Must export a default factory function.

Example:
import { z } from "zod";
import type { Skill, SkillContext, SkillToolDefinition, SkillMeta } from "@ai-assistant/core";

export default function createSkill(): Skill {
  return {
    meta: { name: "example", displayName: "Example", description: "An example skill", type: "tool", version: "0.1.0", generated: true, createdAt: new Date().toISOString() },
    async start(ctx) { ctx.log.info("Started"); },
    async stop() {},
    getTools(): SkillToolDefinition[] {
      return [{
        name: "example_tool",
        description: "Does something",
        inputSchema: z.object({ input: z.string() }),
        execute: async (params, ctx) => {
          return { content: "Result: " + params.input };
        }
      }];
    }
  };
}`
            ),
          }),
          execute: async (input, context) => {
            const { name, displayName, description, code } = input;

            // Validate code
            const validation = validateCode(code);
            if (!validation.valid) {
              return {
                content: `Skill validation failed:\n${validation.errors.join("\n")}`,
                data: { errors: validation.errors },
              };
            }

            // Create skill directory and files
            const skillDir = join(skillsDir, name);

            try {
              // Write meta.json
              const metaContent: SkillMeta = {
                name,
                displayName,
                description,
                type: "tool",
                version: "0.1.0",
                generated: true,
                createdAt: new Date().toISOString(),
                enabled: true,
              };

              await Bun.write(
                join(skillDir, "meta.json"),
                JSON.stringify(metaContent, null, 2)
              );

              // Write package.json
              await Bun.write(
                join(skillDir, "package.json"),
                JSON.stringify(
                  {
                    name: `@ai-assistant/skill-${name}`,
                    version: "0.1.0",
                    private: true,
                    type: "module",
                    main: "index.ts",
                    dependencies: {
                      "@ai-assistant/core": "workspace:*",
                      zod: "^3.24.0",
                    },
                  },
                  null,
                  2
                )
              );

              // Write skill code
              await Bun.write(join(skillDir, "index.ts"), code);

              return {
                content: `Skill "${displayName}" created successfully at skills/${name}/. It will be available after restarting the gateway.`,
                data: { name, path: skillDir },
              };
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              return {
                content: `Failed to create skill: ${msg}`,
                data: { error: msg },
              };
            }
          },
        },
        {
          name: "list_skills",
          description: "List all available skills and their tools",
          inputSchema: z.object({}),
          execute: async (_, context) => {
            try {
              const entries = await readdir(skillsDir);
              const skillList: Array<{ name: string; meta: any }> = [];

              for (const entry of entries) {
                if (entry.startsWith(".")) continue;
                const metaPath = join(skillsDir, entry, "meta.json");
                try {
                  const metaFile = Bun.file(metaPath);
                  if (await metaFile.exists()) {
                    const m = await metaFile.json();
                    skillList.push({ name: entry, meta: m });
                  }
                } catch {
                  // Skip invalid skills
                }
              }

              const formatted = skillList
                .map(
                  (s) =>
                    `- **${s.meta.displayName}** (${s.name}): ${s.meta.description} [${s.meta.type}]${s.meta.generated ? " [AI-generated]" : ""}`
                )
                .join("\n");

              return {
                content: `Available skills:\n\n${formatted}`,
                data: { skills: skillList },
              };
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              return { content: `Failed to list skills: ${msg}` };
            }
          },
        },
      ];
    },
  };
}

export default createSkill;
