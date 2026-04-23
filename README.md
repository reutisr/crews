# Squad

A lightweight multi-agent CLI powered by [Claude Code](https://claude.ai/code). Define a team of specialized AI agents, point them at a task, and let them implement, test, review — and loop until the code is ready.

Works with any codebase, any language. Zero npm runtime dependencies.

## What makes Squad different

Most multi-agent tools are fan-out only — all agents run in parallel and you get N independent outputs. Squad adds two more patterns:

- **Sequential pipelines** — agents hand off to each other. Backend dev implements, QA writes tests using that output, architect reviews both.
- **Retry loops with verdict extraction** — a reviewer agent emits a `Verdict:` line. If it says "Needs fixes", the whole pipeline re-runs with targeted fix instructions prepended. Loops until "Ready to merge" or `maxRounds` is reached.

And because agents run as `claude --print` subprocesses, **action agents can actually read and write files** — they're not just producing text.

## Prerequisites

- Node.js 18+
- [Claude Code CLI](https://claude.ai/code) installed and authenticated (`claude --version` should work)

## Installation

```bash
# Option A — global install from npm
npm install -g squad-cli

# Option B — clone and link locally
git clone https://github.com/your-org/squad
cd squad && npm link
```

## Quick start

```bash
# 1. Set up .squad/ in your project
cd your-project
squad init

# 2. Edit .squad/directives.md with your project's rules
# (code style, security policies, testing conventions)

# 3. Scaffold some agents
squad create-agent backend-dev
squad create-agent code-reviewer
squad create-agent qa

# 4. Fill in each agent's charter, prompt, and config
# .squad/agents/backend-dev/charter.md   — role definition
# .squad/agents/backend-dev/prompt.md    — system prompt
# .squad/agents/backend-dev/config.json  — model, temperature, type

# 5. Create a task file (copy from examples/)
cp node_modules/squad-cli/examples/retry-loop.json my-task.json
# Edit description and context paths

# 6. Run it
squad run my-task.json
```

## Concepts

### Agents

An agent is a directory in `.squad/agents/<name>/` with three files:

| File | Purpose |
|------|---------|
| `charter.md` | Defines the agent's role, expertise, and boundaries. Injected into every message. |
| `prompt.md` | The system prompt passed to Claude. |
| `config.json` | Model, temperature, maxTokens, and **type** (`analysis` or `action`). |

**Agent types:**

- `analysis` — read-only. Gets `Read`, `Grep`, `Glob` tools only. Content of context files is embedded directly in the message.
- `action` — can read and write files, run commands. Gets `bypassPermissions` mode. Context files are passed as paths (agents read fresh disk state each round).

### Tasks

A task is a JSON file you create per feature or workflow:

```json
{
  "description": "Implement input validation for the /users endpoint",
  "agents": ["backend-dev", "qa", "code-reviewer"],
  "mode": "sequential",
  "context": ["src/routes/users.js", "test/routes/users.test.js"],
  "retry": {
    "maxRounds": 3,
    "reviewerAgent": "code-reviewer"
  },
  "finalAgents": ["git-push"],
  "aggregator": true
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `description` | Yes | What needs to be done. Be specific. |
| `agents` | Yes | Agent names in order (for sequential). |
| `mode` | Yes | `"parallel"` or `"sequential"` |
| `context` | No | File paths to inject as context. |
| `retry` | No | `{ maxRounds: 1–10, reviewerAgent: "name" }` — enables retry loop. Sequential only. |
| `finalAgents` | No | Agents to run once after the main loop (e.g. `git-push`). |
| `aggregator` | No | `true` to synthesize all outputs into `aggregated.md`. |
| `skills` | No | Skill names from `.claude/skills/<name>/SKILL.md` to inject. |
| `claude_md` | No | Paths to context files (like `AGENTS.md`) to inject into action agents. |

### Modes

**Parallel** — all agents run concurrently with the same input. Good for independent reviews.

```
task → [agent-1]  →  output-1
     → [agent-2]  →  output-2   →  aggregated.md (optional)
     → [agent-3]  →  output-3
```

**Sequential** — agents run in order, each receiving the previous agent's output.

```
task → [backend-dev] → output-1 → [qa] → output-2 → [architect] → output-3
```

**Retry loop** (sequential with `maxRounds > 1`) — loops until the reviewer says "Ready to merge":

```
Round 1: backend-dev → qa → architect → code-reviewer → "Needs fixes"
Round 2: backend-dev (with fix instructions) → qa → architect → code-reviewer → "Ready to merge"
         ↓
         finalAgents: git-push
```

The reviewer agent must emit a line starting with `Verdict:` — e.g. `Verdict: Ready to merge` or `Verdict: Needs fixes`. Multiple agents can emit verdicts; **all must agree** before the loop exits.

### Directives

`.squad/directives.md` — permanent project rules injected into every agent on every run. Use it for:

- Security policies
- Code style rules
- Testing conventions
- What agents must never do

### Decisions

`.squad/decisions.md` — accumulated architectural decisions. When the `architect` agent emits a `## New Decisions` section in its output, Squad auto-appends it here. This builds up institutional memory across runs without manual upkeep.

### Output

All outputs go to `.squad/output/<task-name>/`:

- Single-round: `backend-dev.md`, `qa.md`, `architect.md`, `aggregated.md`
- Multi-round: `round-1/`, `round-2/`, ..., `git-push.md`

Add `.squad/output/` to `.gitignore`.

## Project structure

```
your-project/
├── .squad/
│   ├── agents/
│   │   ├── backend-dev/
│   │   │   ├── charter.md
│   │   │   ├── prompt.md
│   │   │   └── config.json
│   │   └── code-reviewer/
│   │       ├── charter.md
│   │       ├── prompt.md
│   │       └── config.json
│   ├── directives.md     ← project rules for every agent
│   ├── decisions.md      ← auto-accumulated architectural decisions
│   └── output/           ← gitignored task outputs
└── tasks/
    ├── add-validation.json
    └── refactor-auth.json
```

## Example agents to build

| Agent | Type | Role |
|-------|------|------|
| `backend-dev` | action | Implements features, fixes bugs |
| `code-reviewer` | analysis | Gates the retry loop — emits `Verdict:` line |
| `qa` | action | Writes and runs tests |
| `architect` | analysis | Reviews design decisions, appends to `decisions.md` |
| `researcher` | analysis | Pre-implementation codebase research |
| `git-push` | action | Commits, pushes, opens PR — used as `finalAgent` |

## Environment variables

| Variable | Description |
|----------|-------------|
| `SQUAD_MOCK=true` | Dry-run mode — agents return mock output without calling Claude |

## Running tests

```bash
npm test
```

## License

MIT
