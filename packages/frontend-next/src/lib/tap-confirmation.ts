// A tap on the map selects, a double tap zooms, and when the first finger lifts nobody can know
// which one it is. Native map apps hold the single tap back until a second one is ruled out
// (Android's "single tap confirmed", iOS's "require the double tap to fail"); this does the same.

// Android's double-tap timeout, measured like Android does: from the first tap's end to the second
// touch's start. MapLibre's own window is 500 ms, but holding every selection that long is sluggish.
export const TAP_CONFIRMATION_MS = 300;

// How far apart two taps may land and still count as a double tap; MapLibre's value, so a touch
// that cancels the selection here is one MapLibre zooms on.
const DOUBLE_TAP_MAX_DISTANCE_PX = 30;

// MapLibre's double-tap window. Two touches this close in time and place are a double tap, whatever
// order the browser delivers their clicks in, so no click around them may select.
const DOUBLE_TAP_WINDOW_MS = 500;

type Point = { x: number; y: number };

type PendingTap = {
  point: Point;
  timer: ReturnType<typeof setTimeout>;
};

export type TapConfirmation = {
  /** Holds a tap back: `onConfirm` runs once no second tap followed. Ignored during a double tap. */
  tap: (point: Point, onConfirm: () => void) => void;
  /** A new touch on the map. Cancels the pending tap when it lands close enough to double-tap. */
  touch: (point: Point) => void;
  /** Drops the pending tap. Returns whether there was one. */
  cancel: () => boolean;
};

export function createTapConfirmation(): TapConfirmation {
  let pending: PendingTap | undefined;
  let lastTouch: { point: Point; time: number } | undefined;
  let doubleTapUntil = 0;

  const isNear = (a: Point, b: Point) =>
    Math.hypot(a.x - b.x, a.y - b.y) < DOUBLE_TAP_MAX_DISTANCE_PX;

  const cancel = () => {
    if (!pending) return false;
    clearTimeout(pending.timer);
    pending = undefined;
    return true;
  };

  return {
    tap(point, onConfirm) {
      cancel();
      // The click of either tap of a double tap. The first one's can arrive after the second touch
      // began, and the second one's is not always suppressed by the zoom.
      if (Date.now() < doubleTapUntil) return;
      const timer = setTimeout(() => {
        pending = undefined;
        onConfirm();
      }, TAP_CONFIRMATION_MS);
      pending = { point, timer };
    },
    touch(point) {
      const now = Date.now();
      const followsTouch =
        lastTouch !== undefined &&
        now - lastTouch.time < DOUBLE_TAP_WINDOW_MS &&
        isNear(point, lastTouch.point);
      lastTouch = { point, time: now };
      if (followsTouch || (pending && isNear(point, pending.point))) {
        cancel();
        doubleTapUntil = now + DOUBLE_TAP_WINDOW_MS;
      }
    },
    cancel,
  };
}
