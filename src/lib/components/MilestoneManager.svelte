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

  $: if (editTask && !editingId) {
    editMilestone(editTask);
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
        milestones = await res.json();
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
  class="fixed inset-0 z-100 flex items-start justify-center p-4 pt-16 md:pt-24 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
  in:fade={{ duration: 200 }}
>
  <div
    class="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200/50 dark:border-white/10 mb-8"
    in:scale={{ start: 0.95, duration: 200 }}
  >
    <!-- Header -->
    <div
      class="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-slate-900"
    >
      <div class="flex items-center gap-4">
        <div
          class="p-3 bg-linear-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20"
        >
          <Rocket size={24} />
        </div>
        <div>
          <h2
            class="text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight uppercase"
          >
            {$_("milestone.manager_title")}
          </h2>
          <p class="text-sm font-medium text-slate-400">
            {$_("milestone.manager_subtitle")}
          </p>
        </div>
      </div>
      <button
        onclick={() => dispatch("close")}
        class="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all"
      >
        <X size={24} />
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-8 pt-6 space-y-8">
      {#if error}
        <div
          class="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-bold flex items-center gap-3 animate-shake"
        >
          <Info size={18} />
          {error}
        </div>
      {/if}

      {#if showForm && isOwner}
        <div
          class="p-8 bg-slate-50 dark:bg-white/5 rounded-4xl border border-slate-200/50 dark:border-white/10 space-y-6 shadow-sm"
          transition:slide
        >
          <div class="flex items-center justify-between">
            <h3
              class="text-xs font-black uppercase tracking-widest text-indigo-500"
            >
              {editingId
                ? $_("milestone.edit_title")
                : $_("milestone.add_title")}
            </h3>
            <button
              onclick={resetForm}
              class="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              {$_("common.cancel")}
            </button>
          </div>

          <div class="space-y-5">
            <div>
              <label
                class="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-[0.2em]"
                for="title"
              >
                {$_("milestone.form_title")}
              </label>
              <input
                id="title"
                type="text"
                bind:value={title}
                placeholder="e.g. Production Go-Live"
                class="w-full px-5 py-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label
                class="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-[0.2em]"
                for="desc"
              >
                {$_("milestone.form_desc")}
              </label>
              <textarea
                id="desc"
                bind:value={description}
                rows="2"
                class="w-full px-5 py-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white font-medium resize-none"
              ></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label
                  class="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-[0.2em]"
                  for="date"
                >
                  {$_("milestone.form_date")}
                </label>
                <div class="relative">
                  <Calendar
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                    size={20}
                  />
                  <input
                    id="date"
                    type="date"
                    bind:value={targetDate}
                    class="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label
                  class="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-[0.2em]"
                  for="target-hour"
                >
                  {$_("milestone.form_time")}
                </label>
                <div class="flex items-center gap-2">
                  <div class="relative flex-1">
                    <Clock
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                      size={18}
                    />
                    <select
                      id="target-hour"
                      bind:value={targetHour}
                      class="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white font-bold appearance-none cursor-pointer"
                    >
                      {#each hours as h}
                        <option value={h}>{h}</option>
                      {/each}
                    </select>
                  </div>
                  <span class="text-xl font-black text-slate-300">:</span>
                  <div class="relative flex-1">
                    <select
                      bind:value={targetMinute}
                      class="w-full px-4 py-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white font-bold appearance-none cursor-pointer text-center"
                    >
                      {#each minutes as m}
                        <option value={m}>{m}</option>
                      {/each}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <button
              onclick={handleSubmit}
              disabled={submitting || !title || !targetDate}
              class="w-full py-4 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-3 mt-4"
            >
              {#if submitting}
                <Loader2 size={20} class="animate-spin" />
              {:else}
                <CheckCircle2 size={20} />
              {/if}
              {editingId ? $_("common.update") : $_("common.save")}
            </button>
          </div>
        </div>
      {:else if isOwner}
        <button
          onclick={() => (showForm = true)}
          class="w-full py-6 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl text-slate-400 hover:text-indigo-500 hover:border-indigo-500/30 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-all group flex flex-col items-center justify-center gap-2"
        >
          <div
            class="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-all group-hover:scale-110"
          >
            <Plus size={28} />
          </div>
          <span class="font-black text-xs uppercase tracking-widest">
            {$_("milestone.add_btn")}
          </span>
        </button>
      {/if}

      <div class="space-y-4">
        <h3
          class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 dark:text-slate-600 flex items-center gap-4"
        >
          <span class="shrink-0">{$_("milestone.list_title")}</span>
          <div class="h-px w-full bg-slate-100 dark:bg-white/5"></div>
        </h3>

        {#if loading}
          <div class="flex justify-center py-16">
            <Loader2 class="animate-spin text-indigo-500/50" size={48} />
          </div>
        {:else if milestones.length === 0}
          <div
            class="text-center py-20 px-8 bg-slate-50/50 dark:bg-white/5 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-white/5"
          >
            <Rocket
              class="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4 opacity-50"
            />
            <p class="text-slate-400 font-bold italic">
              {$_("milestone.no_milestones")}
            </p>
          </div>
        {:else}
          <div class="grid gap-4">
            {#each milestones as m (m.id || (m as any)._id || Math.random())}
              {@const mid = m.id || (m as any)._id}
              <div
                class="group p-5 bg-white dark:bg-white/2 border border-slate-200/50 dark:border-white/5 rounded-4xl hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all flex items-center gap-5"
              >
                <div
                  class="w-14 h-14 rounded-2xl bg-linear-to-br from-slate-50 to-slate-100 dark:from-white/5 dark:to-white/10 flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0 group-hover:from-indigo-50 group-hover:to-indigo-100 dark:group-hover:from-indigo-500/10 dark:group-hover:to-indigo-500/20 group-hover:text-indigo-500 transition-all shadow-inner"
                >
                  <Rocket size={24} />
                </div>

                <div class="flex-1 min-w-0 {m.is_hidden ? 'opacity-50' : ''}">
                  <div class="flex items-center gap-2">
                    <h4
                      class="font-black text-lg text-slate-900 dark:text-white truncate tracking-tight uppercase"
                    >
                      {m.title}
                    </h4>
                    {#if m.is_hidden}
                      <span
                        class="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-tighter rounded-md"
                      >
                        Hidden
                      </span>
                    {/if}
                  </div>
                  <div class="flex items-center gap-3 mt-1">
                    <div
                      class="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-md text-[10px] font-black text-slate-400 uppercase tracking-tighter"
                    >
                      <Calendar size={10} />
                      {formatThaiDateShort(m.target_date)}
                    </div>
                    <div
                      class="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-md text-[10px] font-black text-slate-400 uppercase tracking-tighter"
                    >
                      <Clock size={10} />
                      {new Date(m.target_date).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    {#if new Date(m.target_date) < new Date()}
                      <span
                        class="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-tighter rounded-md"
                        >Reached</span
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
                      class="p-3 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-2xl transition-all"
                      title={m.is_hidden ? "Show" : "Hide"}
                    >
                      {#if m.is_hidden}
                        <Eye size={20} />
                      {:else}
                        <EyeOff size={20} />
                      {/if}
                    </button>
                    <button
                      onclick={() => editMilestone(m)}
                      class="p-3 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-2xl transition-all"
                    >
                      <Pencil size={20} />
                    </button>
                    <button
                      onclick={() => requestDelete(m.id)}
                      class="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-2xl transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                {/if}

                <ChevronRight
                  class="text-slate-200 dark:text-slate-800 group-hover:text-indigo-200 transition-colors shrink-0"
                  size={24}
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
  on:close={() => (showDeleteConfirm = false)}
  on:confirm={deleteMilestone}
/>
