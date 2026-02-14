import { readdir } from "fs/promises";
import { join, resolve } from "path";
import type { Skill, SkillFactory, SkillMeta } from "@ai-assistant/core";

export async function loadSkills(skillsDir: string): Promise<Skill[]> {
  const skills: Skill[] = [];
  let entries: string[];

  try {
    entries = await readdir(skillsDir).then((e) =>
      e.filter((name) => !name.startsWith("."))
    );
  } catch {
    console.warn(`Skills directory not found: ${skillsDir}`);
    return skills;
  }

  const absSkillsDir = resolve(skillsDir);

  for (const name of entries) {
    const skillPath = join(absSkillsDir, name);
    const indexPath = join(skillPath, "index.ts");
    const metaPath = join(skillPath, "meta.json");

    try {
      // Load meta.json
      const metaFile = Bun.file(metaPath);
      if (!(await metaFile.exists())) {
        console.warn(`Skipping ${name}: no meta.json`);
        continue;
      }
      const meta: SkillMeta = await metaFile.json();

      if (meta.enabled === false) {
        console.log(`Skipping disabled skill: ${name}`);
        continue;
      }

      // Import the skill factory
      const mod = await import(indexPath);
      const factory: SkillFactory = mod.default || mod.createSkill;

      if (typeof factory !== "function") {
        console.warn(`Skipping ${name}: no default export or createSkill function`);
        continue;
      }

      const skill = factory();
      // Override meta from file
      Object.assign(skill.meta, meta);
      skills.push(skill);
      console.log(`Loaded skill: ${meta.displayName} (${meta.type})`);
    } catch (err) {
      console.error(`Failed to load skill "${name}":`, err);
    }
  }

  return skills;
}
