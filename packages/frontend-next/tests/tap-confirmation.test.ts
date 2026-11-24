import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTapConfirmation, TAP_CONFIRMATION_MS } from '../src/lib/tap-confirmation';

describe('tap confirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('confirms a tap once no second tap followed', () => {
    const taps = createTapConfirmation();
    const onConfirm = vi.fn();
    taps.tap({ x: 100, y: 100 }, onConfirm);

    vi.advanceTimersByTime(TAP_CONFIRMATION_MS - 1);
    expect(onConfirm).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('cancels the tap when a second touch lands next to it', () => {
    const taps = createTapConfirmation();
    const onConfirm = vi.fn();
    taps.tap({ x: 100, y: 100 }, onConfirm);
    taps.touch({ x: 110, y: 105 });

    vi.advanceTimersByTime(TAP_CONFIRMATION_MS);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps the tap when the next touch lands elsewhere', () => {
    const taps = createTapConfirmation();
    const onConfirm = vi.fn();
    taps.tap({ x: 100, y: 100 }, onConfirm);
    taps.touch({ x: 200, y: 100 });

    vi.advanceTimersByTime(TAP_CONFIRMATION_MS);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('has nothing left to cancel after the tap was confirmed', () => {
    const taps = createTapConfirmation();
    const onConfirm = vi.fn();
    taps.tap({ x: 100, y: 100 }, onConfirm);
    vi.advanceTimersByTime(TAP_CONFIRMATION_MS);
    expect(taps.cancel()).toBe(false);
  });

  it('ignores the click of the second tap of a double tap', () => {
    const taps = createTapConfirmation();
    const onConfirm = vi.fn();
    taps.touch({ x: 100, y: 100 });
    taps.tap({ x: 100, y: 100 }, onConfirm);
    vi.advanceTimersByTime(150);
    taps.touch({ x: 105, y: 100 });
    taps.tap({ x: 105, y: 100 }, onConfirm);

    vi.advanceTimersByTime(TAP_CONFIRMATION_MS);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('ignores a first click that arrives after the second touch began', () => {
    const taps = createTapConfirmation();
    const onConfirm = vi.fn();
    taps.touch({ x: 100, y: 100 });
    vi.advanceTimersByTime(150);
    taps.touch({ x: 105, y: 100 });
    taps.tap({ x: 100, y: 100 }, onConfirm);

    vi.advanceTimersByTime(TAP_CONFIRMATION_MS);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('selects again once the double tap is over', () => {
    const taps = createTapConfirmation();
    const onConfirm = vi.fn();
    taps.touch({ x: 100, y: 100 });
    taps.tap({ x: 100, y: 100 }, vi.fn());
    taps.touch({ x: 100, y: 100 });

    vi.advanceTimersByTime(1000);
    taps.touch({ x: 100, y: 100 });
    taps.tap({ x: 100, y: 100 }, onConfirm);
    vi.advanceTimersByTime(TAP_CONFIRMATION_MS);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('replaces a pending tap with a newer one', () => {
    const taps = createTapConfirmation();
    const first = vi.fn();
    const second = vi.fn();
    taps.tap({ x: 100, y: 100 }, first);
    taps.tap({ x: 300, y: 300 }, second);

    vi.advanceTimersByTime(TAP_CONFIRMATION_MS);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
