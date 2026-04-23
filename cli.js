#!/usr/bin/env node

function parseArgs() {
  const [command, ...args] = process.argv.slice(2);
  return { command, args };
}

function printUsage() {
  process.stderr.write(
    'Usage:\n' +
    '  crews init                   Set up .crews/ in the current project\n' +
    '  crews create-agent <name>    Scaffold a new agent\n' +
    '  crews run <task-file>        Run a task against configured agents\n'
  );
  process.exit(1);
}

async function main() {
  const { command, args } = parseArgs();

  switch (command) {
    case 'init': {
      const { init } = await import('./src/commands/init.js');
      await init();
      break;
    }
    case 'create-agent': {
      const { createAgent } = await import('./src/commands/create-agent.js');
      await createAgent(args[0]);
      break;
    }
    case 'run': {
      const { run } = await import('./src/commands/run.js');
      await run(args[0]);
      break;
    }
    default:
      printUsage();
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
