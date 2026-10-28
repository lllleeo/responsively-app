import {useEffect, useRef, useState, type PointerEvent, type RefObject} from 'react';
import {useDispatch} from 'react-redux';
import {setGridOrder, type PreviewSuite} from 'renderer/store/features/device-manager';

interface DropTarget {
  id: string;
  before: boolean;
}

/** Reorder with CSS order: moving Electron webview DOM nodes reloads their guests. */
export default function useGridReorder(
  enabled: boolean,
  suite: PreviewSuite,
  stage: RefObject<HTMLDivElement | null>,
  scroller: RefObject<HTMLDivElement | null>
) {
  const dispatch = useDispatch();
  const order = [...new Set([...(suite.gridOrder ?? []), ...suite.devices])].filter((id) =>
    suite.devices.includes(id)
  );
  const [source, setSource] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const targetRef = useRef<DropTarget | null>(null);
  const frame = useRef<number | null>(null);
  const drag = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);

  const cancel = () => {
    const current = drag.current;
    drag.current = null;
    targetRef.current = null;
    setSource(null);
    setTarget(null);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (current && stage.current?.hasPointerCapture(current.pointerId)) {
      stage.current.releasePointerCapture(current.pointerId);
    }
  };

  const deviceKey = suite.devices.join(',');
  useEffect(() => {
    cancel();
    return cancel;
    // Only membership/layout changes invalidate an in-flight gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, suite.id, deviceKey]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locateTarget = () => {
    const current = drag.current;
    const bounds = scroller.current?.getBoundingClientRect();
    let next: DropTarget | null = null;
    if (
      current?.active &&
      bounds &&
      current.x >= bounds.left &&
      current.x <= bounds.right &&
      current.y >= bounds.top &&
      current.y <= bounds.bottom
    ) {
      let nearest = Infinity;
      stage.current?.querySelectorAll<HTMLElement>('[data-grid-item]').forEach((item) => {
        const box = item.getBoundingClientRect();
        const dx = Math.max(box.left - current.x, 0, current.x - box.right);
        const dy = Math.max(box.top - current.y, 0, current.y - box.bottom);
        const distance = dx * dx + dy * dy;
        if (distance < nearest) {
          nearest = distance;
          next =
            item.dataset.gridItem === current.id
              ? null
              : {
                  id: item.dataset.gridItem!,
                  before:
                    current.y < box.top ||
                    (current.y <= box.bottom && current.x < box.left + box.width / 2),
                };
        }
      });
    }
    targetRef.current = next;
    setTarget((previous) =>
      previous?.id === next?.id && previous?.before === next?.before ? previous : next
    );
  };

  const scrollAtEdge = () => {
    const current = drag.current;
    const container = scroller.current;
    if (!current?.active || !container) return;
    const box = container.getBoundingClientRect();
    const speed = (point: number, min: number, max: number) =>
      point < min + 40 ? -12 : point > max - 40 ? 12 : 0;
    container.scrollBy(
      speed(current.x, box.left, box.right),
      speed(current.y, box.top, box.bottom)
    );
    locateTarget();
    frame.current = requestAnimationFrame(scrollAtEdge);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || event.button !== 0 || drag.current) return;
    const element = event.target as HTMLElement;
    if (
      !stage.current?.contains(element) ||
      !element.closest('[data-device-label], [data-grid-drag-handle]')
    )
      return;
    const item = element.closest<HTMLElement>('[data-grid-item]');
    if (!item) return;
    event.preventDefault();
    drag.current = {
      id: item.dataset.gridItem!,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
    };
    stage.current.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.x = event.clientX;
    current.y = event.clientY;
    if (
      !current.active &&
      Math.hypot(current.x - current.startX, current.y - current.startY) >= 5
    ) {
      current.active = true;
      setSource(current.id);
      frame.current = requestAnimationFrame(scrollAtEdge);
    }
    locateTarget();
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.x = event.clientX;
    current.y = event.clientY;
    locateTarget();
    const destination = targetRef.current;
    if (current.active && destination) {
      const reordered = order.filter((id) => id !== current.id);
      reordered.splice(
        reordered.indexOf(destination.id) + (destination.before ? 0 : 1),
        0,
        current.id
      );
      dispatch(setGridOrder({suite: suite.id, devices: reordered}));
    }
    cancel();
  };

  const moveByKey = (id: string, delta: number) => {
    const index = order.indexOf(id);
    const destination = index + delta;
    if (destination < 0 || destination >= order.length) return;
    const reordered = [...order];
    reordered.splice(index, 1);
    reordered.splice(destination, 0, id);
    dispatch(setGridOrder({suite: suite.id, devices: reordered}));
  };

  return {order, source, target, cancel, onPointerDown, onPointerMove, onPointerUp, moveByKey};
}
