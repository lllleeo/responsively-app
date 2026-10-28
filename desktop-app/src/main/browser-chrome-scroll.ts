interface ScrollPosition {
  y: number;
  viewport: number;
}

/** Capture actual document/nested scrolling, including mirrored scrolling. */
export function observeBrowserChromeScroll(send: (data: {y: number; deltaY: number}) => void) {
  const positions = new WeakMap<Element, ScrollPosition>();
  let pending: {y: number; deltaY: number} | null = null;
  let frame: number | null = null;
  const scroll = (event: Event) => {
    const target = event.target === document ? document.scrollingElement : event.target;
    if (!(target instanceof Element)) return;
    const viewport = target.clientHeight;
    const maxScroll = Math.max(0, target.scrollHeight - viewport);
    const y = Math.max(0, Math.min(target.scrollTop, maxScroll));
    const previous = positions.get(target);
    positions.set(target, {y, viewport});
    const deltaY = y - (previous?.y ?? 0);
    if (deltaY === 0) return;
    // A larger viewport can clamp scrollTop at the bottom. Ignore only that
    // adjustment, not a real scroll arriving in the same frame as a resize.
    // Reading scrollTop in a resize handler would consume that pending scroll.
    if (previous && viewport !== previous.viewport) {
      const clamped = viewport > previous.viewport && previous.y > maxScroll && y === maxScroll;
      const anchored = Math.abs(previous.y + previous.viewport - y - viewport) <= 1;
      if (clamped || anchored) return;
    }
    pending = {y, deltaY: (pending?.deltaY ?? 0) + deltaY};
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      if (pending) send(pending);
      pending = null;
    });
  };
  window.addEventListener('scroll', scroll, {capture: true, passive: true});
  return () => {
    window.removeEventListener('scroll', scroll, true);
    if (frame !== null) window.cancelAnimationFrame(frame);
    pending = null;
  };
}
