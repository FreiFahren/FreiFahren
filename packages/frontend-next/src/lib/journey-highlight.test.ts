import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearJourneyHighlight,
  getJourneyHighlight,
  setJourneyHighlight,
  subscribeToJourneyHighlight,
} from './journey-highlight';

// Module state is shared across tests in this file.
afterEach(() => clearJourneyHighlight());

describe('journey highlight store', () => {
  it('publishes the ids it was given', () => {
    setJourneyHighlight([1, 2, 3]);

    expect(getJourneyHighlight()).toEqual([1, 2, 3]);
  });

  it('notifies subscribers when the journey changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToJourneyHighlight(listener);

    setJourneyHighlight([1, 2, 3]);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('stays quiet when the same ids are published again', () => {
    /*
     * The journey refetches on a timer and almost always comes back identical. Without this
     * guard every poll would re-render the map layer for no visible change.
     */
    setJourneyHighlight([1, 2, 3]);
    const listener = vi.fn();
    const unsubscribe = subscribeToJourneyHighlight(listener);

    setJourneyHighlight([1, 2, 3]);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('notifies when the order changes', () => {
    // Order is meaning here: it is the sequence the rider travels.
    setJourneyHighlight([1, 2, 3]);
    const listener = vi.fn();
    const unsubscribe = subscribeToJourneyHighlight(listener);

    setJourneyHighlight([3, 2, 1]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getJourneyHighlight()).toEqual([3, 2, 1]);
    unsubscribe();
  });

  it('notifies when a segment is appended', () => {
    setJourneyHighlight([1, 2]);
    const listener = vi.fn();
    const unsubscribe = subscribeToJourneyHighlight(listener);

    setJourneyHighlight([1, 2, 3]);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('clears an active highlight and notifies once', () => {
    setJourneyHighlight([1, 2]);
    const listener = vi.fn();
    const unsubscribe = subscribeToJourneyHighlight(listener);

    clearJourneyHighlight();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getJourneyHighlight()).toEqual([]);
    unsubscribe();
  });

  it('stays quiet when clearing an already empty highlight', () => {
    // Leaving the journey view unmounts the layer; that must not churn the map.
    const listener = vi.fn();
    const unsubscribe = subscribeToJourneyHighlight(listener);

    clearJourneyHighlight();

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('returns a stable reference until the journey changes', () => {
    // useSyncExternalStore compares snapshots by identity; a fresh array per read would
    // make React re-render forever.
    setJourneyHighlight([1, 2]);

    expect(getJourneyHighlight()).toBe(getJourneyHighlight());
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToJourneyHighlight(listener);
    unsubscribe();

    setJourneyHighlight([9]);

    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies every subscriber', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeToJourneyHighlight(first);
    const unsubscribeSecond = subscribeToJourneyHighlight(second);

    setJourneyHighlight([4]);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    unsubscribeSecond();
  });
});
