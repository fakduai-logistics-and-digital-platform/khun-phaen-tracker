export interface BranchNameOptions {
  gitFlowType: 'feature' | 'bugfix' | 'hotfix' | 'release';
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
    .replace(/[\u0300-\u036f]/g, '')
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
  const ws = workspaceShortName.trim().toUpperCase().replace(/\s+/g, '').slice(0, 4);
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

  if (options.taskNumber) return `task-${options.taskNumber}`;

  const workspaceFallback = slugifyBranchSegment(options.workspaceShortName || '');
  if (workspaceFallback) return `${workspaceFallback}-task`;

  return 'untitled-task';
}

export function getComputedBranchName(options: BranchNameOptions): string {
  const workItem = getWorkItemPrefix(options.workspaceShortName, options.taskNumber ?? null);
  const slug = getBranchSlug(options);
  return workItem ? `${options.gitFlowType}/${workItem}-${slug}` : `${options.gitFlowType}/${slug}`;
}

export function getCheckoutCommand(options: BranchNameOptions): string {
  return `git checkout -b ${getComputedBranchName(options)}`;
}
