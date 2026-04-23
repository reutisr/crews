import fs from 'fs/promises';
import path from 'path';
import { validateAgentConfig } from '../utils/validation.js';

const AGENTS_DIR = path.resolve(process.cwd(), '.crews/agents');

async function readAgentFile(agentName, filename) {
  const filepath = path.join(AGENTS_DIR, agentName, filename);
  try {
    return await fs.readFile(filepath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Agent "${agentName}": ${filename} not found`);
    }
    throw new Error(`Agent "${agentName}": could not read ${filename} — ${err.message}`);
  }
}

export async function loadAgent(name) {
  const role = await readAgentFile(name, 'role.md');
  const prompt = await readAgentFile(name, 'prompt.md');

  const configRaw = await readAgentFile(name, 'config.json');
  let config;
  try {
    config = JSON.parse(configRaw);
  } catch (err) {
    throw new Error(`Agent "${name}": config.json is invalid JSON — ${err.message}`);
  }

  const { valid, errors } = validateAgentConfig(config);
  if (!valid) {
    throw new Error(
      `Agent "${name}": config.json has invalid fields\n` +
      errors.map((e) => `  → ${e}`).join('\n')
    );
  }

  return { name, role, prompt, config };
}

export async function loadAgents(names) {
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        return { agent: await loadAgent(name), error: null };
      } catch (err) {
        return { agent: null, error: err.message };
      }
    })
  );

  const errors = results.filter((r) => r.error).map((r) => r.error);
  if (errors.length > 0) {
    throw new Error(
      `Failed to load ${errors.length} agent(s):\n` +
      errors.map((e) => `  → ${e}`).join('\n')
    );
  }

  return results.map((r) => r.agent);
}
