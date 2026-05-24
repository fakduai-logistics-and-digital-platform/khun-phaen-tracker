import { describe, it, expect } from 'vitest';
import {
  getWorkItemPrefix,
  getComputedBranchName,
  getBranchPrefixForTaskType,
  TASK_TYPE_BRANCH_PREFIX
} from './branch-name';

describe('branch-name utils', () => {
  describe('getWorkItemPrefix', () => {
    it('should return project short name with task number', () => {
      expect(getWorkItemPrefix('PROJ', 123)).toBe('PROJ-123');
    });

    it('should return project short name only if task number is missing', () => {
      expect(getWorkItemPrefix('PROJ', null)).toBe('PROJ');
    });

    it('should handle workspace short name with spaces', () => {
      expect(getWorkItemPrefix('MY PROJ', 123)).toBe('MYPROJ-123');
    });

    it('should handle long workspace short name without slicing', () => {
      expect(getWorkItemPrefix('MYLONGPROJECT', 123)).toBe('MYLONGPROJECT-123');
    });

    it('should not invent a task prefix if short name is missing', () => {
      expect(getWorkItemPrefix('', 123)).toBe('');
    });
  });

  describe('getComputedBranchName', () => {
    it('should generate feature branch with project prefix', () => {
      const options = {
        gitFlowType: 'feature' as const,
        workspaceShortName: 'PROJ',
        taskNumber: 123,
        title: 'Fix Login System'
      };
      expect(getComputedBranchName(options)).toBe('feature/PROJ-123-fix-login-system');
    });

    it('should handle missing title by using task number', () => {
      const options = {
        gitFlowType: 'feature' as const,
        workspaceShortName: 'PROJ',
        taskNumber: 123,
        title: ''
      };
      expect(getComputedBranchName(options)).toBe('feature/PROJ-123');
    });

    it('should prioritize translated title', () => {
      const options = {
        gitFlowType: 'bugfix' as const,
        workspaceShortName: 'PROJ',
        taskNumber: 456,
        title: 'แก้บั๊ก',
        translatedTitle: 'Fix Bug'
      };
      expect(getComputedBranchName(options)).toBe('bugfix/PROJ-456-fix-bug');
    });

    it('should use the title slug directly when workspace short name is missing', () => {
      const options = {
        gitFlowType: 'feature' as const,
        workspaceShortName: '',
        taskNumber: 139,
        title: 'API shows the dates'
      };
      expect(getComputedBranchName(options)).toBe('feature/api-shows-the-dates');
    });

    it('should render perf prefix for optimize task type', () => {
      const options = {
        gitFlowType: 'perf' as const,
        workspaceShortName: 'PROJ',
        taskNumber: 7,
        title: 'Speed up load'
      };
      expect(getComputedBranchName(options)).toBe('perf/PROJ-7-speed-up-load');
    });
  });

  describe('getBranchPrefixForTaskType', () => {
    it('maps feature to feature', () => {
      expect(getBranchPrefixForTaskType('feature')).toBe('feature');
    });

    it('maps bug to bugfix', () => {
      expect(getBranchPrefixForTaskType('bug')).toBe('bugfix');
    });

    it('maps optimize to perf', () => {
      expect(getBranchPrefixForTaskType('optimize')).toBe('perf');
    });

    it('maps refactor to refactor', () => {
      expect(getBranchPrefixForTaskType('refactor')).toBe('refactor');
    });

    it('maps docs to docs', () => {
      expect(getBranchPrefixForTaskType('docs')).toBe('docs');
    });

    it('maps chore to chore', () => {
      expect(getBranchPrefixForTaskType('chore')).toBe('chore');
    });

    it('falls back to feature when task type is missing or unknown', () => {
      expect(getBranchPrefixForTaskType(undefined)).toBe('feature');
      expect(getBranchPrefixForTaskType(null)).toBe('feature');
      // @ts-expect-error testing runtime fallback for unknown value
      expect(getBranchPrefixForTaskType('unknown-thing')).toBe('feature');
    });

    it('table contains exactly the supported task types', () => {
      expect(Object.keys(TASK_TYPE_BRANCH_PREFIX).sort()).toEqual(
        ['bug', 'chore', 'docs', 'feature', 'optimize', 'refactor']
      );
    });
  });
});
