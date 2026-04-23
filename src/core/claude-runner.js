import { execFile, spawn } from 'child_process';

const MAX_IO_BYTES = 10 * 1024 * 1024;

export function isClaudeAvailable() {
  return new Promise((resolve) => {
    execFile('claude', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] }, (err) => {
      resolve(err === null);
    });
  });
}

export function buildClaudeArgs({ systemPrompt, model, type, userMessage }) {
  const args = ['--print', '--system-prompt', systemPrompt, '--model', model];

  if (type === 'analysis') {
    args.push('--allowed-tools', 'Read,Grep,Glob');
  } else if (type === 'action') {
    args.push('--permission-mode', 'bypassPermissions');
  }

  args.push('-p', userMessage);

  return args;
}

function appendCapped(acc, chunk) {
  const next = acc + chunk;
  if (next.length <= MAX_IO_BYTES) return next;
  return next.slice(0, MAX_IO_BYTES) + '\n[output truncated at 10MB]\n';
}

/**
 * Run `claude` with stdin closed. execFile leaves stdin as the parent TTY when
 * present, which can make Claude Code wait for stdin and fail in scripts.
 * Optional timeoutMs kills the process if it runs too long.
 */
export function spawnClaude(args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn('claude', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, timeoutMs)
      : null;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout = appendCapped(stdout, chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr = appendCapped(stderr, chunk);
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({ output: '', exitCode: 1, stderr: err.message });
    });

    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        resolve({ output: '', exitCode: 1, stderr: `Agent timed out after ${timeoutMs}ms` });
        return;
      }
      const exitCode = signal ? 1 : (code ?? 1);
      resolve({ output: stdout, exitCode, stderr });
    });
  });
}

export async function runAgent({ name, systemPrompt, model, type, userMessage, timeoutMs }) {
  if (process.env.SQUAD_MOCK === 'true') {
    return {
      output: `[MOCK] Agent "${name}" output for: ${userMessage.slice(0, 100)}`,
      exitCode: 0,
      stderr: '',
    };
  }

  const args = buildClaudeArgs({ systemPrompt, model, type, userMessage });
  const result = await spawnClaude(args, timeoutMs);

  if (result.exitCode !== 0) {
    const detail =
      (result.stderr && result.stderr.trim()) ||
      (result.output && result.output.trim()) ||
      `exit code ${result.exitCode}`;
    return { output: '', exitCode: result.exitCode, stderr: detail };
  }

  return result;
}
