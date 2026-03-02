<script lang="ts">
  import { _ } from "svelte-i18n";
  import { onMount, onDestroy } from "svelte";
  import type { Milestone } from "$lib/types/milestone";
  import { fade, scale } from "svelte/transition";
  import {
    Clock,
    Calendar,
    Pencil,
    Trash2,
    Rocket,
    EyeOff,
  } from "lucide-svelte";
  import ConfirmModal from "./ConfirmModal.svelte";
  import { api } from "$lib/apis";
  import { showMessage } from "$lib/stores/uiActions";

  let {
    milestone,
    onEdit,
    onDelete,
    onHide,
    isOwner = false,
  } = $props<{
    milestone: Milestone;
    onEdit?: (m: Milestone) => void;
    onDelete?: (m: Milestone) => void;
    onHide?: (m: Milestone) => void;
    isOwner?: boolean;
  }>();

  let showHideConfirm = $state(false);
  let isHiding = $state(false);

  async function handleToggleHide() {
    isHiding = true;
    try {
      const res = await api.workspaces.updateMilestone(
        milestone.workspace_id,
        milestone.id,
        {
          is_hidden: true,
        },
      );
      if (res.ok) {
        showMessage($_("page__success"));
        onHide?.(milestone);
      }
    } catch (e) {
      showMessage($_("page__error"), "error");
    } finally {
      isHiding = false;
      showHideConfirm = false;
    }
  }

  let timeLeft = $state({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOver: false,
  });

  const formatThaiDate = (dateStr: string) => {
    const months = [
      "ม.ค.",
      "ก.พ.",
      "มี.ค.",
      "เม.ย.",
      "พ.ค.",
      "มิ.ย.",
      "ก.ค.",
      "ส.ค.",
      "ก.ย.",
      "ต.ค.",
      "พ.ย.",
      "ธ.ค.",
    ];
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear() + 543; // Buddhist Era
    const time = date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${day} ${month} ${year} (${time} น.)`;
  };

  function calculateTime() {
    const target = new Date(milestone.target_date).getTime();
    const now = new Date().getTime();
    const diff = target - now;

    if (diff <= 0) {
      timeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true };
      return;
    }

    timeLeft = {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
      isOver: false,
    };
  }

  let interval: any;
  onMount(() => {
    calculateTime();
    interval = setInterval(calculateTime, 1000);
  });

  onDestroy(() => {
    clearInterval(interval);
  });
</script>

<div
  class="relative overflow-hidden p-6 rounded-3xl bg-linear-to-br from-indigo-600 via-indigo-700 to-purple-800 shadow-2xl shadow-indigo-500/30 group transition-all hover:scale-[1.005] border border-white/20"
  in:fade
>
  <!-- Animated Background Glow -->
  <div
    class="absolute -top-24 -left-24 w-64 h-64 bg-white/10 blur-[80px] rounded-full animate-pulse"
  ></div>
  <div
    class="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-400/20 blur-[80px] rounded-full animate-pulse"
  ></div>

  <div class="relative z-10 flex flex-col xl:flex-row gap-8 items-center">
    <!-- Header/Title -->
    <div class="flex-1 min-w-0 text-center xl:text-left">
      <div class="flex items-center justify-center xl:justify-start gap-3 mb-3">
        <div
          class="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 animate-bounce"
        >
          <Rocket class="w-6 h-6 text-white" />
        </div>
        <div>
          <h3
            class="text-2xl md:text-3xl font-black text-white truncate tracking-tight uppercase leading-none drop-shadow-lg"
          >
            {milestone.title}
          </h3>
          <p class="mt-1 text-sm text-indigo-100/70 font-medium tracking-wide">
            {formatThaiDate(milestone.target_date)}
          </p>
        </div>
      </div>
      <p
        class="text-sm md:text-base text-white/80 line-clamp-2 italic font-medium max-w-xl"
      >
        {milestone.description || $_("milestone.no_description")}
      </p>

      {#if isOwner}
        <div
          class="mt-5 flex items-center justify-center xl:justify-start gap-3 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <button
            onclick={() => onEdit?.(milestone)}
            class="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl transition-all border border-white/20 hover:border-white/40 group/btn"
            title={$_("milestone.edit_tooltip")}
          >
            <Pencil
              size={18}
              class="text-white group-hover/btn:scale-110 transition-transform"
            />
          </button>
          <button
            onclick={() => (showHideConfirm = true)}
            class="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl transition-all border border-white/20 hover:border-white/40 group/btn"
            title={$_("milestone.hide_tooltip")}
          >
            <EyeOff
              size={18}
              class="text-white group-hover/btn:scale-110 transition-transform"
            />
          </button>
        </div>
      {/if}
    </div>

    <!-- Countdown Units -->
    <div
      class="flex items-center gap-3 md:gap-6 shrink-0 bg-black/20 backdrop-blur-lg p-5 md:p-7 rounded-[2.5rem] border border-white/10 shadow-2xl"
    >
      {#each [{ label: "days", value: timeLeft.days, color: "from-blue-400 to-indigo-400" }, { label: "hours", value: timeLeft.hours, color: "from-indigo-400 to-purple-400" }, { label: "mins", value: timeLeft.minutes, color: "from-purple-400 to-pink-400" }, { label: "secs", value: timeLeft.seconds, color: "from-pink-400 to-rose-400" }] as unit}
        <div class="flex flex-col items-center">
          <div
            class="w-16 h-16 md:w-24 md:h-24 flex items-center justify-center bg-linear-to-b from-white/10 to-white/5 rounded-3xl border border-white/20 shadow-xl relative group/unit overflow-hidden"
          >
            <div
              class="absolute inset-0 bg-linear-to-br {unit.color} opacity-0 group-hover/unit:opacity-20 transition-opacity"
            ></div>
            <span
              class="text-3xl md:text-5xl font-black text-white tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
            >
              {String(unit.value).padStart(2, "0")}
            </span>
          </div>
          <span
            class="mt-3 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-white/50"
          >
            {$_(`milestone.${unit.label}`)}
          </span>
        </div>

        {#if unit.label !== "secs"}
          <div
            class="mb-8 text-white/30 font-black text-2xl md:text-4xl animate-pulse"
          >
            :
          </div>
        {/if}
      {/each}
    </div>

    <!-- Status Badge (Absolute for better visual impact) -->
    {#if timeLeft.isOver}
      <div
        class="absolute top-4 right-4 px-4 py-2 bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-full shadow-lg shadow-emerald-500/40 border border-white/20 animate-bounce"
      >
        {$_("milestone.reached")}
      </div>
    {/if}
  </div>
</div>

<ConfirmModal
  show={showHideConfirm}
  title={$_("milestone.hide_title")}
  message={$_("milestone.hide_confirm")}
  confirmText={$_("common.hide")}
  type="warning"
  onClose={() => (showHideConfirm = false)}
  onConfirm={handleToggleHide}
/>
