import fs from 'fs/promises';
import path from 'path';
import { validateTaskSchema, sanitizeTaskName } from '../utils/validation.js';

export async function loadTask(filePath) {
  const absolutePath = path.resolve(filePath);

  try {
    await fs.access(absolutePath);
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`Task file not found: ${absolutePath}`);
    throw new Error(`Task file "${absolutePath}" is not accessible — ${err.message}`);
  }

  const raw = await fs.readFile(absolutePath, 'utf-8');

  let task;
  try {
    task = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Task file "${absolutePath}" contains invalid JSON — ${err.message}`);
  }

  const { valid, errors } = validateTaskSchema(task);
  if (!valid) {
    throw new Error(
      `Invalid task file "${absolutePath}":\n` +
      errors.map((e) => `  → ${e}`).join('\n')
    );
  }

  // After schema validation, verify retry.reviewerAgent is valid
  if (task.retry && task.retry.reviewerAgent) {
    if (!task.agents.includes(task.retry.reviewerAgent)) {
      throw new Error(
        `Task file "${absolutePath}" error: retry.reviewerAgent "${task.retry.reviewerAgent}" is not in the agents list`
      );
    }
    if (task.agents[0] === task.retry.reviewerAgent) {
      throw new Error(
        `Task file "${absolutePath}" error: retry.reviewerAgent "${task.retry.reviewerAgent}" cannot be the first agent — it must have implementation output to review`
      );
    }
  }

  // Attach task.retry with defaults so downstream code can always read it without null checks
  task.retry = task.retry || { maxRounds: 1 };

  if (task.context !== undefined) {
    const missing = (
      await Promise.all(
        task.context.map(async (ctx) => {
          try {
            await fs.access(path.resolve(ctx));
            return null;
          } catch (err) {
            if (err.code === 'ENOENT') return ctx;
            throw new Error(`Context file "${ctx}" is not accessible — ${err.message}`);
          }
        })
      )
    ).filter(Boolean);

    if (missing.length > 0) {
      throw new Error(
        `Task references missing context file(s):\n` +
        missing.map((f) => `  → ${f}`).join('\n')
      );
    }
  }

  task.taskName = sanitizeTaskName(path.basename(filePath));

  return task;
}
