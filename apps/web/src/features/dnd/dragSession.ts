import type { ModuleDragPayload } from '@resume/domain';

/** In-memory drag session — browsers often block getData() until drop. */
let active: ModuleDragPayload | null = null;

export function beginModuleDrag(payload: ModuleDragPayload): void {
  active = payload;
}

export function endModuleDrag(): void {
  active = null;
}

export function getActiveModuleDrag(): ModuleDragPayload | null {
  return active;
}
