import { expect } from 'chai';
import { extractVerdict } from '../../src/core/execution-engine.js';

describe('Verdict Extraction', function() {
  describe('extractVerdict', function() {

    it('should return "ready" when verdict line contains "Ready to merge"', function() {
      const output = `
## Code Review

The code looks good overall.

Verdict: Ready to merge

No further changes needed.
      `.trim();

      const result = extractVerdict(output);
      expect(result).to.equal('ready');
    });

    it('should return "needs-fixes" when verdict line contains "Needs fixes"', function() {
      const output = `
## Code Review

Several issues found.

Verdict: Needs fixes

Please address the following concerns...
      `.trim();

      const result = extractVerdict(output);
      expect(result).to.equal('needs-fixes');
    });

    it('should return "needs-fixes" when verdict line contains other text after "Verdict:"', function() {
      const output = `
## Review Summary

Verdict: Requires additional testing

The implementation needs more test coverage.
      `.trim();

      const result = extractVerdict(output);
      expect(result).to.equal('needs-fixes');
    });

    it('should be case insensitive for "ready to merge"', function() {
      const output = `
Verdict: READY TO MERGE
      `.trim();

      const result = extractVerdict(output);
      expect(result).to.equal('ready');
    });

    it('should handle mixed case in verdict line', function() {
      const output = `
Verdict: Ready To Merge
      `.trim();

      const result = extractVerdict(output);
      expect(result).to.equal('ready');
    });

    it('should return "ready" for partial "ready to merge" matches', function() {
      const output = `
Verdict: This is ready to merge with minor adjustments
      `.trim();

      const result = extractVerdict(output);
      expect(result).to.equal('ready');
    });

    it('should find verdict line with leading/trailing whitespace', function() {
      const output = `
## Review

   Verdict: Ready to merge

All good!
      `.trim();

      const result = extractVerdict(output);
      expect(result).to.equal('ready');
    });

    it('should return "needs-fixes" when no verdict line is found', function() {
      const output = `
## Code Review

The implementation looks solid.
No major issues found.
All tests pass.
      `.trim();

      const result = extractVerdict(output);
      expect(result).to.equal('needs-fixes');
    });

    it('should return "needs-fixes" when output is empty', function() {
      const result = extractVerdict('');
      expect(result).to.equal('needs-fixes');
    });

    it('should return "needs-fixes" when output is null', function() {
      const result = extractVerdict(null);
      expect(result).to.equal('needs-fixes');
    });

    it('should return "needs-fixes" when output is undefined', function() {
      const result = extractVerdict(undefined);
      expect(result).to.equal('needs-fixes');
    });

    it('should return "needs-fixes" when output is not a string', function() {
      const result = extractVerdict({ message: 'Verdict: Ready to merge' });
      expect(result).to.equal('needs-fixes');
    });

    it('should find first verdict line when multiple exist', function() {
      const output = `
## First Review
Verdict: Needs fixes

## Second Review
Verdict: Ready to merge
      `.trim();

      const result = extractVerdict(output);
      expect(result).to.equal('needs-fixes');
    });

    it('should handle verdict line at the beginning of output', function() {
      const output = `Verdict: Ready to merge
Everything else follows.`;

      const result = extractVerdict(output);
      expect(result).to.equal('ready');
    });

    it('should handle verdict line at the end of output', function() {
      const output = `
## Detailed Review

Multiple paragraphs of analysis...

Final decision:
Verdict: Ready to merge`;

      const result = extractVerdict(output);
      expect(result).to.equal('ready');
    });

    it('should be case sensitive for verdict line detection', function() {
      const output = `
verdict: Ready to merge
VERDICT: Needs fixes
      `.trim();

      // Should not match lowercase "verdict:" - only "Verdict:"
      const result = extractVerdict(output);
      expect(result).to.equal('needs-fixes');
    });

    it('should handle multi-line verdict explanations', function() {
      const output = `
## Review

Verdict: The code needs significant refactoring
before it can be merged. Multiple issues found
including performance concerns and test gaps.
      `.trim();

      const result = extractVerdict(output);
      expect(result).to.equal('needs-fixes');
    });

    it('should handle verdict with punctuation', function() {
      const output1 = `Verdict: Ready to merge!`;
      const output2 = `Verdict: Ready to merge.`;
      const output3 = `Verdict: Needs minor fixes...`;

      expect(extractVerdict(output1)).to.equal('ready');
      expect(extractVerdict(output2)).to.equal('ready');
      expect(extractVerdict(output3)).to.equal('needs-fixes');
    });

    it('should require exact "Verdict:" prefix', function() {
      const output = `
Final Verdict: Ready to merge
My Verdict: Needs work
Overall Verdict: Good to go
      `.trim();

      // None of these should match - only "Verdict:" at start of line
      const result = extractVerdict(output);
      expect(result).to.equal('needs-fixes');
    });

    it('should handle Windows line endings', function() {
      const output = `## Review\r\nVerdict: Ready to merge\r\nDone.`;

      const result = extractVerdict(output);
      expect(result).to.equal('ready');
    });

    it('should handle Unicode content', function() {
      const output = `
## Código Review ✓

Verdict: Ready to merge 🚀

¡Excelente trabajo!
      `.trim();

      const result = extractVerdict(output);
      expect(result).to.equal('ready');
    });
  });
});