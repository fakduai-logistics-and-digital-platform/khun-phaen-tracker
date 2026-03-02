<script lang="ts">
  import { onMount } from "svelte";
  import { _ } from "svelte-i18n";

  export let message = "";
  export let type: "success" | "error" = "success";
  export let duration = 3000;

  let timeout: ReturnType<typeof setTimeout>;

  $: if (message) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      message = "";
    }, duration);
  }

  onMount(() => {
    return () => clearTimeout(timeout);
  });
</script>

{#if message}
  <div class="fixed top-20 right-4 z-10000 animate-fade-in">
    <div
      class="{type === 'success'
        ? 'bg-success'
        : 'bg-danger'} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2"
    >
      {#if type === "success"}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg
        >
      {:else}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          ><circle cx="12" cy="12" r="10"></circle><line
            x1="12"
            y1="8"
            x2="12"
            y2="12"
          ></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg
        >
      {/if}
      {message}
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
</style>
