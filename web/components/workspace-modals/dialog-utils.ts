/**
 * Managers open confirmation dialogs that are separate Radix dialogs. Without this, pointer or focus
 * moving into the child dialog counts as an outside interaction and dismisses the manager.
 */
export function keepOpenWhileNestedDialogOpen(event: { preventDefault: () => void }) {
  const openDialogs = document.querySelectorAll(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
  );
  if (openDialogs.length > 1) event.preventDefault();
}
