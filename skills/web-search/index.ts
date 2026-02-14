import { z } from "zod";
import type { Skill, SkillContext, SkillToolDefinition, SkillMeta } from "@ai-assistant/core";

import meta from "./meta.json";

function createSkill(): Skill {
  return {
    meta: meta as SkillMeta,

    async start(context: SkillContext) {
      context.log.info("Web search skill started");
    },

    async stop() {},

    getTools(): SkillToolDefinition[] {
      return [
        {
          name: "web_search",
          description:
            "Search the web for current information. Returns search results with titles, URLs, and snippets.",
          inputSchema: z.object({
            query: z.string().describe("The search query"),
            maxResults: z
              .number()
              .optional()
              .default(5)
              .describe("Maximum number of results to return"),
          }),
          execute: async (input, context) => {
            const { query, maxResults = 5 } = input;
            context.log.info(`Searching web for: ${query}`);

            try {
              // Use DuckDuckGo HTML search (no API key needed)
              const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
              const response = await fetch(url, {
                headers: {
                  "User-Agent": "AI-Assistant/1.0",
                },
              });

              const html = await response.text();

              // Parse results from HTML
              const results: Array<{ title: string; url: string; snippet: string }> = [];
              const resultRegex =
                /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

              let match;
              while ((match = resultRegex.exec(html)) && results.length < maxResults) {
                results.push({
                  url: match[1].replace(/.*uddg=/, "").split("&")[0],
                  title: match[2].replace(/<[^>]*>/g, "").trim(),
                  snippet: match[3].replace(/<[^>]*>/g, "").trim(),
                });
              }

              if (results.length === 0) {
                return {
                  content: `No results found for "${query}".`,
                  data: { results: [] },
                };
              }

              const formatted = results
                .map(
                  (r, i) =>
                    `${i + 1}. **${r.title}**\n   ${decodeURIComponent(r.url)}\n   ${r.snippet}`
                )
                .join("\n\n");

              return {
                content: `Search results for "${query}":\n\n${formatted}`,
                data: { results },
              };
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              return {
                content: `Search failed: ${msg}`,
                data: { error: msg },
              };
            }
          },
        },
      ];
    },
  };
}

export default createSkill;
