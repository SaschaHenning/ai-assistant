<!-- JASP Shared Rules Auto-Setup -->
<!-- DO NOT REMOVE: This block ensures shared AI rules are available for all developers -->

> **Auto-setup check:** At the start of every conversation, verify that `.claude/shared-rules.md` exists and is a valid symlink (not broken). If it is missing or broken:
>
> 1. Find JASP-Shared: `find ~ -maxdepth 4 -type d -name "JASP-Shared" 2>/dev/null | head -5`
> 2. If not found, clone it as a sibling of this project: `git clone https://github.com/JASP-eu/JASP-Shared.git ../JASP-Shared`
> 3. Pull latest: `cd <SHARED_DIR> && git pull && cd -`
> 4. Create symlinks:
>    - `mkdir -p .claude && ln -sf <SHARED_DIR>/AI-Rules/CLAUDE.md .claude/shared-rules.md`
>    - `mkdir -p .claude/agents`
>    - `ln -sf <SHARED_DIR>/AI-Rules/agents/quality.md .claude/agents/quality.md`
>    - `ln -sf <SHARED_DIR>/AI-Rules/agents/security.md .claude/agents/security.md`
>    - `ln -sf <SHARED_DIR>/AI-Rules/agents/frontend.md .claude/agents/frontend.md`
>    - `ln -sf <SHARED_DIR>/AI-Rules/agents/backend.md .claude/agents/backend.md`
>    - `ln -sf <SHARED_DIR>/AI-Rules/agents/devops.md .claude/agents/devops.md`
>    - `ln -sf <SHARED_DIR>/AI-Rules/agents/testing.md .claude/agents/testing.md`
> 5. Tell the user: "Shared AI rules were missing — I've set them up automatically."
>
> If `.claude/shared-rules.md` exists and is valid, skip this silently — do not mention it.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal AI Assistant Gateway — a Bun/TypeScript monorepo that routes messages from multiple platforms (Telegram, web) through Claude CLI with a plugin-based skill system via Model Context Protocol (MCP).

## Commands

```bash
# Development (starts gateway + web + all skills in watch mode)
bun run dev

# Start gateway only
bun run --watch apps/gateway/src/index.ts

# Start web dev server
cd apps/web && bun run dev

# Database migrations
cd packages/db && bunx drizzle-kit generate   # generate migration after schema change
cd packages/db && bun run src/migrate.ts       # apply migrations (also runs on gateway startup)

# TypeScript checking (composite project references)
bunx tsc -b packages/db                       # rebuild single package
bunx tsc --noEmit -p apps/gateway/tsconfig.json

# Tests
bun run test-runner.ts

# Build all
bun run build
```

## Architecture

```
apps/gateway/     → Hono HTTP server (port 4300) + MCP server (port 4301)
apps/web/         → React 19 + Vite + Tailwind (port 4302, proxies /api to gateway)
packages/core/    → Shared types: Skill, NormalizedMessage, Platform, SkillContext
packages/db/      → Drizzle ORM + SQLite (Bun native), schema + migrations
packages/skill-runtime/ → Skill loader, registry, MCP server bridge
skills/           → Plugin directory, each skill has index.ts + meta.json
```

### Message Flow

1. Platform connector (Telegram/web) receives message → `NormalizedMessage`
2. `handleIncomingMessage()` in `handler.ts` saves to DB, looks up session
3. `invokeClaude()` spawns `claude` CLI with `--mcp-config`, `--allowedTools`, `--disallowedTools`, `--resume`
4. Claude can call skill tools via MCP (registered from `skills/` directory)
5. Response streamed back, saved to DB, logged to `request_logs`, sent to platform
6. Platform-specific formatting: Telegram gets HTML instructions, web gets Markdown

### Skill System

Skills are self-contained plugins in `skills/`. Each exports a factory function returning a `Skill` interface with `start()`, `stop()`, `getTools()`, and optionally `onMessage()` for connectors. Skills are loaded dynamically at startup by `skill-runtime/loader.ts` and registered as MCP tools.

Two types: **connectors** (receive messages from platforms) and **tools** (provide capabilities to Claude).

### Database

SQLite via Drizzle ORM. Tables: `channels`, `messages`, `sessions` (Claude CLI `--resume`), `skills`, `request_logs`. Schema in `packages/db/src/schema.ts`. Migrations in `packages/db/drizzle/`. WAL mode enabled.

After changing the schema, rebuild the db package with `bunx tsc -b packages/db` so downstream apps pick up the new types.

## Ports

| Service     | Port | Env Variable   |
|-------------|------|----------------|
| Gateway API | 4300 | `GATEWAY_PORT` |
| MCP Server  | 4301 | `MCP_PORT`     |
| Web UI      | 4302 | (vite.config)  |

Ports are also set in `.env` — that takes precedence over defaults in code.

## Key Conventions

- **Runtime**: Bun everywhere (no Node). Use `bun:sqlite`, `Bun.serve()`, `Bun.spawn()`.
- **Workspace imports**: `@ai-assistant/core`, `@ai-assistant/db`, `@ai-assistant/skill-runtime`
- **TypeScript**: ESNext target, composite project references. Gateway/packages extend root tsconfig; web has its own.
- **Web UI**: Tailwind CSS utility classes, dark theme (gray-800/900 palette). No component library.
- **Telegram formatting**: HTML parse mode (`<b>`, `<i>`, `<code>`, `<pre>`), not Markdown.
- **Claude CLI integration**: Spawned as subprocess with `--stream-json` output format. Allowed/disallowed tool lists in `claude.ts`.
- **Skill validation**: AI-generated skills are validated against forbidden patterns (see `skill-runtime/validator.ts`).
- **mcp.json**: Auto-generated at gateway startup, do not edit manually.
- **Versioning**: Uses the `VERSION` file in the repo root as single source of truth.


## Output Files

When creating files as task output (reports, exports, generated content, etc.):
- **Requires** `OUTPUT_DIR` to be set in `.env` (e.g. `/Users/you/Desktop/AI-Assistant`)
- Create a **task-specific subfolder** inside `$OUTPUT_DIR/`
- Put all output files in that subfolder
- In the response, reference the save location using `$OUTPUT_DIR_LABEL/<task-folder>/` (defaults to the last two path segments of `OUTPUT_DIR`)
- If `OUTPUT_DIR` is not set, ask the user where to save output files
