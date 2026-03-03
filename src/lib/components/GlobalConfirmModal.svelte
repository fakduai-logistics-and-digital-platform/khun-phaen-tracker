<script lang="ts">
  import ConfirmModal from "./ConfirmModal.svelte";
  import { confirmModalStore } from "$lib/stores/confirmStore";
</script>

{#if $confirmModalStore.show}
  <ConfirmModal
    show={$confirmModalStore.show}
    title={$confirmModalStore.title}
    message={$confirmModalStore.message}
    confirmText={$confirmModalStore.confirmText}
    cancelText={$confirmModalStore.cancelText}
    type={$confirmModalStore.type}
    onConfirm={$confirmModalStore.onConfirm}
    onClose={$confirmModalStore.onClose}
  />
{/if}
