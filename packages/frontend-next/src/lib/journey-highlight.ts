/*
 * Segment ids of the journey currently on screen. The result view lives in the map
 * layout's outlet while the layer that paints it lives inside the lazily-loaded map,
 * so the two cannot pass props — the same reason useRiskLayer keeps its state in a
 * module store rather than context.
 *
 * Plain module state with no React import, so the behaviour below is testable on its own.
 */
let segmentIds: readonly number[] = [];
const listeners = new Set<() => void>();

const sameIds = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

const emit = () => {
  for (const listener of listeners) listener();
};

export function setJourneyHighlight(ids: readonly number[]): void {
  // The journey refetches on a timer and almost always comes back identical; re-publishing
  // an unchanged set would re-render the map layer for nothing.
  if (sameIds(ids, segmentIds)) return;
  segmentIds = ids;
  emit();
}

export function clearJourneyHighlight(): void {
  if (segmentIds.length === 0) return;
  segmentIds = [];
  emit();
}

export function subscribeToJourneyHighlight(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable reference until the journey actually changes — useSyncExternalStore compares by identity. */
export function getJourneyHighlight(): readonly number[] {
  return segmentIds;
}
