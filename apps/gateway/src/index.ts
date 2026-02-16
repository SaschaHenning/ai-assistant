import { Hono } from "hono";
import { cors } from "hono/cors";
import { join, resolve } from "path";
import type { NormalizedMessage } from "@ai-assistant/core";
import { getDb, runMigrations } from "@ai-assistant/db";
import { SkillRegistry, loadSkills, createMcpServer } from "@ai-assistant/skill-runtime";
import { createSkillContext, registerMessageSender, messageSenders } from "./context";
import { handleIncomingMessage } from "./handler";
import { createChatRoutes } from "./routes/chat";
import { createLogRoutes } from "./routes/logs";
import { createKnowledgeRoutes } from "./routes/knowledge";
import { createSkillRoutes } from "./routes/skills";
import { createJobRoutes } from "./routes/jobs";
import { createTaskRoutes } from "./routes/tasks";
import { JobScheduler } from "./scheduler";
import { TaskQueue } from "./task-queue";

const GATEWAY_PORT = Number(process.env.GATEWAY_PORT) || 4300;
const MCP_PORT = Number(process.env.MCP_PORT) || 4301;
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

  // Create per-channel task queue for non-blocking message processing
  const taskQueue = new TaskQueue();

  // Manage typing indicators via task queue lifecycle events
  const typingIntervals = new Map<string, Timer>();

  taskQueue.on("task:started", ({ task, channelId }: { task: { platform?: string }; channelId: string }) => {
    if (task.platform === "web") return;
    const sendTyping = async () => {
      const skill = registry.get("telegram");
      if (!skill) return;
      const tool = skill.getTools().find((t) => t.name === "send_chat_action");
      if (!tool) return;
      try {
        await tool.execute({ chatId: channelId, action: "typing" }, context);
      } catch {}
    };
    sendTyping();
    const interval = setInterval(sendTyping, 4000);
    typingIntervals.set(channelId, interval);
  });

  const stopTyping = ({ channelId }: { channelId: string }) => {
    const interval = typingIntervals.get(channelId);
    if (interval) {
      clearInterval(interval);
      typingIntervals.delete(channelId);
    }
  };

  taskQueue.on("task:completed", stopTyping);
  taskQueue.on("task:failed", stopTyping);
  taskQueue.on("task:cancelled", stopTyping);

  // Deliver results/errors back to the user via task queue events
  // Web tasks handle their own response via SSE, so skip them here
  taskQueue.on("task:completed", ({ task, channelId }: { task: { result?: string; platform?: string }; channelId: string }) => {
    if (task.platform === "web") return;
    if (task.result) {
      context.sendMessage(channelId, task.result).catch((err) =>
        console.error("Failed to send task result:", err)
      );
    }
  });

  taskQueue.on("task:failed", ({ task, channelId }: { task: { error?: string; platform?: string }; channelId: string }) => {
    if (task.platform === "web") return;
    const errorText = task.error || "Unknown error";
    context.sendMessage(channelId, `Sorry, something went wrong: ${errorText}`).catch((err) =>
      console.error("Failed to send error message:", err)
    );
  });

  taskQueue.on("task:cancelled", ({ task, channelId }: { task: { platform?: string }; channelId: string }) => {
    if (task.platform === "web") return;
    context.sendMessage(channelId, "Task was cancelled.").catch((err) =>
      console.error("Failed to send cancellation message:", err)
    );
  });

  // Wire up connector message handlers — fire-and-forget via task queue
  for (const connector of registry.getConnectors()) {
    if (connector.onMessage) {
      connector.onMessage(async (msg: NormalizedMessage) => {
        taskQueue.enqueue(
          msg.channelId,
          async (signal) => {
            const result = await handleIncomingMessage({
              message: msg,
              db,
              mcpConfigPath: MCP_CONFIG_PATH,
              signal,
            });
            return result.text;
          },
          {
            messagePreview: msg.text.slice(0, 200),
            platform: msg.platform,
            userName: msg.userName,
          }
        );
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

  // Initialize job scheduler
  const scheduler = new JobScheduler({
    db,
    mcpConfigPath: MCP_CONFIG_PATH,
    messageSenders,
    sendTypingAction: async (platform, chatId) => {
      if (platform !== "telegram") return;
      const skill = registry.get("telegram");
      if (!skill) return;
      const tool = skill.getTools().find((t) => t.name === "send_chat_action");
      if (!tool) return;
      await tool.execute({ chatId, action: "typing" }, context);
    },
  });
  await scheduler.start();

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
  app.route("/api/chat", createChatRoutes(db, MCP_CONFIG_PATH, taskQueue));
  app.route("/api/logs", createLogRoutes(db));
  app.route("/api/knowledge", createKnowledgeRoutes(db));
  app.route("/api/skills", createSkillRoutes(registry));
  app.route("/api/jobs", createJobRoutes(db, scheduler));
  app.route("/api/tasks", createTaskRoutes(taskQueue));

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
  console.log("  GET  /api/jobs");
  console.log("  GET  /api/tasks");

  // Graceful shutdown — handle both SIGINT (Ctrl+C) and SIGTERM (turbo/process manager)
  const shutdown = async () => {
    console.log("\nShutting down...");
    taskQueue.destroy();
    await scheduler.stop();
    await registry.stopAll();
    await mcp.close();
    server.stop();
    mcpServer.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
