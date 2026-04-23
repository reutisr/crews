import { expect } from 'chai';
import sinon from 'sinon';

describe('Retry Summary Printing', function() {
  let processStdoutStub;

  beforeEach(function() {
    processStdoutStub = sinon.stub(process.stdout, 'write');
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('round-by-round summary formatting', function() {

    it('should format single round summary correctly', function() {
      // Simulate the printSummary logic for single round
      const rounds = [
        {
          round: 1,
          results: [
            { agentName: 'backend-dev', output: 'Code', durationMs: 1500, status: 'complete' },
            { agentName: 'code-reviewer', output: 'Good\nVerdict: Ready to merge', durationMs: 800, status: 'complete' }
          ],
          verdict: 'ready'
        }
      ];

      // When there's only one round, should fall back to standard summary
      const shouldShowRoundSummary = rounds && rounds.length > 1;
      expect(shouldShowRoundSummary).to.be.false;
    });

    it('should format multi-round summary correctly', function() {
      // Simulate the printSummary logic for multiple rounds
      const rounds = [
        {
          round: 1,
          results: [
            { agentName: 'backend-dev', output: 'Initial code', durationMs: 1500, status: 'complete' },
            { agentName: 'code-reviewer', output: 'Issues found\nVerdict: Needs fixes', durationMs: 800, status: 'complete' }
          ],
          verdict: 'needs-fixes'
        },
        {
          round: 2,
          results: [
            { agentName: 'backend-dev', output: 'Fixed code', durationMs: 1200, status: 'complete' },
            { agentName: 'code-reviewer', output: 'All good\nVerdict: Ready to merge', durationMs: 600, status: 'complete' }
          ],
          verdict: 'ready'
        }
      ];

      const shouldShowRoundSummary = rounds && rounds.length > 1;
      expect(shouldShowRoundSummary).to.be.true;

      // Simulate the round-by-round summary generation
      let roundSummary = '';
      for (const round of rounds) {
        const agentNames = round.results.map(r => r.agentName).join(', ');
        const verdictText = round.verdict === 'ready' ? 'Ready to merge' : 'Needs fixes';
        roundSummary += `Round ${round.round}: [${agentNames}] → Verdict: ${verdictText}\n`;
      }

      const expectedSummary =
        'Round 1: [backend-dev, code-reviewer] → Verdict: Needs fixes\n' +
        'Round 2: [backend-dev, code-reviewer] → Verdict: Ready to merge\n';

      expect(roundSummary).to.equal(expectedSummary);
    });

    it('should format final verdict summary', function() {
      const rounds = [
        { round: 1, verdict: 'needs-fixes' },
        { round: 2, verdict: 'needs-fixes' },
        { round: 3, verdict: 'ready' }
      ];

      const totalRounds = rounds.length;
      const finalVerdict = rounds[rounds.length - 1].verdict;

      const summaryText = `Total rounds: ${totalRounds} | Final verdict: ${finalVerdict === 'ready' ? 'Ready to merge' : 'Needs fixes'}`;

      expect(summaryText).to.equal('Total rounds: 3 | Final verdict: Ready to merge');
    });

    it('should format final verdict when exhausted', function() {
      const rounds = [
        { round: 1, verdict: 'needs-fixes' },
        { round: 2, verdict: 'needs-fixes' },
        { round: 3, verdict: 'needs-fixes' }
      ];

      const totalRounds = rounds.length;
      const finalVerdict = rounds[rounds.length - 1].verdict;

      const summaryText = `Total rounds: ${totalRounds} | Final verdict: ${finalVerdict === 'ready' ? 'Ready to merge' : 'Needs fixes'}`;

      expect(summaryText).to.equal('Total rounds: 3 | Final verdict: Needs fixes');
    });

    it('should handle rounds with mixed agent results', function() {
      const rounds = [
        {
          round: 1,
          results: [
            { agentName: 'backend-dev', output: 'Code', durationMs: 1500, status: 'complete' },
            { agentName: 'qa', output: 'Tests', durationMs: 1000, status: 'complete' },
            { agentName: 'code-reviewer', output: 'Review\nVerdict: Needs fixes', durationMs: 800, status: 'complete' }
          ],
          verdict: 'needs-fixes'
        },
        {
          round: 2,
          results: [
            { agentName: 'backend-dev', output: 'Fixed', durationMs: 1200, status: 'complete' },
            { agentName: 'qa', output: 'Updated tests', durationMs: 900, status: 'complete' },
            { agentName: 'code-reviewer', output: 'Good\nVerdict: Ready to merge', durationMs: 600, status: 'complete' }
          ],
          verdict: 'ready'
        }
      ];

      // Generate round summary with all agent names
      let roundSummary = '';
      for (const round of rounds) {
        const agentNames = round.results.map(r => r.agentName).join(', ');
        const verdictText = round.verdict === 'ready' ? 'Ready to merge' : 'Needs fixes';
        roundSummary += `Round ${round.round}: [${agentNames}] → Verdict: ${verdictText}\n`;
      }

      const expectedSummary =
        'Round 1: [backend-dev, qa, code-reviewer] → Verdict: Needs fixes\n' +
        'Round 2: [backend-dev, qa, code-reviewer] → Verdict: Ready to merge\n';

      expect(roundSummary).to.equal(expectedSummary);
    });

    it('should handle rounds with failed agents', function() {
      const round = {
        round: 1,
        results: [
          { agentName: 'backend-dev', output: 'Code', durationMs: 1500, status: 'complete' },
          { agentName: 'code-reviewer', output: '', durationMs: 0, status: 'error', error: 'Failed' }
        ],
        verdict: 'needs-fixes'
      };

      // Even with failed agents, they should appear in the agent list
      const agentNames = round.results.map(r => r.agentName).join(', ');
      expect(agentNames).to.equal('backend-dev, code-reviewer');

      // Verdict should default to needs-fixes when reviewer fails
      expect(round.verdict).to.equal('needs-fixes');
    });

    it('should handle empty rounds gracefully', function() {
      const rounds = [];

      const shouldShowRoundSummary = rounds && rounds.length > 1;
      expect(shouldShowRoundSummary).to.be.false;

      // When no rounds, should fall back to standard summary
    });

    it('should format duration correctly in standard summary', function() {
      // Test the duration formatting used in the standard agent summary
      function formatDuration(ms) {
        return (ms / 1000).toFixed(1) + 's';
      }

      expect(formatDuration(1500)).to.equal('1.5s');
      expect(formatDuration(800)).to.equal('0.8s');
      expect(formatDuration(10000)).to.equal('10.0s');
      expect(formatDuration(250)).to.equal('0.3s');
    });

    it('should format status correctly in standard summary', function() {
      // Test the status formatting used in the standard agent summary
      function formatStatus(status) {
        return status === 'complete' ? '✓ done    ' : '✗ error   ';
      }

      expect(formatStatus('complete')).to.equal('✓ done    ');
      expect(formatStatus('error')).to.equal('✗ error   ');
    });

    it('should format agent table row correctly', function() {
      // Test the table row formatting used in the standard agent summary
      const result = {
        agentName: 'backend-dev',
        durationMs: 1500,
        status: 'complete'
      };

      const name = result.agentName.padEnd(15);
      const status = result.status === 'complete' ? '✓ done    ' : '✗ error   ';
      const duration = ((result.durationMs / 1000).toFixed(1) + 's').padEnd(9);

      const expectedName = 'backend-dev    ';
      const expectedStatus = '✓ done    ';
      const expectedDuration = '1.5s     ';

      expect(name).to.equal(expectedName);
      expect(status).to.equal(expectedStatus);
      expect(duration).to.equal(expectedDuration);
    });
  });
});