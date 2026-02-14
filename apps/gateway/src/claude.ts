import { spawn } from "bun";

export interface ClaudeOptions {
  prompt: string;
  systemPrompt?: string;
  sessionId?: string;
  mcpConfigPath: string;
  onToken?: (text: string) => void;
}

export interface ClaudeResult {
  text: string;
  sessionId: string;
  costUsd?: number;
}

export async function invokeClaude(options: ClaudeOptions): Promise<ClaudeResult> {
  const args = [
    "-p",
    options.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--mcp-config",
    options.mcpConfigPath,
    "--allowedTools",
    "mcp__ai-assistant__*",
    "Bash(*)",
    "Read",
    "Glob",
    "Grep",
    "WebSearch",
    "WebFetch",
    "Skill(*)",
  ];

  if (options.sessionId) {
    args.push("--resume", options.sessionId);
  }
  if (options.systemPrompt) {
    args.push("--system-prompt", options.systemPrompt);
  }

  // Unset CLAUDECODE to allow running inside another Claude Code session
  const env = { ...process.env };
  delete env.CLAUDECODE;

  const proc = spawn(["claude", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env,
  });

  let fullText = "";
  let sessionId = "";
  let costUsd: number | undefined;
  // Track the last seen text length per assistant message to compute deltas.
  // Each assistant event has cumulative text within that turn, but a new
  // assistant turn (after tool calls) starts fresh.
  let lastMessageId = "";
  let lastSeenLength = 0;

  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);

        // Extract session ID from init event
        if (event.type === "system" && event.subtype === "init") {
          sessionId = event.session_id || "";
        }

        // Extract text from assistant messages
        if (event.type === "assistant" && event.message?.content) {
          const msgId = event.message?.id || "";
          // New assistant turn - reset per-message tracking
          if (msgId !== lastMessageId) {
            lastMessageId = msgId;
            lastSeenLength = 0;
          }

          for (const block of event.message.content) {
            if (block.type === "text" && block.text) {
              // block.text is cumulative within this assistant turn
              const newText = block.text.slice(lastSeenLength);
              if (newText) {
                lastSeenLength = block.text.length;
                fullText += newText;
                options.onToken?.(newText);
              }
            }
          }
        }

        // Extract cost info from result event
        if (event.type === "result") {
          sessionId = event.session_id || sessionId;
          costUsd = event.total_cost_usd;
          if (event.result && !fullText) {
            fullText = String(event.result);
          }
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    try {
      const event = JSON.parse(buffer);
      if (event.type === "result") {
        sessionId = event.session_id || sessionId;
        costUsd = event.total_cost_usd;
        if (event.result && !fullText) {
          fullText = String(event.result);
        }
      }
    } catch {
      // Ignore
    }
  }

  await proc.exited;

  return { text: fullText, sessionId, costUsd };
}
