# Writing Agents

Every agent in `.crews/agents/<name>/` is just three files. This guide explains what goes in each, how to pick the right type, and walks through building a new agent from scratch.

## The three files

```
.crews/agents/security-reviewer/
├── role.md       — who this agent is and what it focuses on
├── prompt.md     — the system prompt Claude receives
└── config.json   — model, type, and optional timeout
```

### `role.md` — who the agent is

This is injected into every message alongside the task. Think of it as the agent's job description: what it knows, what it does, and — critically — what it does **not** do.

A good `role.md` has three sections:

```markdown
# security-reviewer

## Role

Security engineer reviewing code for vulnerabilities before merge. Finds issues a penetration tester would find — before the code ships.

## Expertise

- Input validation: SQL injection, XSS, command injection risks
- Authentication and authorization gaps: missing checks, broken tenant scoping
- Secrets and credential handling: hardcoded values, insecure storage
- Dependency risks: known-vulnerable packages, unsafe usage patterns

## Boundaries

- Do NOT modify files — review and annotate only
- Do NOT suggest refactoring or performance improvements — focus on security only
- Every finding MUST include: file path, function name, vulnerability type, and a concrete fix
- End output with: `Verdict: Ready to merge` or `Verdict: Needs fixes`
```

**Tips for `role.md`:**
- Be specific about expertise — "security" is too vague, "SQL injection and auth gaps" is actionable
- Boundaries prevent agents from stepping on each other (e.g. backend-dev doesn't write tests, qa doesn't implement features)
- If the agent should gate the retry loop, say so explicitly in Boundaries: `End output with: Verdict: Ready to merge or Verdict: Needs fixes`

---

### `prompt.md` — the system prompt

This is the full system prompt passed to Claude. Where `role.md` says *who* the agent is, `prompt.md` says *how* to do the work: what to check, in what order, and what to output.

```markdown
You are a security engineer. Your goal is to find vulnerabilities a penetration tester would find. Do NOT modify any files.

Use your Read tool to read the actual files from disk — do not rely solely on what was embedded in the context.

## Review Checklist

**Injection risks**
- Are all user inputs validated and sanitised before use in queries or commands?
- Is parameterised SQL used everywhere — no string concatenation in queries?
- Is user-controlled data ever passed to shell commands?

**Authentication & authorisation**
- Is every endpoint protected by an auth check?
- Are tenant/org scoping checks applied to every database query?
- Could a user access another user's data by changing an ID in the request?

**Secrets & credentials**
- Are there hardcoded tokens, passwords, or API keys?
- Are secrets read from environment variables, not config files?

**Dependencies**
- Are there `require`/`import` patterns that bring in deprecated or unsafe modules?

## Output Format

1. **Summary** — 2-3 sentences on overall security posture
2. **Critical Issues** (must fix before merge) — each with: file, function/line, vulnerability type, exact fix
3. **Low-severity Issues** — same format
4. **Verdict** — exactly one of:
   - `Verdict: Ready to merge`
   - `Verdict: Needs fixes`
```

**Tips for `prompt.md`:**
- Give it a concrete checklist — open-ended prompts produce inconsistent output
- Specify the output format explicitly — this makes outputs readable and parseable
- For `action` agents: tell it to use Read before Edit, and to verify changes on disk before finishing
- For `analysis` agents: tell it not to modify files (Claude will respect this with `--allowed-tools`)

---

### `config.json` — model and type

```json
{
  "model": "claude-opus-4-6",
  "type": "analysis",
  "timeoutMs": 120000
}
```

| Field | Required | Values |
|-------|----------|--------|
| `model` | Yes | Any Claude model ID, e.g. `claude-sonnet-4-6`, `claude-opus-4-6` |
| `type` | Yes | `"analysis"` or `"action"` — see below |
| `timeoutMs` | No | Milliseconds before the agent is killed. Default: no timeout |

---

## Choosing a type: `analysis` vs `action`

This is the most important decision when writing an agent.

| | `analysis` | `action` |
|---|---|---|
| **Tools available** | Read, Grep, Glob | All tools + bypassPermissions |
| **Can write files?** | No | Yes |
| **Context files** | Embedded as full content | Passed as file paths (reads fresh from disk) |
| **Use for** | Reviewers, planners, verifiers | Implementers, test runners, git agents |
| **Model recommendation** | Opus (better reasoning) | Sonnet (faster, sufficient for execution) |

**Use `analysis` when** the agent only needs to read and reason — code reviewers, architects, compliance checkers, product managers. These agents cannot accidentally modify your codebase.

**Use `action` when** the agent needs to write files, run tests, or execute commands — backend developers, QA agents, test runners, git-push agents.

> Action agents receive context file **paths** instead of embedded content. This is intentional: in a retry loop, round 2's action agent needs to read what round 1 wrote to disk. Passing paths ensures it always sees the freshest state.

---

## Verdict agents — gating the retry loop

Any agent can gate the retry loop by emitting a `Verdict:` line. The engine scans all outputs after each round and exits only when **all** verdict agents agree.

To make your agent a verdict agent:

1. Add this to `role.md` Boundaries:
   ```
   End output with: `Verdict: Ready to merge` or `Verdict: Needs fixes`
   ```

2. Add this to `prompt.md` output format:
   ```
   **Verdict** — exactly one of:
   - `Verdict: Ready to merge`
   - `Verdict: Needs fixes`
   ```

The engine recognises these verdict agents by name: `architect`, `dr-compliance`, `product-manager`, `code-reviewer`, `task-verifier`. If you create a new agent that should gate the loop, name it one of these — or add your agent's name to the `VERDICT_AGENTS` list in `src/core/execution-engine.js`.

---

## Worked example: `security-reviewer`

**Step 1 — scaffold the agent:**
```bash
crews create-agent security-reviewer
```

**Step 2 — write `role.md`:**
```markdown
# security-reviewer

## Role

Security engineer reviewing code for vulnerabilities before merge.

## Expertise

- SQL injection, XSS, command injection risks
- Missing auth/authorisation checks and broken tenant scoping
- Hardcoded secrets and insecure credential handling

## Boundaries

- Do NOT modify files — review and annotate only
- Do NOT suggest performance or style improvements — security only
- Every finding MUST include: file path, function name, vulnerability type, and a concrete fix
- End output with: `Verdict: Ready to merge` or `Verdict: Needs fixes`
```

**Step 3 — write `prompt.md`:**
```markdown
You are a security engineer. Find vulnerabilities before they ship. Do NOT modify any files.

Use your Read tool to read the actual files from disk.

## Checklist

- Are all user inputs validated before use in queries or commands?
- Is parameterised SQL used everywhere?
- Is every endpoint protected by an auth check?
- Are tenant/org scoping checks applied to every query?
- Are there hardcoded tokens, passwords, or API keys?

## Output Format

1. **Summary** — overall security posture in 2-3 sentences
2. **Critical Issues** — file, function/line, vulnerability type, exact fix
3. **Low-severity Issues** — same format
4. **Verdict** — exactly one of:
   - `Verdict: Ready to merge`
   - `Verdict: Needs fixes`
```

**Step 4 — write `config.json`:**
```json
{
  "model": "claude-opus-4-6",
  "type": "analysis",
  "timeoutMs": 120000
}
```

**Step 5 — add it to a task:**
```json
{
  "taskName": "add-user-endpoint",
  "description": "Implement POST /users with input validation",
  "agents": ["backend-dev", "qa", "security-reviewer", "code-reviewer"],
  "mode": "sequential",
  "context": ["src/routes/users.js"],
  "retry": {
    "maxRounds": 3,
    "reviewerAgent": "code-reviewer"
  }
}
```

`code-reviewer` is the verdict agent here — it gates the retry loop. `security-reviewer` runs and produces findings, but its output does not affect the verdict. If you want `security-reviewer` to gate the loop too, add it to the `VERDICT_AGENTS` list in `src/core/execution-engine.js`.

---

## Common patterns

### Passing output between agents

In sequential mode, each agent automatically receives the previous agent's full output. You don't need to do anything — it's injected as `## Previous Agent Output: <name>` in the message. Reference it in your `prompt.md`:

```markdown
A previous agent has already implemented the feature. Read their output for context,
then read the actual files from disk to see the current state.
```

### Agents that run once at the end

Use `finalAgents` in your task for agents that should run exactly once after the retry loop completes — but only if the verdict passed. If max rounds are exhausted with a failing verdict, final agents are skipped and a warning is printed. The `git-push` agent is the canonical example: commit, push, open PR.

```json
{
  "finalAgents": ["git-push"]
}
```

### Sharing rules across all agents

Don't repeat rules in every agent's `prompt.md`. Put project-wide rules in `.crews/directives.md` — they're injected into every agent automatically:

```markdown
# Project Directives

- Always use parameterised queries — never string-concatenate SQL
- All API routes require authentication middleware
- Use the existing logger, never console.log
- Run `npm run lint` after making changes
```

### Building institutional memory

The `architect` agent auto-appends its `## New Decisions` section to `.crews/decisions.md` after each run. If you have a custom architect-style agent, follow the same pattern in its `prompt.md`:

```markdown
If you make any architectural decisions during this task, append them under:

## New Decisions
- <date>: <decision and rationale>
```
