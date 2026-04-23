import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateAgentName } from '../utils/validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates/agent');
const AGENTS_DIR = path.resolve(process.cwd(), '.crews/agents');

const TEMPLATE_FILES = ['charter.md', 'prompt.md', 'config.json'];

export async function createAgent(name) {
  if (!name) {
    process.stderr.write('Usage: crews create-agent <name>\n');
    process.exit(1);
  }

  const { valid, error } = validateAgentName(name);
  if (!valid) {
    process.stderr.write(`Error: ${error}\n`);
    process.exit(1);
  }

  const agentDir = path.join(AGENTS_DIR, name);

  try {
    await fs.access(agentDir);
    process.stderr.write(`Error: Agent "${name}" already exists at ${agentDir}\n`);
    process.exit(1);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // directory does not exist — proceed
  }

  await fs.mkdir(agentDir, { recursive: true });

  for (const file of TEMPLATE_FILES) {
    await fs.copyFile(path.join(TEMPLATES_DIR, file), path.join(agentDir, file));
  }

  process.stdout.write(`Agent "${name}" created at ${agentDir}\n`);
  process.stdout.write(`Edit the files to define the agent's role:\n`);
  process.stdout.write(`  ${agentDir}/charter.md   — role, expertise, boundaries\n`);
  process.stdout.write(`  ${agentDir}/prompt.md     — system prompt\n`);
  process.stdout.write(`  ${agentDir}/config.json   — model, temperature, type (analysis|action)\n`);
}
