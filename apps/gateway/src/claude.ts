import { spawn } from "bun";

export interface ClaudeOptions {
  prompt: string;
  systemPrompt?: string;
  sessionId?: string;
  mcpConfigPath: string;
  onToken?: (text: string) => void;
  signal?: AbortSignal;
}

export interface ClaudeResult {
  text: string;
  sessionId: string;
  costUsd?: number;
  model?: string;
}

/** Kill the Claude process if no output is received for 5 minutes. */
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

/** Kill the Claude process unconditionally after 30 minutes. */
const HARD_TIMEOUT = 30 * 60 * 1000;

const ALLOWED_TOOLS = [
  "mcp__ai-assistant__*",
  "Bash(*)",
  "Read",
  "Glob",
  "Grep",
  "WebSearch",
  "WebFetch",
  "Skill(*)",
];

const DISALLOWED_TOOLS = [
  "Bash(rm -rf *)",
  "Bash(rm -r *)",
  "Bash(rm -fr *)",
  "Bash(rmdir *)",
  "Bash(git push --force*)",
  "Bash(git push -f *)",
  "Bash(git reset --hard*)",
  "Bash(git clean -f*)",
  "Bash(git clean -df*)",
  "Bash(sudo *)",
  "Bash(su *)",
  "Bash(chmod 777 *)",
  "Bash(chown *)",
  "Bash(shutdown*)",
  "Bash(reboot*)",
  "Bash(killall *)",
  "Bash(scp *)",
  "Bash(rsync *)",
  "Bash(ssh *)",
  "Bash(npm publish*)",
  "Bash(bun publish*)",
];

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
    ...ALLOWED_TOOLS,
    "--disallowedTools",
    ...DISALLOWED_TOOLS,
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

  // --- Watchdog timers & abort signal ---
  let inactivityTimer = setTimeout(() => {
    proc.kill();
  }, INACTIVITY_TIMEOUT);

  const hardTimer = setTimeout(() => {
    proc.kill();
  }, HARD_TIMEOUT);

  const abortHandler = () => {
    proc.kill();
  };
  options.signal?.addEventListener("abort", abortHandler, { once: true });

  let fullText = "";
  let sessionId = "";
  let costUsd: number | undefined;
  let model: string | undefined;
  let lastMessageId = "";
  let lastSeenLength = 0;

  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Reset inactivity timer on every chunk of output
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      proc.kill();
    }, INACTIVITY_TIMEOUT);

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);

        if (event.type === "system" && event.subtype === "init") {
          sessionId = event.session_id || "";
        }

        if (event.type === "assistant" && event.message?.model) {
          model = event.message.model;
        }

        if (event.type === "assistant" && event.message?.content) {
          const msgId = event.message?.id || "";
          if (msgId !== lastMessageId) {
            lastMessageId = msgId;
            lastSeenLength = 0;
          }

          for (const block of event.message.content) {
            if (block.type === "text" && block.text) {
              const newText = block.text.slice(lastSeenLength);
              if (newText) {
                lastSeenLength = block.text.length;
                fullText += newText;
                options.onToken?.(newText);
              }
            }
          }
        }

        if (event.type === "result") {
          sessionId = event.session_id || sessionId;
          costUsd = event.total_cost_usd;
          model = event.model || model;
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
        model = event.model || model;
        if (event.result && !fullText) {
          fullText = String(event.result);
        }
      }
    } catch {
      // Ignore
    }
  }

  // --- Cleanup watchdog timers & abort handler ---
  clearTimeout(inactivityTimer);
  clearTimeout(hardTimer);
  options.signal?.removeEventListener("abort", abortHandler);

  const exitCode = await proc.exited;

  if (options.signal?.aborted) {
    throw new Error("Claude invocation was aborted");
  }
  if (exitCode !== 0 && !fullText) {
    throw new Error(`Claude process exited with code ${exitCode}`);
  }

  return { text: fullText, sessionId, costUsd, model };
}
