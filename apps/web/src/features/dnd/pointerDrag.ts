import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ModuleDragPayload, SectionId } from '@resume/domain';
import {
  cancelModuleDrag,
  clearPointerPick,
  getPlaceSnapshot,
  moveModuleDrag,
  pressModuleDrag,
  registerDropZone,
  releaseModuleDrag,
  subscribePlaceSession,
} from './dragSession';
import { judgeDrop } from './dropTarget';

const NON_DRAG_TARGETS = 'button, a, input, textarea, select, .cdb__card-actions';

function createGhost(label: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'module-drag-ghost';
  el.textContent = label;
  document.body.appendChild(el);
  return el;
}

function suppressNextClick(): void {
  const swallow = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, true), 0);
}

export interface ModuleDragOptions {
  /** Released outside any drop zone. */
  onMiss?: () => void;
}

/** Wire from a library card's onPointerDown. */
export function startModulePointerDrag(
  e: ReactPointerEvent<HTMLElement>,
  payload: ModuleDragPayload,
  label: string,
  opts: ModuleDragOptions = {},
): void {
  if (e.button !== 0 || !e.isPrimary) return;
  if (e.target instanceof Element && e.target.closest(NON_DRAG_TARGETS)) return;

  const source = e.currentTarget;
  const pointerId = e.pointerId;
  let ghost: HTMLElement | null = null;
  pressModuleDrag(payload, label, { x: e.clientX, y: e.clientY });

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    if (!moveModuleDrag({ x: ev.clientX, y: ev.clientY })) return;
    ev.preventDefault();
    if (!ghost) {
      ghost = createGhost(label);
      document.documentElement.classList.add('module-dragging');
      try {
        source.setPointerCapture(pointerId);
      } catch {
        // Source may have been detached by a re-render; window listeners still track.
      }
    }
    const hover = getPlaceSnapshot().hoverSection;
    ghost.dataset.state =
      hover == null ? 'idle' : judgeDrop(payload, hover).ok ? 'ok' : 'invalid';
    ghost.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 12}px)`;
  };

  const finish = () => {
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onCancel, true);
    window.removeEventListener('keydown', onKey, true);
    ghost?.remove();
    document.documentElement.classList.remove('module-dragging');
    try {
      if (source.hasPointerCapture(pointerId)) source.releasePointerCapture(pointerId);
    } catch {
      // ignore
    }
  };

  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    finish();
    const outcome = releaseModuleDrag({ x: ev.clientX, y: ev.clientY });
    if (outcome === 'click') return;
    suppressNextClick();
    if (outcome === 'missed') opts.onMiss?.();
  };

  const onCancel = () => {
    finish();
    cancelModuleDrag();
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') onCancel();
  };

  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
  window.addEventListener('keydown', onKey, true);
}

export function usePlaceSnapshot() {
  return useSyncExternalStore(subscribePlaceSession, getPlaceSnapshot);
}

export interface DropZoneHandlers {
  onAccept: (moduleId: string) => void;
  onReject: (message: string) => void;
}

/**
 * Registers an element as the drop target for `section` (pointer drag) and
 * reports highlight state for both drag and 「放入」. `placePicked` handles a
 * click on the zone; a wrong-section click keeps the 「放入」 pick armed.
 */
export function useDropZone<T extends HTMLElement>(
  section: SectionId,
  handlers: DropZoneHandlers,
) {
  const ref = useRef<T>(null);

  const place = (payload: ModuleDragPayload): boolean => {
    const verdict = judgeDrop(payload, section);
    if (!verdict.ok) {
      handlers.onReject(verdict.message);
      return false;
    }
    handlers.onAccept(payload.moduleId);
    return true;
  };
  const placeRef = useRef(place);
  useEffect(() => {
    placeRef.current = place;
  });

  useEffect(
    () =>
      registerDropZone({
        section,
        getRect: () => ref.current?.getBoundingClientRect() ?? null,
        onDrop: (payload) => placeRef.current(payload),
      }),
    [section],
  );

  const snap = usePlaceSnapshot();
  const payload = snap.dragging ?? snap.picked;
  const compatible = payload != null && judgeDrop(payload, section).ok;
  const hovered = snap.dragging != null && snap.hoverSection === section;

  const placePicked = () => {
    const picked = getPlaceSnapshot().picked;
    if (picked && place(picked)) clearPointerPick();
  };

  return { ref, active: compatible, invalid: hovered && !compatible, placePicked };
}
