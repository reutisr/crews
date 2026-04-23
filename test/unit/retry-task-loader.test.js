import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs/promises';
import path from 'path';
import { loadTask } from '../../src/core/task-loader.js';

describe('Task Loading with Retry', function() {
  let fsAccessStub, fsReadFileStub;

  beforeEach(function() {
    fsAccessStub = sinon.stub(fs, 'access');
    fsReadFileStub = sinon.stub(fs, 'readFile');
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('retry configuration validation', function() {

    it('should load task with valid retry configuration', async function() {
      const taskJson = {
        description: 'Test task',
        agents: ['backend-dev', 'code-reviewer'],
        mode: 'sequential',
        retry: {
          maxRounds: 3,
          reviewerAgent: 'code-reviewer'
        }
      };

      fsAccessStub.resolves();
      fsReadFileStub.resolves(JSON.stringify(taskJson));

      const result = await loadTask('test-task.json');

      expect(result.retry).to.deep.equal({
        maxRounds: 3,
        reviewerAgent: 'code-reviewer'
      });
    });

    it('should set default retry when omitted', async function() {
      const taskJson = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'parallel'
      };

      fsAccessStub.resolves();
      fsReadFileStub.resolves(JSON.stringify(taskJson));

      const result = await loadTask('test-task.json');

      expect(result.retry).to.deep.equal({ maxRounds: 1 });
    });

    it('should throw error when reviewerAgent not in agents list', async function() {
      const taskJson = {
        description: 'Test task',
        agents: ['backend-dev', 'qa'],
        mode: 'sequential',
        retry: {
          maxRounds: 2,
          reviewerAgent: 'code-reviewer'
        }
      };

      fsAccessStub.resolves();
      fsReadFileStub.resolves(JSON.stringify(taskJson));

      await expect(loadTask('test-task.json'))
        .to.be.rejectedWith(
          /retry\.reviewerAgent "code-reviewer" is not in the agents list/
        );
    });

    it('should allow reviewerAgent that exists in agents list', async function() {
      const taskJson = {
        description: 'Test task',
        agents: ['backend-dev', 'qa', 'architect'],
        mode: 'sequential',
        retry: {
          maxRounds: 2,
          reviewerAgent: 'qa'
        }
      };

      fsAccessStub.resolves();
      fsReadFileStub.resolves(JSON.stringify(taskJson));

      const result = await loadTask('test-task.json');

      expect(result.retry.reviewerAgent).to.equal('qa');
    });

    it('should be case sensitive for reviewerAgent matching', async function() {
      const taskJson = {
        description: 'Test task',
        agents: ['backend-dev', 'Code-Reviewer'],
        mode: 'sequential',
        retry: {
          maxRounds: 2,
          reviewerAgent: 'code-reviewer'
        }
      };

      fsAccessStub.resolves();
      fsReadFileStub.resolves(JSON.stringify(taskJson));

      await expect(loadTask('test-task.json'))
        .to.be.rejectedWith(
          /retry\.reviewerAgent "code-reviewer" is not in the agents list/
        );
    });

    it('should handle retry with empty agents list', async function() {
      const taskJson = {
        description: 'Test task',
        agents: [],
        mode: 'sequential',
        retry: {
          maxRounds: 2,
          reviewerAgent: 'code-reviewer'
        }
      };

      fsAccessStub.resolves();
      fsReadFileStub.resolves(JSON.stringify(taskJson));

      // This should fail during schema validation (empty agents array)
      // before we even get to reviewer agent checking
      await expect(loadTask('test-task.json'))
        .to.be.rejectedWith(/Invalid task file.*Field "agents" must be a non-empty array/);
    });

    it('should skip reviewerAgent verification when retry is not set', async function() {
      const taskJson = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'parallel'
      };

      fsAccessStub.resolves();
      fsReadFileStub.resolves(JSON.stringify(taskJson));

      const result = await loadTask('test-task.json');

      expect(result.retry).to.deep.equal({ maxRounds: 1 });
    });

    it('should skip reviewerAgent verification when retry has no reviewerAgent', async function() {
      // This should fail during schema validation since reviewerAgent is required when retry is present
      const taskJson = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: {
          maxRounds: 2
        }
      };

      fsAccessStub.resolves();
      fsReadFileStub.resolves(JSON.stringify(taskJson));

      await expect(loadTask('test-task.json'))
        .to.be.rejectedWith(/Field "retry\.reviewerAgent" must be a non-empty string/);
    });

    it('should preserve original retry object when valid', async function() {
      const taskJson = {
        description: 'Test task',
        agents: ['backend-dev', 'qa', 'architect'],
        mode: 'sequential',
        retry: {
          maxRounds: 5,
          reviewerAgent: 'architect'
        }
      };

      fsAccessStub.resolves();
      fsReadFileStub.resolves(JSON.stringify(taskJson));

      const result = await loadTask('test-task.json');

      expect(result.retry).to.deep.equal({
        maxRounds: 5,
        reviewerAgent: 'architect'
      });
    });

    it('should throw descriptive error with file path when reviewerAgent is invalid', async function() {
      const taskJson = {
        description: 'Test task',
        agents: ['backend-dev'],
        mode: 'sequential',
        retry: {
          maxRounds: 2,
          reviewerAgent: 'missing-agent'
        }
      };

      fsAccessStub.resolves();
      fsReadFileStub.resolves(JSON.stringify(taskJson));

      const taskPath = path.resolve('test-task.json');

      await expect(loadTask('test-task.json'))
        .to.be.rejectedWith(
          `Task file "${taskPath}" error: retry.reviewerAgent "missing-agent" is not in the agents list`
        );
    });
  });
});