import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { SkillRegistry } from "./registry";
import type { SkillContext } from "@ai-assistant/core";

export interface McpServerInstance {
  handleRequest: (req: Request) => Promise<Response>;
  close: () => Promise<void>;
}

/** Reap idle MCP sessions after 10 minutes */
const SESSION_TTL_MS = 10 * 60 * 1000;

/** Check for stale sessions every 2 minutes */
const REAP_INTERVAL_MS = 2 * 60 * 1000;

function buildServer(registry: SkillRegistry, context: SkillContext, version: string): McpServer {
  const server = new McpServer({
    name: "ai-assistant",
    version,
  });

  // Register all skill tools as MCP tools
  const tools = registry.getAllTools();
  for (const [name, toolDef] of tools) {
    server.registerTool(
      name,
      {
        description: toolDef.description,
        inputSchema: toolDef.inputSchema,
      },
      async (input) => {
        const result = await toolDef.execute(input, context);
        return {
          content: [{ type: "text" as const, text: result.content }],
        };
      }
    );
  }

  return server;
}

interface SessionEntry {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  lastActivityAt: number;
}

export function createMcpServer(
  registry: SkillRegistry,
  context: SkillContext,
  version = "1.0.0"
): McpServerInstance {
  const tools = registry.getAllTools();
  context.log.info(`MCP server registered ${tools.size} tools`);

  // Session-based: map session IDs to transport+server pairs
  const sessions = new Map<string, SessionEntry>();

  // Periodic reaper for stale sessions
  const reapTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivityAt > SESSION_TTL_MS) {
        context.log.info(`[mcp] Reaping stale session ${id} (idle ${Math.round((now - session.lastActivityAt) / 1000)}s)`);
        session.server.close().catch(() => {});
        session.transport.close?.().catch(() => {});
        sessions.delete(id);
      }
    }
  }, REAP_INTERVAL_MS);

  async function handleRequest(req: Request): Promise<Response> {
    // Check for existing session
    const sessionId = req.headers.get("mcp-session-id");

    if (sessionId && sessions.has(sessionId)) {
      // Existing session - reuse transport, update activity timestamp
      const session = sessions.get(sessionId)!;
      session.lastActivityAt = Date.now();
      return session.transport.handleRequest(req);
    }

    // New session - create server + transport
    const server = buildServer(registry, context, version);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { server, transport, lastActivityAt: Date.now() });
      },
    });

    // Clean up on close
    transport.onclose = () => {
      for (const [id, s] of sessions) {
        if (s.transport === transport) {
          sessions.delete(id);
          break;
        }
      }
    };

    await server.connect(transport);
    return transport.handleRequest(req);
  }

  async function close() {
    clearInterval(reapTimer);
    for (const [, session] of sessions) {
      try {
        await session.server.close();
        await session.transport.close?.();
      } catch {
        // Ignore
      }
    }
    sessions.clear();
  }

  return { handleRequest, close };
}
