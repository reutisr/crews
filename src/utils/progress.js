export function createProgress() {
  const startTimes = new Map();
  const overallStart = Date.now();

  function elapsed(agentName) {
    const start = startTimes.get(agentName);
    if (start === undefined) return '?.?';
    return ((Date.now() - start) / 1000).toFixed(1);
  }

  return {
    start(agentName) {
      startTimes.set(agentName, Date.now());
      process.stderr.write(`[${agentName}] running...\n`);
    },

    complete(agentName) {
      process.stderr.write(`[${agentName}] ✓ done in ${elapsed(agentName)}s\n`);
    },

    fail(agentName, reason) {
      process.stderr.write(`[${agentName}] ✗ failed: ${reason}\n`);
    },

    summary() {
      const total = ((Date.now() - overallStart) / 1000).toFixed(1);
      process.stderr.write(`\nAll agents finished in ${total}s\n`);
    },
  };
}
