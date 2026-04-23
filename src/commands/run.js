import { isClaudeAvailable } from '../core/claude-runner.js';
import { loadTask } from '../core/task-loader.js';
import { loadAgents } from '../core/agent-loader.js';
import { execute, getAgentOutputPath, getOutputDir } from '../core/execution-engine.js';

function formatDuration(ms) {
  return (ms / 1000).toFixed(1) + 's';
}

function printSummary(results, outputDir, aggregated, task, rounds) {
  process.stdout.write('\n');

  // If we have multiple rounds, print round-by-round summary
  if (rounds && rounds.length > 1) {
    process.stdout.write('Round-by-Round Summary:\n');
    process.stdout.write('═══════════════════════\n\n');

    for (const roundResult of rounds) {
      const agentNames = roundResult.results.map(r => r.agentName).join(', ');
      const verdictText = roundResult.verdict === 'ready' ? 'Ready to merge' : 'Needs fixes';
      process.stdout.write(`Round ${roundResult.round}: [${agentNames}] → Verdict: ${verdictText}\n`);
    }

    const totalRounds = rounds.length;
    const finalVerdict = rounds[rounds.length - 1].verdict;
    const finalVerdictText = finalVerdict === 'ready' ? 'Ready to merge' : 'Needs fixes';

    process.stdout.write(`\nTotal rounds: ${totalRounds}\n`);
    process.stdout.write(`Final verdict: ${finalVerdictText}\n\n`);
  }

  // Standard table summary (always shown)
  process.stdout.write('Agent            Status     Duration   Output\n');
  process.stdout.write('───────────────  ─────────  ─────────  ──────────────────────────────\n');

  for (const r of results) {
    const name = r.agentName.padEnd(15);
    const status = r.status === 'complete' ? '✓ done    ' : '✗ error   ';
    const duration = formatDuration(r.durationMs).padEnd(9);
    const outputFile = r.status === 'complete'
      ? getAgentOutputPath(task.taskName, r.agentName)
      : r.error ?? 'failed';
    process.stdout.write(`${name}  ${status}  ${duration}  ${outputFile}\n`);
  }

  if (aggregated !== undefined) {
    process.stdout.write(`\nAggregated summary → ${getOutputDir(task.taskName)}/aggregated.md\n`);
  }

  process.stdout.write('\n');
}

export async function run(taskFile) {
  if (!taskFile) {
    process.stderr.write('Usage: squad run <task-file>\n');
    process.exit(1);
  }

  const available = await isClaudeAvailable();
  if (!available) {
    process.stderr.write('Error: Claude Code CLI not found. Install it from https://claude.ai/code\n');
    process.exit(1);
  }

  let task;
  try {
    task = await loadTask(taskFile);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  let agents;
  try {
    agents = await loadAgents(task.agents);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  let finalAgents = [];
  if (task.finalAgents && task.finalAgents.length > 0) {
    try {
      finalAgents = await loadAgents(task.finalAgents);
    } catch (err) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
  }

  let results, aggregated, outputDir, rounds;
  try {
    ({ results, aggregated, outputDir, rounds } = await execute(task, agents, finalAgents));
  } catch (err) {
    process.stderr.write(`Error: execution failed — ${err.message}\n`);
    process.exit(1);
  }

  printSummary(results, outputDir, aggregated, task, rounds);
}
