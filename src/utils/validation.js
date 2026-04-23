const AGENT_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Validates an agent name.
 * @param {string} name
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAgentName(name) {
  if (!name) {
    return { valid: false, error: 'Agent name is required' };
  }

  if (!AGENT_NAME_PATTERN.test(name)) {
    return {
      valid: false,
      error: `Agent name "${name}" is invalid. Must be lowercase alphanumeric with hyphens (e.g. my-agent). Cannot start or end with a hyphen.`,
    };
  }

  return { valid: true };
}

/**
 * Validates an agent config object.
 * Collects all errors before returning.
 * @param {unknown} obj
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAgentConfig(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['Config must be a JSON object'] };
  }

  if (typeof obj.model !== 'string' || obj.model.trim() === '') {
    errors.push('Field "model" must be a non-empty string');
  }

  if (
    typeof obj.temperature !== 'number' ||
    Number.isNaN(obj.temperature) ||
    obj.temperature < 0 ||
    obj.temperature > 1
  ) {
    errors.push('Field "temperature" must be a number between 0 and 1');
  }

  if (
    typeof obj.maxTokens !== 'number' ||
    !Number.isInteger(obj.maxTokens) ||
    obj.maxTokens <= 0
  ) {
    errors.push('Field "maxTokens" must be a positive integer');
  }

  if (obj.type !== 'analysis' && obj.type !== 'action') {
    errors.push('Field "type" must be exactly "analysis" or "action"');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a task schema object.
 * Collects all errors before returning.
 * @param {unknown} obj
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTaskSchema(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['Task must be a JSON object'] };
  }

  if (typeof obj.description !== 'string' || obj.description.trim() === '') {
    errors.push('Field "description" must be a non-empty string');
  }

  if (
    !Array.isArray(obj.agents) ||
    obj.agents.length === 0 ||
    !obj.agents.every((a) => typeof a === 'string' && a.trim() !== '')
  ) {
    errors.push('Field "agents" must be a non-empty array of strings');
  }

  if (obj.mode !== 'parallel' && obj.mode !== 'sequential') {
    errors.push('Field "mode" must be exactly "parallel" or "sequential"');
  }

  if (
    obj.context !== undefined &&
    (!Array.isArray(obj.context) ||
      !obj.context.every((c) => typeof c === 'string'))
  ) {
    errors.push('Field "context" must be an array of strings if provided');
  }

  if (
    obj.finalAgents !== undefined &&
    (!Array.isArray(obj.finalAgents) ||
      !obj.finalAgents.every((a) => typeof a === 'string' && a.trim() !== ''))
  ) {
    errors.push('Field "finalAgents" must be an array of strings if provided');
  }

  if (
    obj.skills !== undefined &&
    (!Array.isArray(obj.skills) ||
      !obj.skills.every((s) => typeof s === 'string'))
  ) {
    errors.push('Field "skills" must be an array of strings if provided');
  }

  if (
    obj.claude_md !== undefined &&
    (!Array.isArray(obj.claude_md) ||
      !obj.claude_md.every((s) => typeof s === 'string'))
  ) {
    errors.push('Field "claude_md" must be an array of strings if provided');
  }

  if (obj.aggregator !== undefined && typeof obj.aggregator !== 'boolean') {
    errors.push('Field "aggregator" must be a boolean if provided');
  }

  if (obj.retry !== undefined) {
    if (typeof obj.retry !== 'object' || obj.retry === null || Array.isArray(obj.retry)) {
      errors.push('Field "retry" must be an object if provided');
    } else {
      if (
        typeof obj.retry.maxRounds !== 'number' ||
        !Number.isInteger(obj.retry.maxRounds) ||
        obj.retry.maxRounds < 1 ||
        obj.retry.maxRounds > 10
      ) {
        errors.push('Field "retry.maxRounds" must be a positive integer between 1 and 10');
      }

      if (typeof obj.retry.reviewerAgent !== 'string' || obj.retry.reviewerAgent.trim() === '') {
        errors.push('Field "retry.reviewerAgent" must be a non-empty string');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Derives a safe task name from a task file name.
 * Strips .json extension, lowercases, replaces non-alphanumeric (except hyphens)
 * with hyphens, collapses multiples, trims leading/trailing hyphens.
 * @param {string} filename
 * @returns {string}
 */
export function sanitizeTaskName(filename) {
  const result = filename
    .replace(/\.json$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!result) {
    throw new Error(`Cannot derive a task name from filename: "${filename}"`);
  }

  return result;
}
