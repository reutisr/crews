import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INIT_TEMPLATES_DIR = path.resolve(__dirname, '../../templates/init');

const SQUAD_DIR = path.resolve(process.cwd(), '.squad');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function init() {
  if (await exists(SQUAD_DIR)) {
    process.stderr.write('Error: .squad/ already exists in this directory. Nothing to do.\n');
    process.exit(1);
  }

  await fs.mkdir(path.join(SQUAD_DIR, 'agents'), { recursive: true });
  await fs.mkdir(path.join(SQUAD_DIR, 'output'), { recursive: true });

  await fs.copyFile(
    path.join(INIT_TEMPLATES_DIR, 'directives.md'),
    path.join(SQUAD_DIR, 'directives.md')
  );

  await fs.copyFile(
    path.join(INIT_TEMPLATES_DIR, 'decisions.md'),
    path.join(SQUAD_DIR, 'decisions.md')
  );

  process.stdout.write(
    '\n' +
    '.squad/ initialized successfully!\n' +
    '\n' +
    'Created:\n' +
    '  .squad/agents/        — agent definitions go here\n' +
    '  .squad/directives.md  — project-wide rules injected into every agent\n' +
    '  .squad/decisions.md   — architectural decisions accumulated over time\n' +
    '  .squad/output/        — task run outputs\n' +
    '\n' +
    'Next steps:\n' +
    '  1. Edit .squad/directives.md  — add your project\'s code style and security rules\n' +
    '  2. squad create-agent <name>  — scaffold your first agent (e.g. "backend-dev", "reviewer")\n' +
    '  3. Create a task JSON file    — see examples/ in the squad repo\n' +
    '  4. squad run <task.json>      — run it\n' +
    '\n'
  );
}
