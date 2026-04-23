import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INIT_TEMPLATES_DIR = path.resolve(__dirname, '../../templates/init');
const AGENTS_TEMPLATES_DIR = path.resolve(__dirname, '../../templates/agents');

const CREWS_DIR = path.resolve(process.cwd(), '.crews');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function init() {
  if (await exists(CREWS_DIR)) {
    process.stderr.write('Error: .crews/ already exists in this directory. Nothing to do.\n');
    process.exit(1);
  }

  await fs.mkdir(path.join(CREWS_DIR, 'agents'), { recursive: true });
  await fs.mkdir(path.join(CREWS_DIR, 'output'), { recursive: true });

  await fs.copyFile(
    path.join(INIT_TEMPLATES_DIR, 'directives.md'),
    path.join(CREWS_DIR, 'directives.md')
  );

  await fs.copyFile(
    path.join(INIT_TEMPLATES_DIR, 'decisions.md'),
    path.join(CREWS_DIR, 'decisions.md')
  );

  const agentNames = await fs.readdir(AGENTS_TEMPLATES_DIR);
  for (const agentName of agentNames) {
    const src = path.join(AGENTS_TEMPLATES_DIR, agentName);
    const dest = path.join(CREWS_DIR, 'agents', agentName);
    await fs.mkdir(dest, { recursive: true });
    const files = await fs.readdir(src);
    for (const file of files) {
      await fs.copyFile(path.join(src, file), path.join(dest, file));
    }
  }

  process.stdout.write(
    '\n' +
    '.crews/ initialized successfully!\n' +
    '\n' +
    'Created:\n' +
    '  .crews/agents/        — ' + agentNames.join(', ') + '\n' +
    '  .crews/directives.md  — project-wide rules injected into every agent\n' +
    '  .crews/decisions.md   — architectural decisions accumulated over time\n' +
    '  .crews/output/        — task run outputs\n' +
    '\n' +
    'Next steps:\n' +
    '  1. Edit .crews/directives.md  — add your project\'s code style and security rules\n' +
    '  2. Edit any agent in .crews/agents/ to customize its role\n' +
    '  3. Create a task JSON file    — see examples/ in the crews repo\n' +
    '  4. crews run <task.json>      — run it\n' +
    '\n'
  );
}
