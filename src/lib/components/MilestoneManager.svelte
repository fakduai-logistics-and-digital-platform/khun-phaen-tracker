<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { _ } from "svelte-i18n";
  import { fade, slide, scale } from "svelte/transition";
  import {
    Clock,
    X,
    Plus,
    Calendar,
    Pencil,
    Trash2,
    Rocket,
    Eye,
    EyeOff,
    Info,
    CheckCircle2,
    ChevronRight,
    Loader2,
  } from "lucide-svelte";
  import ConfirmModal from "./ConfirmModal.svelte";
  import type { Milestone, CreateMilestoneRequest } from "$lib/types/milestone";
  import { api } from "$lib/apis";

  export let workspaceId: string;
  export let isOwner: boolean = false;
  export let editTask: Milestone | null = null;

  // Track which editTask we already consumed to prevent re-trigger after resetForm
  let consumedEditTaskId: string | null = null;

  $: if (!editTask) {
    consumedEditTaskId = null;
  }

  $: if (editTask && !editingId) {
    const etId = editTask.id || (editTask as any)._id;
    if (etId !== consumedEditTaskId) {
      consumedEditTaskId = etId;
      editMilestone(editTask);
    }
  }

  const dispatch = createEventDispatcher();

  let milestones: Milestone[] = [];
  let loading = true;
  let showForm = false;
  let editingId: string | null = null;

  let title = "";
  let description = "";
  let targetDate = "";
  let targetHour = "09";
  let targetMinute = "00";
  let submitting = false;
  let error = "";
  let showDeleteConfirm = false;
  let deletingMilestoneId: string | null = null;

  const hours = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0"),
  );
  const minutes = Array.from({ length: 12 }, (_, i) =>
    String(i * 5).padStart(2, "0"),
  );

  onMount(fetchMilestones);

  async function fetchMilestones() {
    loading = true;
    try {
      const res = await api.workspaces.getMilestones(workspaceId);
      if (res.ok) {
        const data = await res.json();
        milestones = (data || []).map((m: any) => ({
          ...m,
          id: m.id || m._id || "",
          workspace_id:
            typeof m.workspace_id === "object" && m.workspace_id.$oid
              ? m.workspace_id.$oid
              : m.workspace_id,
        }));
      }
    } catch (e) {
      error = "Failed to load milestones";
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    title = "";
    description = "";
    targetDate = "";
    targetHour = "09";
    targetMinute = "00";
    editingId = null;
    showForm = false;
    error = "";
  }

  async function handleSubmit() {
    if (!title || !targetDate) return;
    submitting = true;
    error = "";

    // Combine date and time to ISO string
    const combinedIso = `${targetDate}T${targetHour}:${targetMinute}:00Z`;

    try {
      let res;
      if (editingId) {
        res = await api.workspaces.updateMilestone(workspaceId, editingId, {
          title,
          description,
          target_date: combinedIso,
        });
      } else {
        res = await api.workspaces.createMilestone(workspaceId, {
          title,
          description,
          target_date: combinedIso,
        });
      }

      if (res.ok) {
        await fetchMilestones();
        resetForm();
        dispatch("updated");
      } else {
        const errorData = await res.json().catch(() => ({}));
        error = errorData.message || "Failed to save milestone";
      }
    } catch (e) {
      error = "Connection error. Please try again.";
    } finally {
      submitting = false;
    }
  }

  function editMilestone(m: Milestone) {
    // Robust ID handling (can be id or _id depending on backend serialization)
    const mid = m.id || (m as any)._id;
    if (!mid) {
      error = "Cannot edit: Milestone ID missing";
      return;
    }

    editingId = mid;
    title = m.title;
    description = m.description || "";

    const dateObj = new Date(m.target_date);
    // Use UTC methods to match the 'Z' appended in handleSubmit
    targetDate = dateObj.toISOString().split("T")[0];
    targetHour = String(dateObj.getUTCHours()).padStart(2, "0");
    targetMinute = String(Math.floor(dateObj.getUTCMinutes() / 5) * 5).padStart(
      2,
      "0",
    );
    showForm = true;
  }

  function requestDelete(id: string) {
    deletingMilestoneId = id;
    showDeleteConfirm = true;
  }

  function deleteMilestone() {
    if (!deletingMilestoneId) return;
    const id = deletingMilestoneId;

    // Optimistic update
    milestones = milestones.filter((m) => m.id !== id);
    dispatch("updated");

    // Fire and forget
    api.workspaces.deleteMilestone(workspaceId, id).catch((e) => {
      console.error("Failed to delete milestone:", e);
      // Optional: rollback? User said "don't wait", so usually we just go ahead.
    });

    showDeleteConfirm = false;
    deletingMilestoneId = null;
  }

  async function toggleVisibility(m: Milestone) {
    const mid = m.id || (m as any)._id;
    try {
      const res = await api.workspaces.updateMilestone(workspaceId, mid, {
        is_hidden: !m.is_hidden,
      });
      if (res.ok) {
        await fetchMilestones();
        dispatch("updated");
      }
    } catch (e) {
      error = "Failed to toggle visibility";
    }
  }

  const formatThaiDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  };
</script>

<div
  class="fixed inset-0 z-100 flex items-start justify-center p-4 pt-16 md:pt-24 bg-black/35 backdrop-blur-sm overflow-y-auto"
  in:fade={{ duration: 200 }}
>
  <div
    class="bg-white dark:bg-[#1a263b] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col border border-white/10 dark:border-white/10 mb-8"
    in:scale={{ start: 0.95, duration: 200 }}
  >
    <!-- Header -->
    <div
      class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
    >
      <h2
        class="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2"
      >
        <Rocket size={20} class="text-primary" />
        {$_("milestone.manager_title")}
      </h2>
      <button
        onclick={() => dispatch("close")}
        class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <X size={20} />
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      {#if error}
        <div
          class="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg text-rose-600 dark:text-rose-400 text-sm font-medium flex items-center gap-3"
        >
          <Info size={18} />
          {error}
        </div>
      {/if}

      {#if showForm && isOwner}
        <div
          class="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-5"
          transition:slide
        >
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-white">
              {editingId
                ? $_("milestone.edit_title")
                : $_("milestone.add_title")}
            </h3>
            <button
              onclick={resetForm}
              class="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              {$_("common.cancel")}
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                for="title"
              >
                {$_("milestone.form_title")}
              </label>
              <input
                id="title"
                type="text"
                bind:value={title}
                placeholder="e.g. Production Go-Live"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                for="desc"
              >
                {$_("milestone.form_desc")}
              </label>
              <textarea
                id="desc"
                bind:value={description}
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white resize-none"
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label
                  class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"
                  for="date"
                >
                  <Calendar size={14} />{$_("milestone.form_date")}
                </label>
                <input
                  id="date"
                  type="date"
                  bind:value={targetDate}
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label
                  class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"
                  for="target-hour"
                >
                  <Clock size={14} />{$_("milestone.form_time")}
                </label>
                <div class="flex items-center gap-2">
                  <select
                    id="target-hour"
                    bind:value={targetHour}
                    class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white appearance-none cursor-pointer"
                  >
                    {#each hours as h}
                      <option value={h}>{h}</option>
                    {/each}
                  </select>
                  <span class="text-lg font-bold text-gray-400">:</span>
                  <select
                    bind:value={targetMinute}
                    class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white appearance-none cursor-pointer text-center"
                  >
                    {#each minutes as m}
                      <option value={m}>{m}</option>
                    {/each}
                  </select>
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button
                onclick={resetForm}
                class="min-w-24 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                {$_("common.cancel")}
              </button>
              <button
                onclick={handleSubmit}
                disabled={submitting || !title || !targetDate}
                class="min-w-24 bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {#if submitting}
                  <Loader2 size={16} class="animate-spin" />
                {/if}
                {editingId ? $_("common.update") : $_("common.save")}
              </button>
            </div>
          </div>
        </div>
      {:else if isOwner}
        <button
          onclick={() => (showForm = true)}
          class="w-full py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-400 hover:text-primary hover:border-primary/40 dark:hover:bg-white/5 transition-all group flex flex-col items-center justify-center gap-2"
        >
          <div
            class="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg group-hover:bg-primary/10 dark:group-hover:bg-primary/20 transition-all group-hover:scale-110"
          >
            <Plus size={24} />
          </div>
          <span class="font-medium text-sm">
            {$_("milestone.add_btn")}
          </span>
        </button>
      {/if}

      <div class="space-y-3">
        <h3
          class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-3"
        >
          <span class="shrink-0">{$_("milestone.list_title")}</span>
          <div class="h-px w-full bg-gray-200 dark:bg-gray-700"></div>
        </h3>

        {#if loading}
          <div class="flex justify-center py-16">
            <Loader2 class="animate-spin text-indigo-500/50" size={48} />
          </div>
        {:else if milestones.length === 0}
          <div
            class="text-center py-16 px-8 dark:bg-gray-800/30 rounded-lg border border-dashed border-gray-300 dark:border-gray-600"
          >
            <Rocket
              class="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3 opacity-50"
            />
            <p class="text-gray-400 font-medium">
              {$_("milestone.no_milestones")}
            </p>
          </div>
        {:else}
          <div class="grid gap-4">
            {#each milestones as m (m.id || (m as any)._id || Math.random())}
              {@const mid = m.id || (m as any)._id}
              <div
                class="group p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary/30 dark:hover:border-primary/30 hover:bg-white/50 dark:hover:bg-white/3 transition-all flex items-center gap-4 {m.is_hidden
                  ? 'opacity-30 grayscale'
                  : ''}"
              >
                <div
                  class="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 shrink-0 group-hover:bg-primary/10 dark:group-hover:bg-primary/15 group-hover:text-primary transition-all"
                >
                  <Rocket size={20} />
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <h4
                      class="font-semibold text-base text-gray-800 dark:text-white truncate"
                    >
                      {m.title}
                    </h4>
                    {#if m.is_hidden}
                      <span
                        class="px-2 py-0.5 bg-amber-500/15 text-amber-500 text-xs font-medium rounded"
                      >
                        {$_("milestone.hidden_badge")}
                      </span>
                    {/if}
                  </div>
                  <div class="flex items-center gap-2 mt-1">
                    <div
                      class="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      <Calendar size={11} />
                      {formatThaiDateShort(m.target_date)}
                    </div>
                    <div
                      class="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      <Clock size={11} />
                      {new Date(m.target_date).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    {#if new Date(m.target_date) < new Date()}
                      <span
                        class="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-xs font-medium rounded"
                        >{$_("milestone.reached_badge")}</span
                      >
                    {/if}
                  </div>
                </div>

                {#if isOwner}
                  <div
                    class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0"
                  >
                    <button
                      onclick={() => toggleVisibility(m)}
                      class="p-2 text-gray-400 hover:text-primary dark:hover:bg-white/5 rounded-lg transition-all"
                      title={m.is_hidden
                        ? $_("milestone.show_tooltip")
                        : $_("milestone.hide_tooltip")}
                    >
                      {#if m.is_hidden}
                        <Eye size={18} />
                      {:else}
                        <EyeOff size={18} />
                      {/if}
                    </button>
                    <button
                      onclick={() => editMilestone(m)}
                      class="p-2 text-gray-400 hover:text-primary dark:hover:bg-white/5 rounded-lg transition-all"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onclick={() => requestDelete(m.id)}
                      class="p-2 text-gray-400 hover:text-red-500 dark:hover:bg-red-500/5 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                {/if}

                <ChevronRight
                  class="text-gray-300 dark:text-gray-600 group-hover:text-primary/40 transition-colors shrink-0"
                  size={20}
                />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<ConfirmModal
  show={showDeleteConfirm}
  title={$_("milestone.delete_title")}
  message={$_("milestone.confirm_delete")}
  confirmText={$_("taskList__delete")}
  type="danger"
  onClose={() => (showDeleteConfirm = false)}
  onConfirm={deleteMilestone}
/>
