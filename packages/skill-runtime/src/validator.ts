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
  /rm\s+-rf/,
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSkillCode(code: string): ValidationResult {
  const errors: string[] = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(`Forbidden pattern detected: ${pattern.source}`);
    }
  }

  // Must export a factory function
  if (!code.includes("export default") && !code.includes("export function createSkill")) {
    errors.push("Skill must export a default factory function or named createSkill function");
  }

  // Must have getTools method
  if (!code.includes("getTools")) {
    errors.push("Skill must implement getTools() method");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
