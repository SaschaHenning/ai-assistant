import { Hono } from "hono";
import { cors } from "hono/cors";
import { join, resolve } from "path";
import type { NormalizedMessage } from "@ai-assistant/core";
import { getDb, runMigrations } from "@ai-assistant/db";
import { SkillRegistry, loadSkills, createMcpServer } from "@ai-assistant/skill-runtime";
import { createSkillContext, registerMessageSender } from "./context";
import { handleIncomingMessage } from "./handler";
import { createChatRoutes } from "./routes/chat";
import { createLogRoutes } from "./routes/logs";
import { createMemoryRoutes } from "./routes/memory";
import { createSkillRoutes } from "./routes/skills";

const GATEWAY_PORT = Number(process.env.GATEWAY_PORT) || 3000;
const MCP_PORT = Number(process.env.MCP_PORT) || 3001;
const PROJECT_ROOT = resolve(import.meta.dir, "../../..");
const SKILLS_DIR = join(PROJECT_ROOT, "skills");
const MCP_CONFIG_PATH = join(PROJECT_ROOT, "mcp.json");
const DB_PATH = process.env.DATABASE_PATH || join(PROJECT_ROOT, "data", "assistant.db");

async function main() {
  console.log("Starting AI Assistant Gateway...");

  // Ensure data directory exists
  const dataDir = join(PROJECT_ROOT, "data");
  await Bun.write(join(dataDir, ".gitkeep"), "");

  // Initialize database
  const db = getDb(DB_PATH);
  console.log("Database initialized");

  // Run migrations
  try {
    runMigrations(db, join(PROJECT_ROOT, "packages/db/drizzle"));
    console.log("Database migrations applied");
  } catch (err) {
    console.warn("Migration warning:", err);
  }

  // Load skills
  const registry = new SkillRegistry();
  const skills = await loadSkills(SKILLS_DIR);
  for (const skill of skills) {
    registry.register(skill);
  }
  console.log(`Loaded ${skills.length} skills`);

  // Create skill context
  const context = createSkillContext(db);

  // Start all skills
  await registry.startAll(context);

  // Wire up connector message handlers - when a connector receives a message,
  // invoke Claude via the handler and send the response back
  for (const connector of registry.getConnectors()) {
    if (connector.onMessage) {
      connector.onMessage(async (msg: NormalizedMessage) => {
        try {
          const result = await handleIncomingMessage({
            message: msg,
            db,
            mcpConfigPath: MCP_CONFIG_PATH,
          });
          // Send response back through the connector
          await context.sendMessage(msg.channelId, result.text);
        } catch (err) {
          console.error("Error handling message:", err);
          await context.sendMessage(
            msg.channelId,
            "Sorry, something went wrong processing your message."
          );
        }
      });
    }
  }

  // Register platform-specific message senders
  registerMessageSender("telegram", async (channelId, text) => {
    const telegramSkill = registry.get("telegram");
    if (telegramSkill) {
      const tools = telegramSkill.getTools();
      const sendTool = tools.find((t) => t.name === "send_telegram_message");
      if (sendTool) {
        await sendTool.execute({ chatId: channelId, text }, context);
      }
    }
  });

  // Create and start MCP server
  const mcp = createMcpServer(registry, context);

  // Write mcp.json config for Claude CLI
  await Bun.write(
    MCP_CONFIG_PATH,
    JSON.stringify(
      {
        mcpServers: {
          "ai-assistant": {
            type: "http",
            url: `http://localhost:${MCP_PORT}/mcp`,
          },
        },
      },
      null,
      2
    )
  );
  console.log(`MCP config written to ${MCP_CONFIG_PATH}`);

  // Start MCP HTTP server on its own port
  const mcpServer = Bun.serve({
    port: MCP_PORT,
    idleTimeout: 255,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/mcp") {
        return mcp.handleRequest(req);
      }
      return new Response("Not Found", { status: 404 });
    },
  });
  console.log(`MCP server running on http://localhost:${MCP_PORT}/mcp`);

  // Create Hono gateway app
  const app = new Hono();

  // Middleware
  app.use("*", cors());

  // Health check
  app.get("/health", (c) => c.json({ status: "ok", skills: registry.getAll().length }));

  // Routes
  app.route("/api/chat", createChatRoutes(db, MCP_CONFIG_PATH));
  app.route("/api/logs", createLogRoutes(db));
  app.route("/api/memory", createMemoryRoutes());
  app.route("/api/skills", createSkillRoutes(registry));

  // Start gateway HTTP server
  const server = Bun.serve({
    port: GATEWAY_PORT,
    fetch: app.fetch,
    idleTimeout: 255, // Claude CLI can take a while to respond
  });

  console.log(`Gateway running on http://localhost:${GATEWAY_PORT}`);
  console.log("Available routes:");
  console.log("  GET  /health");
  console.log("  POST /api/chat");
  console.log("  GET  /api/logs");
  console.log("  GET  /api/skills");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await registry.stopAll();
    await mcp.close();
    server.stop();
    mcpServer.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
