import { useSyncExternalStore } from 'react';

/*
 * Segment ids of the journey currently on screen. The result view lives in the map
 * layout's outlet while the layer that paints it lives inside the lazily-loaded map,
 * so the two cannot pass props — the same reason useRiskLayer keeps its state in a
 * module store rather than context.
 */
let segmentIds: readonly number[] = [];
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

export function setJourneyHighlight(ids: readonly number[]): void {
  // Reference equality is what useSyncExternalStore compares, so bail out on an
  // unchanged set instead of re-rendering the map layer on every poll.
  if (ids.length === segmentIds.length && ids.every((id, index) => id === segmentIds[index]))
    return;
  segmentIds = ids;
  emit();
}

export function clearJourneyHighlight(): void {
  if (segmentIds.length === 0) return;
  segmentIds = [];
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useJourneyHighlight(): readonly number[] {
  return useSyncExternalStore(subscribe, () => segmentIds);
}
