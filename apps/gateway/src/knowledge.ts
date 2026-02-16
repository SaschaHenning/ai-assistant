import { asc, eq, schema, type AppDatabase } from "@ai-assistant/db";

export async function getKnowledgeBlock(db: AppDatabase): Promise<string> {
  try {
    const entries = await db.query.knowledge.findMany({
      where: eq(schema.knowledge.enabled, true),
      orderBy: [asc(schema.knowledge.sortOrder), asc(schema.knowledge.createdAt)],
    });

    if (entries.length === 0) return "";

    const sections = entries.map((e) => `## ${e.title}\n\n${e.content}`).join("\n\n");
    return `\n\n# User Instructions\n\n${sections}`;
  } catch (error) {
    console.error("Failed to retrieve knowledge block:", error);
    return "";
  }
}
