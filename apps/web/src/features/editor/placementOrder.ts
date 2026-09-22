/**
 * Pure helpers for placement reorder decisions (S4).
 * Server remains source of truth; TipTap rehydrates after API success.
 */

export type MoveDirection = 'up' | 'down';

/** Swap placementId one step within ordered ids; null if cannot move. */
export function movePlacementId(
  orderedIds: readonly string[],
  placementId: string,
  direction: MoveDirection,
): string[] | null {
  const index = orderedIds.indexOf(placementId);
  if (index < 0) return null;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= orderedIds.length) return null;
  const next = [...orderedIds];
  const a = next[index]!;
  const b = next[target]!;
  next[index] = b;
  next[target] = a;
  return next;
}

export function canMovePlacement(
  orderedIds: readonly string[],
  placementId: string,
  direction: MoveDirection,
): boolean {
  return movePlacementId(orderedIds, placementId, direction) !== null;
}
