import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { SkillRegistry } from "./registry";
import type { SkillContext } from "@ai-assistant/core";

export interface McpServerInstance {
  handleRequest: (req: Request) => Promise<Response>;
  close: () => Promise<void>;
}

function buildServer(registry: SkillRegistry, context: SkillContext): McpServer {
  const server = new McpServer({
    name: "ai-assistant",
    version: "1.0.0",
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

export function createMcpServer(
  registry: SkillRegistry,
  context: SkillContext
): McpServerInstance {
  const tools = registry.getAllTools();
  context.log.info(`MCP server registered ${tools.size} tools`);

  // Session-based: map session IDs to transport+server pairs
  const sessions = new Map<
    string,
    { server: McpServer; transport: WebStandardStreamableHTTPServerTransport }
  >();

  async function handleRequest(req: Request): Promise<Response> {
    // Check for existing session
    const sessionId = req.headers.get("mcp-session-id");

    if (sessionId && sessions.has(sessionId)) {
      // Existing session - reuse transport
      const session = sessions.get(sessionId)!;
      return session.transport.handleRequest(req);
    }

    // New session - create server + transport
    const server = buildServer(registry, context);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { server, transport });
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
    for (const [, session] of sessions) {
      try {
        await session.server.close();
      } catch {
        // Ignore
      }
    }
    sessions.clear();
  }

  return { handleRequest, close };
}
