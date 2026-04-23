import { expect } from 'chai';
import { validateTaskSchema } from '../../src/utils/validation.js';

describe('Retry Field Validation', function() {
  describe('validateTaskSchema with retry field', function() {

    it('should accept valid retry object with positive maxRounds and non-empty reviewerAgent', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev', 'qa'],
        mode: 'sequential',
        retry: {
          maxRounds: 3,
          reviewerAgent: 'qa'
        }
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.true;
      expect(result.errors).to.have.lengthOf(0);
    });

    it('should accept task without retry field (optional)', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'parallel'
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.true;
      expect(result.errors).to.have.lengthOf(0);
    });

    it('should accept retry with minimal valid values', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev', 'code-reviewer'],
        mode: 'sequential',
        retry: {
          maxRounds: 1,
          reviewerAgent: 'code-reviewer'
        }
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.true;
      expect(result.errors).to.have.lengthOf(0);
    });

    it('should reject retry with maxRounds less than 1', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: {
          maxRounds: 0,
          reviewerAgent: 'qa'
        }
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Field "retry.maxRounds" must be a positive integer (>= 1)');
    });

    it('should reject retry with negative maxRounds', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: {
          maxRounds: -1,
          reviewerAgent: 'qa'
        }
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Field "retry.maxRounds" must be a positive integer (>= 1)');
    });

    it('should reject retry with non-integer maxRounds', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: {
          maxRounds: 2.5,
          reviewerAgent: 'qa'
        }
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Field "retry.maxRounds" must be a positive integer (>= 1)');
    });

    it('should reject retry with string maxRounds', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: {
          maxRounds: '3',
          reviewerAgent: 'qa'
        }
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Field "retry.maxRounds" must be a positive integer (>= 1)');
    });

    it('should reject retry with empty reviewerAgent', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: {
          maxRounds: 2,
          reviewerAgent: ''
        }
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Field "retry.reviewerAgent" must be a non-empty string');
    });

    it('should reject retry with whitespace-only reviewerAgent', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: {
          maxRounds: 2,
          reviewerAgent: '   '
        }
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Field "retry.reviewerAgent" must be a non-empty string');
    });

    it('should reject retry with missing reviewerAgent', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: {
          maxRounds: 2
        }
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Field "retry.reviewerAgent" must be a non-empty string');
    });

    it('should reject retry with non-string reviewerAgent', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: {
          maxRounds: 2,
          reviewerAgent: 123
        }
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Field "retry.reviewerAgent" must be a non-empty string');
    });

    it('should reject retry as non-object', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: 'invalid'
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Field "retry" must be an object if provided');
    });

    it('should reject retry as array', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: []
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Field "retry" must be an object if provided');
    });

    it('should accept large maxRounds values', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev', 'qa'],
        mode: 'sequential',
        retry: {
          maxRounds: 100,
          reviewerAgent: 'qa'
        }
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.true;
      expect(result.errors).to.have.lengthOf(0);
    });

    it('should collect multiple retry validation errors', function() {
      const task = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: {
          maxRounds: -1,
          reviewerAgent: ''
        }
      };

      const result = validateTaskSchema(task);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Field "retry.maxRounds" must be a positive integer (>= 1)');
      expect(result.errors).to.include('Field "retry.reviewerAgent" must be a non-empty string');
    });
  });
});