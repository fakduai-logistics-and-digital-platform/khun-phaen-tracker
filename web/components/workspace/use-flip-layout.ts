import { useLayoutEffect, useRef, type RefObject } from "react";

const DURATION_MS = 220;

/**
 * Slides elements marked `data-flip-id` from their previous layout position to the new one whenever `deps`
 * change, so cards below an inserted or removed card glide out of the way instead of jumping.
 * Positions are measured with offsetLeft/offsetTop (relative to the root, transforms excluded) and the glide
 * uses the `translate` property, so it composes with the transforms dnd-kit applies while dragging.
 */
export function useFlipLayout(root: RefObject<HTMLElement | null>, skip: RefObject<boolean>, deps: unknown[]) {
  const previous = useRef(new Map<string, { x: number; y: number }>());

  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const next = new Map<string, { x: number; y: number }>();
    container.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
      const id = el.dataset.flipId!;
      const position = { x: el.offsetLeft, y: el.offsetTop };
      next.set(id, position);
      const before = previous.current.get(id);
      if (skip.current || !before || el.dataset.flipActive === "true") return;
      const dx = before.x - position.x;
      const dy = before.y - position.y;
      if (dx === 0 && dy === 0) return;
      el.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], {
        duration: DURATION_MS,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      });
    });
    previous.current = next;
    skip.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
