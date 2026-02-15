<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Task, Sprint } from '$lib/types';
  import { _ } from '$lib/i18n';
  import { Folder, Flag } from 'lucide-svelte';
  import SearchableSprintSelect from './SearchableSprintSelect.svelte';
  
  export let tasks: Task[] = [];
  export let sprints: Sprint[] = [];

  let groupBy: 'project' | 'sprint' = 'project';
  let selectedSprintId: number | 'all' | null = 'all';
  
  const dispatch = createEventDispatcher();
  
  const ROW_HEIGHT = 40;
  const DAY_WIDTH = 40;
  const HEADER_HEIGHT = 50;
  const SIDEBAR_WIDTH = 250;
  const PADDING_DAYS = 7; // Add buffer days

  let container: HTMLDivElement;

  function normalizeDate(dateStr?: string): Date {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function getDates(start: Date, end: Date) {
    const dates = [];
    let current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  // Reactive calculations
  $: filteredTasks = tasks.filter(t => {
      if (selectedSprintId === 'all') return true;
      if (selectedSprintId === null) return t.sprint_id === null;
      return t.sprint_id === selectedSprintId;
  });

  $: parsedTasks = filteredTasks.map(t => {
      const start = normalizeDate(t.date);
      // If end_date is present, use it. Otherwise, assume duration_minutes or default 1 day.
      let end = t.end_date ? normalizeDate(t.end_date) : new Date(start);
      
      if (!t.end_date && t.duration_minutes) {
          // If no specific end date, estimate from duration (assuming 8h workday? or just simple minutes)
          // Let's keep it simple: if duration > 24h, add days.
          // Or just default to start == end (1 day task)
      }
      
      // Ensure end >= start
      if (end < start) end = new Date(start);
      
      return {
          ...t,
          _start: start,
          _end: end
      };
  }).sort((a, b) => a._start.getTime() - b._start.getTime());

  $: minDate = parsedTasks.length > 0 
      ? addDays(parsedTasks[0]._start, -PADDING_DAYS) 
      : addDays(new Date(), -PADDING_DAYS);
      
  $: maxDate = parsedTasks.length > 0 
      ? addDays(
          parsedTasks.reduce((max, t) => t._end > max ? t._end : max, parsedTasks[0]._end), 
          PADDING_DAYS
        )
      : addDays(new Date(), PADDING_DAYS);

  $: timelineDates = getDates(minDate, maxDate);
  $: totalWidth = timelineDates.length * DAY_WIDTH;

  function getSprintName(sprintId: number | null | undefined): string {
      if (!sprintId) return 'No Sprint';
      const sprint = sprints.find(s => s.id === sprintId);
      return sprint ? sprint.name : 'Unknown Sprint';
  }

  $: getGroupDisplayName = (groupName: string) => {
    if (groupName === 'Unassigned') return $_('ganttView__unassigned_project');
    if (groupName === 'No Sprint') return $_('ganttView__unassigned_sprint');
    if (groupName === 'Unknown Sprint') return $_('ganttView__unknown_sprint');
    return groupName;
  }

  $: groupedTasks = Object.entries(parsedTasks.reduce((acc, task) => {
      let key;
      if (groupBy === 'project') {
          key = task.project || 'Unassigned';
      } else {
          key = getSprintName(task.sprint_id);
      }
      
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
  }, {} as Record<string, typeof parsedTasks>)).sort((a, b) => {
        const lastKeys = ['Unassigned', 'No Sprint', 'Unknown Sprint'];
        const aIsLast = lastKeys.includes(a[0]);
        const bIsLast = lastKeys.includes(b[0]);

        if (aIsLast && !bIsLast) return 1;
        if (!aIsLast && bIsLast) return -1;
        return a[0].localeCompare(b[0]);
  });

  function getX(date: Date) {
      const diffTime = date.getTime() - minDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays * DAY_WIDTH;
  }

  function getWidth(start: Date, end: Date) {
      // Inclusive end date
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays * DAY_WIDTH;
  }

  function handleTaskClick(task: Task) {
      dispatch('edit', task);
  }
</script>

<div class="flex flex-col h-full gap-4">
    <!-- View Controls -->
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button 
                class="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 {groupBy === 'project' ? 'bg-white dark:bg-gray-700 shadow text-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}"
                on:click={() => groupBy = 'project'}
            >
                <Folder size={14} />
                {$_('ganttView__tab_project')}
            </button>
            <button 
                class="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 {groupBy === 'sprint' ? 'bg-white dark:bg-gray-700 shadow text-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}"
                on:click={() => groupBy = 'sprint'}
            >
                <Flag size={14} />
                {$_('ganttView__tab_sprint')}
            </button>
        </div>
        
        <div class="flex items-center gap-4">
             <div class="w-48">
                <SearchableSprintSelect 
                    {sprints} 
                    bind:value={selectedSprintId} 
                    id="gantt-sprint-filter"
                />
            </div>
            <div class="text-xs text-gray-500">
                {$_('ganttView__tasks_count', { values: { count: parsedTasks.length } })}
            </div>
        </div>
    </div>

    <div class="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="flex-1 overflow-auto relative custom-scrollbar">
        <div class="flex sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <!-- Sidebar Header -->
            <div class="sticky left-0 z-30 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-3 font-semibold text-sm text-gray-700 dark:text-gray-300 shadow-sm" style="width: {SIDEBAR_WIDTH}px; min-width: {SIDEBAR_WIDTH}px;">
                {$_('ganttView__task_name')}
            </div>
            <!-- Timeline Header -->
            <div class="flex" style="width: {totalWidth}px;">
                {#each timelineDates as date}
                    <div class="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 p-2 text-xs text-center text-gray-500 dark:text-gray-400" style="width: {DAY_WIDTH}px;">
                        <span class="block font-semibold">{date.getDate()}</span>
                        <span class="block text-[10px]">{$_('ganttView__months_short')[date.getMonth()]}</span>
                    </div>
                {/each}
            </div>
        </div>

        <div class="relative">
            <!-- Rows by Group -->
            {#each groupedTasks as [groupName, groupTasks]}
                
                <!-- Group Header Row -->
                <div class="flex items-center bg-gray-100/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700/50">
                    <div class="sticky left-0 z-10 bg-gray-100/80 dark:bg-gray-800/80 border-r border-gray-200 dark:border-gray-700 p-2 text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2 backdrop-blur-sm" style="width: {SIDEBAR_WIDTH}px; min-width: {SIDEBAR_WIDTH}px; height: {ROW_HEIGHT}px;">
                         {#if !['Unassigned', 'No Sprint'].includes(groupName)}
                            <span class="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] flex items-center gap-1">
                                {#if groupBy === 'project'}
                                    <Folder size={10} />
                                {:else}
                                    <Flag size={10} />
                                {/if}
                                {getGroupDisplayName(groupName)}
                            </span>
                        {:else}
                            <span class="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px] flex items-center gap-1">
                                {#if groupBy === 'project'}
                                    <Folder size={10} />
                                {:else}
                                    <Flag size={10} />
                                {/if}
                                {getGroupDisplayName(groupName)}
                            </span>
                        {/if}
                    </div>
                    <div class="relative items-center flex" style="width: {totalWidth}px; height: {ROW_HEIGHT}px;">
                        {#each timelineDates as _, idx}
                           <div class="absolute top-0 bottom-0 border-r border-dashed border-gray-200/50 dark:border-gray-700/30 pointer-events-none" style="left: {(idx + 1) * DAY_WIDTH}px;"></div>
                        {/each}
                    </div>
                </div>

                <!-- Tasks in Group -->
                {#each groupTasks as task}
                    <div class="flex items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                        <!-- Sidebar Item -->
                        <div class="sticky left-0 z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 border-r border-gray-200 dark:border-gray-700 p-3 text-sm truncate flex items-center justify-between" style="width: {SIDEBAR_WIDTH}px; min-width: {SIDEBAR_WIDTH}px; height: {ROW_HEIGHT}px;">
                            <span class="truncate pl-4 border-l-2 border-gray-100 dark:border-gray-700" title={task.title}>{task.title}</span>
                             <button class="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-500" on:click={() => handleTaskClick(task)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                            </button>
                        </div>

                        <!-- Gantt Bar Wrapper -->
                        <div class="relative items-center flex" style="width: {totalWidth}px; height: {ROW_HEIGHT}px;">
                             <!-- Grid Lines -->
                            {#each timelineDates as _, idx}
                               <div class="absolute top-0 bottom-0 border-r border-dashed border-gray-100 dark:border-gray-700 pointer-events-none" style="left: {(idx + 1) * DAY_WIDTH}px;"></div>
                            {/each}

                            <!-- The Bar -->
                            <div 
                                class="absolute rounded shadow-sm text-xs text-white px-2 flex items-center truncate cursor-pointer hover:opacity-90 transition-opacity
                                       {task.status === 'done' ? 'bg-green-500' : task.status === 'in-progress' ? 'bg-blue-500' : task.status === 'in-test' ? 'bg-purple-500' : 'bg-gray-400'}"
                                style="
                                    left: {getX(task._start)}px; 
                                    width: {Math.max(getWidth(task._start, task._end), DAY_WIDTH - 4)}px; 
                                    height: {ROW_HEIGHT - 12}px;
                                    margin-left: 2px;"
                                on:click={() => handleTaskClick(task)}
                                title="{task.title} ({task._start.toLocaleDateString()} - {task._end.toLocaleDateString()})"
                                role="button"
                                tabindex="0"
                                on:keydown={(e) => e.key === 'Enter' && handleTaskClick(task)}
                            >
                                {task.title}
                            </div>
                        </div>
                    </div>
                {/each}
            {/each}
        </div>
    </div>
</div>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.5);
        border-radius: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: rgba(156, 163, 175, 0.8);
    }
</style>
