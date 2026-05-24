export type GitFlowType =
  | 'feature'
  | 'bugfix'
  | 'hotfix'
  | 'release'
  | 'perf'
  | 'refactor'
  | 'docs'
  | 'chore';

export type TaskType =
  | 'feature'
  | 'bug'
  | 'optimize'
  | 'refactor'
  | 'docs'
  | 'chore';

export const TASK_TYPES: readonly TaskType[] = [
  'feature',
  'bug',
  'optimize',
  'refactor',
  'docs',
  'chore'
] as const;

export const TASK_TYPE_BRANCH_PREFIX: Record<TaskType, GitFlowType> = {
  feature: 'feature',
  bug: 'bugfix',
  optimize: 'perf',
  refactor: 'refactor',
  docs: 'docs',
  chore: 'chore'
};

export function getBranchPrefixForTaskType(taskType: TaskType | null | undefined): GitFlowType {
  if (!taskType) return 'feature';
  return TASK_TYPE_BRANCH_PREFIX[taskType] ?? 'feature';
}

export interface BranchNameOptions {
  gitFlowType: GitFlowType;
  workspaceShortName?: string;
  taskNumber?: number | null;
  translatedTitle?: string;
  editableTitle?: string;
  title?: string;
}

export function slugifyBranchSegment(input: string): string {
  if (!input || !input.trim()) return '';

  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/["']/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getWorkItemPrefix(workspaceShortName = '', taskNumber: number | null = null): string {
  const ws = workspaceShortName.trim().toUpperCase().replace(/\s+/g, '');
  if (ws && taskNumber) return `${ws}-${taskNumber}`;
  if (ws) return ws;
  return '';
}

export function getBranchSlug(options: Pick<BranchNameOptions, 'translatedTitle' | 'editableTitle' | 'title' | 'workspaceShortName' | 'taskNumber'>): string {
  const candidates = [options.translatedTitle, options.editableTitle, options.title];

  for (const candidate of candidates) {
    const slug = slugifyBranchSegment(candidate || '');
    if (slug) return slug;
  }

  return '';
}

export function getComputedBranchName(options: BranchNameOptions): string {
  const workItem = getWorkItemPrefix(options.workspaceShortName, options.taskNumber ?? null);
  const slug = getBranchSlug(options);

  if (!workItem) return `${options.gitFlowType}/${slug || 'untitled-task'}`;
  if (!slug) return `${options.gitFlowType}/${workItem}`;

  return `${options.gitFlowType}/${workItem}-${slug}`;
}

export function getCheckoutCommand(options: BranchNameOptions): string {
  return `git checkout -b ${getComputedBranchName(options)}`;
}
