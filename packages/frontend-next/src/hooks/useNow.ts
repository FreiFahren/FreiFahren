import { useEffect, useState } from 'react';

/**
 * The current time, re-read every `intervalMs`, or frozen at mount when passed `null`.
 *
 * Anything that renders "is this still current?" needs a clock that advances on its own — a report
 * expires while the page sits there, with no fetch and no interaction to trigger a re-render.
 * Reading `Date.now()` during render would be impure and would not update on its own anyway.
 */
export function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (intervalMs === null) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
