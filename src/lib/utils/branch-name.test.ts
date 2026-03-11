import { describe, expect, it } from 'vitest';
import { getBranchSlug, getCheckoutCommand, getComputedBranchName, slugifyBranchSegment } from './branch-name';

describe('branch-name utils', () => {
  it('uses translated english text for branch slug when available', () => {
    expect(
      getComputedBranchName({
        gitFlowType: 'feature',
        workspaceShortName: 'PPOS',
        taskNumber: 49,
        title: 'ทำแอปเป็นระบบ ออฟไลน์',
        translatedTitle: 'Make the app offline'
      })
    ).toBe('feature/PPOS-49-make-the-app-offline');
  });

  it('falls back to task number when source text cannot be slugified', () => {
    expect(
      getComputedBranchName({
        gitFlowType: 'feature',
        workspaceShortName: 'PPOS',
        taskNumber: 49,
        title: 'ทำแอปเป็นระบบ ออฟไลน์'
      })
    ).toBe('feature/PPOS-49-task-49');
  });

  it('builds checkout command from computed branch name', () => {
    expect(
      getCheckoutCommand({
        gitFlowType: 'bugfix',
        workspaceShortName: 'core',
        taskNumber: 7,
        editableTitle: 'Fix login redirect'
      })
    ).toBe('git checkout -b bugfix/CORE-7-fix-login-redirect');
  });

  it('returns empty slug for non-ascii-only input so higher-level fallback can decide', () => {
    expect(slugifyBranchSegment('ทำแอปเป็นระบบ ออฟไลน์')).toBe('');
    expect(getBranchSlug({ title: 'ทำแอปเป็นระบบ ออฟไลน์', workspaceShortName: 'PPOS', taskNumber: 49 })).toBe('task-49');
  });
});
