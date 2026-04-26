import fs from 'fs/promises';
import path from 'path';
import { runAgent } from './claude-runner.js';
import { createProgress } from '../utils/progress.js';

// Task 26b — centralised path helpers
export function getOutputDir(taskName) {
  return path.resolve(`.crews/output/${taskName}`);
}

export function getAgentOutputPath(taskName, agentName) {
  return path.join(getOutputDir(taskName), `${agentName}.md`);
}

// Task 71 — extract verdict from reviewer output
// Handles: "ready to merge" (code-reviewer), "compliant" (dr-compliance),
// "ready to merge" (product-manager skip), "Ready to merge" (task-verifier)
export function extractVerdict(reviewerOutput) {
  if (!reviewerOutput || typeof reviewerOutput !== 'string') {
    return 'needs-fixes'; // conservative default
  }

  const lines = reviewerOutput.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('Verdict:')) {
      const lower = line.toLowerCase();
      return (lower.includes('ready to merge') || lower.includes('compliant')) ? 'ready' : 'needs-fixes';
    }
  }

  return 'needs-fixes'; // conservative default
}

// Agents that emit a Verdict: line and whose verdict should gate the retry loop.
// reviewerAgent is still the source of fix instructions — these are checked for pass/fail.
const VERDICT_AGENTS = ['architect', 'dr-compliance', 'product-manager', 'code-reviewer', 'task-verifier'];

// Returns 'ready' only if ALL verdict agents pass. If any says needs-fixes, returns 'needs-fixes'.
export function aggregateVerdicts(results, reviewerAgentName) {
  for (const agentName of VERDICT_AGENTS) {
    const result = results.find((r) => r.agentName === agentName);
    if (!result || result.status !== 'complete') continue;
    const verdict = extractVerdict(result.output);
    if (verdict === 'needs-fixes') {
      if (agentName !== reviewerAgentName) {
        process.stderr.write(`[verdict] ${agentName} → needs-fixes\n`);
      }
      return 'needs-fixes';
    }
  }
  return 'ready';
}

// Task 26 — read context files
export async function readContextFiles(filePaths) {
  if (!filePaths || filePaths.length === 0) return [];

  return Promise.all(
    filePaths.map(async (filePath) => ({
      path: filePath,
      content: await fs.readFile(path.resolve(filePath), 'utf-8'),
    }))
  );
}

// Read .crews/directives.md — permanent project rules injected into every agent.
// Returns empty string if the file does not exist (graceful fallback).
export async function readDirectives() {
  try {
    return await fs.readFile(path.resolve('.crews/directives.md'), 'utf-8');
  } catch {
    return '';
  }
}

// Read .crews/decisions.md — accumulated architectural decisions from previous task runs.
// Returns empty string if the file does not exist.
export async function readDecisions() {
  try {
    return await fs.readFile(path.resolve('.crews/decisions.md'), 'utf-8');
  } catch {
    return '';
  }
}

// Read CLAUDE.md files for service-specific context (models, test commands, architecture).
// Paths listed in task.claude_md are always injected into action agents.
export async function readClaudeMd(filePaths) {
  if (!filePaths || filePaths.length === 0) return [];

  const results = await Promise.allSettled(
    filePaths.map(async (filePath) => ({
      path: filePath,
      content: await fs.readFile(path.resolve(filePath), 'utf-8'),
    }))
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
}

// Read skill SKILL.md files from .claude/skills/{name}/SKILL.md
// Skills are not auto-loaded when claude runs as --print subprocess, so we inject them.
export async function readSkills(skillNames) {
  if (!skillNames || skillNames.length === 0) return [];

  const results = await Promise.allSettled(
    skillNames.map(async (name) => {
      const skillPath = path.resolve(`.claude/skills/${name}/SKILL.md`);
      const content = await fs.readFile(skillPath, 'utf-8');
      return { name, path: skillPath, content };
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
}

// Task 27 — compose the user message for a single agent invocation
// For action agents (backend-dev, qa, task-verifier): pass file paths only so they
// re-read from disk each time (picks up changes made by previous agents in the same round).
// For analysis agents (architect, code-reviewer): embed full content as they are read-only.
// Skills are always embedded — they are not auto-loaded in --print subprocess mode.
export function composeMessage(task, agent, contextContents, previousOutput = null, prevAgentName = null, skills = [], directives = '', decisions = '', claudeMdContents = []) {
  let message = `## Task\n\n${task.description}\n\n## Your Role\n\n${agent.role}`;

  // Inject directives — permanent project rules every agent must follow
  if (directives) {
    message += `\n\n## Project Directives (always follow these)\n\n${directives}`;
  }

  // Inject architectural decisions from previous task runs
  if (decisions) {
    message += `\n\n## Architectural Decisions (from previous crews runs)\n\n${decisions}`;
  }

  // Inject skills — always embedded regardless of agent type
  for (const skill of skills) {
    message += `\n\n## Skill: ${skill.name}\n\n${skill.content}`;
  }

  // Inject CLAUDE.md service context — architecture, model locations, test commands
  for (const { path: filePath, content } of claudeMdContents) {
    message += `\n\n## Service Context: ${filePath}\n\n${content}`;
  }

  const isActionAgent = agent.config && agent.config.type === 'action';

  if (isActionAgent && contextContents.length > 0) {
    // Action agents have Read/Edit/Write tools — give them paths so they read fresh disk state
    const paths = contextContents.map(({ path: filePath }) => `- ${filePath}`).join('\n');
    message += `\n\n## Relevant Files (read these from disk before making changes)\n\n${paths}`;
  } else {
    // Analysis agents are read-only — embed content as reference
    for (const { path: filePath, content } of contextContents) {
      message += `\n\n## File: ${filePath}\n\n\`\`\`\n${content}\n\`\`\``;
    }
  }

  if (previousOutput !== null && prevAgentName !== null) {
    message += `\n\n## Previous Agent Output: ${prevAgentName}\n\n${previousOutput}\n\n---`;
  }

  return message;
}

// Task 28 — write a single agent's output to disk
export async function writeAgentOutput(outputDir, agentName, content) {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, `${agentName}.md`), content, 'utf-8');
}

const TRANSIENT_ERROR_PATTERNS = [
  /ssl certificate/i,
  /unable to connect/i,
  /connection refused/i,
  /network timeout/i,
  /econnreset/i,
  /econnrefused/i,
  /socket hang up/i,
  /api error/i,
];

function isTransientError(reason) {
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(reason));
}

// Task 29 — run a single agent and record progress
// Retries up to 2 times on transient network/API errors before giving up.
export async function runSingleAgent(agent, composedMessage, progress, maxRetries = 2) {
  progress.start(agent.name);
  const start = Date.now();

  let lastReason = '';

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const result = await runAgent({
      name: agent.name,
      systemPrompt: agent.prompt,
      model: agent.config.model,
      type: agent.config.type,
      userMessage: composedMessage,
      timeoutMs: agent.config.timeoutMs,
    });

    if (result.exitCode === 0) {
      const durationMs = Date.now() - start;
      progress.complete(agent.name);
      return { agentName: agent.name, output: result.output, durationMs, status: 'complete' };
    }

    lastReason = result.stderr || `exit code ${result.exitCode}`;

    if (attempt <= maxRetries && isTransientError(lastReason)) {
      const delaySec = attempt * 5;
      process.stderr.write(`[${agent.name}] transient error (attempt ${attempt}/${maxRetries + 1}), retrying in ${delaySec}s: ${lastReason}\n`);
      await new Promise((resolve) => { setTimeout(resolve, delaySec * 1000); });
    } else {
      break;
    }
  }

  const durationMs = Date.now() - start;
  progress.fail(agent.name, lastReason);
  return { agentName: agent.name, output: '', durationMs, status: 'error', error: lastReason };
}

// Task 30 — run all agents concurrently
export async function executeParallel(task, agents, contextContents, progress, outputDir, skills = [], directives = '', decisions = '', claudeMdContents = []) {
  const settled = await Promise.allSettled(
    agents.map((agent) => {
      const message = composeMessage(task, agent, contextContents, null, null, skills, directives, decisions, claudeMdContents);
      return runSingleAgent(agent, message, progress);
    })
  );

  const results = settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : { agentName: agents[i].name, output: '', durationMs: 0, status: 'error', error: s.reason?.message ?? 'unknown error' }
  );

  await Promise.all(
    results.map((r) => writeAgentOutput(outputDir, r.agentName, r.output))
  );

  return results;
}

// Task 31 — run agents one after another, passing each output to the next
export async function executeSequential(task, agents, contextContents, progress, outputDir, reviewFindings = null, skills = [], directives = '', decisions = '', claudeMdContents = []) {
  const results = [];
  let previousOutput = null;
  let prevAgentName = null;

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    let message = composeMessage(task, agent, contextContents, previousOutput, prevAgentName, skills, directives, decisions, claudeMdContents);

    // For the first agent in a retry round, prepend review findings if available
    if (i === 0 && reviewFindings) {
      message = `${reviewFindings}\n\n${message}`;
    }

    const result = await runSingleAgent(agent, message, progress);

    await writeAgentOutput(outputDir, agent.name, result.output);
    results.push(result);

    if (result.status === 'error') break;

    previousOutput = result.output;
    prevAgentName = agent.name;
  }

  return results;
}

// Task 32 — aggregate all agent outputs into a summary
export async function runAggregation(results, outputDir) {
  const combinedMessage = results
    .map((r) => `## Agent: ${r.agentName}\n\n${r.output}`)
    .join('\n\n---\n\n');

  const systemPrompt =
    'You are a technical lead summarizing a multi-agent review. Your output MUST include: ' +
    '(1) Key Agreements — what all agents agree on, ' +
    '(2) Conflicts — where agents disagree and your recommendation, ' +
    '(3) Critical Risks — highest-priority items ranked by severity, ' +
    '(4) Action Items — concrete next steps. Be concise and specific.';

  const result = await runAgent({
    name: 'aggregator',
    systemPrompt,
    model: 'claude-sonnet-4-6',
    type: 'analysis',
    userMessage: combinedMessage,
  });

  const aggregated = result.output;
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'aggregated.md'), aggregated, 'utf-8');

  return aggregated;
}

// Task 72 — retry loop for sequential execution
export async function executeWithRetry(task, agents, contextContents, progress, outputDir, skills = [], directives = '', decisions = '', claudeMdContents = []) {
  const rounds = [];
  let reviewFindings = null;

  for (let round = 1; round <= task.retry.maxRounds; round++) {
    const roundOutputDir = path.join(outputDir, `round-${round}`);

    process.stderr.write(`\n── Round ${round} of ${task.retry.maxRounds} ──────────────────────────\n`);

    // Execute sequential for this round
    const results = await executeSequential(task, agents, contextContents, progress, roundOutputDir, reviewFindings, skills, directives, decisions, claudeMdContents);

    // Find the reviewer agent result (used for fix instructions)
    const reviewerResult = results.find(r => r.agentName === task.retry.reviewerAgent);

    // Aggregate verdicts from ALL verdict-emitting agents — ready only if all pass
    const verdict = aggregateVerdicts(results, task.retry.reviewerAgent);

    const roundResult = { round, results, verdict };
    rounds.push(roundResult);

    // If ready to merge, we're done
    if (verdict === 'ready') {
      break;
    }

    // Build targeted findings for next round — pass only what each agent needs, not full history.
    // Full history bloats the context and dilutes focus across 5+ agents × multiple rounds.
    // Instead: extract the critical issues section from the reviewer, and test failures if any.
    if (round < task.retry.maxRounds && verdict === 'needs-fixes') {
      const reviewerOutput = reviewerResult ? reviewerResult.output : '';
      const testRunnerResult = results.find(r => r.agentName === 'test-runner');
      const testFailures = testRunnerResult && testRunnerResult.output.includes('Verdict: Tests failing')
        ? `## Test Failures (Round ${round})\n\n${testRunnerResult.output}`
        : '';

      // Extract only the Critical Issues section from the reviewer to keep context tight.
      // If no section found, fall back to the full reviewer output (capped at 3000 chars).
      const criticalMatch = reviewerOutput.match(/#+\s*Critical Issues[\s\S]*?(?=#+\s*(?:Minor|Test Coverage|Verdict)|$)/i);
      const criticalSection = criticalMatch
        ? criticalMatch[0].trim()
        : reviewerOutput.slice(0, 3000);

      reviewFindings = [
        `## Fix Instructions (Round ${round} review)`,
        `Fix only the issues listed below. Do not redo work that was already correct.`,
        `The files on disk already contain round ${round}'s implementation — read them before editing.\n`,
        criticalSection,
        testFailures,
      ].filter(Boolean).join('\n\n');
    }
  }

  return rounds;
}

// Task 33 — main entry point
export async function execute(task, agents, finalAgents = []) {
  const outputDir = getOutputDir(task.taskName);
  await fs.mkdir(outputDir, { recursive: true });

  const [contextContents, skills, directives, decisions, claudeMdContents] = await Promise.all([
    readContextFiles(task.context),
    readSkills(task.skills),
    readDirectives(),
    readDecisions(),
    readClaudeMd(task.claude_md),
  ]);

  if (skills.length > 0) {
    console.log(`Loaded skills: ${skills.map((s) => s.name).join(', ')}`);
  }
  if (directives) {
    console.log('Loaded directives from .crews/directives.md');
  }
  if (decisions) {
    console.log('Loaded decisions from .crews/decisions.md');
  }
  if (claudeMdContents.length > 0) {
    console.log(`Loaded CLAUDE.md: ${claudeMdContents.map((f) => f.path).join(', ')}`);
  }

  const progress = createProgress();

  let results;
  let rounds;

  if (task.mode === 'parallel') {
    // Warn if retry is set for parallel mode
    if (task.retry && task.retry.maxRounds > 1) {
      console.warn('Warning: retry is only supported in sequential mode. Running single-pass parallel execution.');
    }

    results = await executeParallel(task, agents, contextContents, progress, outputDir, skills, directives, decisions, claudeMdContents);
    rounds = null;
  } else if (task.mode === 'sequential' && task.retry.maxRounds > 1) {
    // Use retry loop for sequential mode when maxRounds > 1
    const roundResults = await executeWithRetry(task, agents, contextContents, progress, outputDir, skills, directives, decisions, claudeMdContents);
    rounds = roundResults;

    // Flatten the last round's results for backwards-compatible summary printing
    const lastRound = roundResults[roundResults.length - 1];
    results = lastRound ? lastRound.results : [];

    // Warn if max rounds exhausted without a passing verdict
    if (lastRound && lastRound.verdict === 'needs-fixes') {
      process.stderr.write(`\nWarning: max rounds (${task.retry.maxRounds}) reached — verdict is still "needs fixes". Final agents will not run.\n`);
    }
  } else {
    // Standard sequential execution (no retry)
    results = await executeSequential(task, agents, contextContents, progress, outputDir, null, skills, directives, decisions, claudeMdContents);
    rounds = null;
  }

  // Auto-append new architectural decisions from architect output to .crews/decisions.md
  const architectResult = results.find((r) => r.agentName === 'architect');
  if (architectResult && architectResult.status === 'complete') {
    const newDecisionsMatch = architectResult.output.match(/##\s*New Decisions[\s\S]*$/i);
    if (newDecisionsMatch) {
      try {
        const decisionsPath = path.resolve('.crews/decisions.md');
        await fs.appendFile(decisionsPath, `\n${newDecisionsMatch[0].trim()}\n`, 'utf-8');
        console.log('Updated .crews/decisions.md with new architectural decisions.');
      } catch {
        // Non-fatal — decisions.md update failure should not abort the run
      }
    }
  }

  // Run finalAgents once after the retry loop completes — only if verdict passed.
  // Skip if max rounds were exhausted with a failing verdict (e.g. don't git-push unreviewed code).
  const lastRoundVerdict = rounds ? rounds[rounds.length - 1]?.verdict : null;
  const finalAgentsBlocked = lastRoundVerdict === 'needs-fixes';

  if (finalAgents.length > 0 && !finalAgentsBlocked) {
    process.stderr.write('\n── Final agents ──────────────────────────────\n');
    const finalResults = await executeSequential(task, finalAgents, contextContents, progress, outputDir, null, skills, directives, decisions, claudeMdContents);
    results = [...results, ...finalResults];
  }

  let aggregated;
  if (task.aggregator) {
    aggregated = await runAggregation(results, outputDir);
  }

  progress.summary();

  return { results, aggregated, outputDir, rounds };
}
