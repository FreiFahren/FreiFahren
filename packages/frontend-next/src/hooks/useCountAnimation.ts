import { useEffect, useState } from 'react';

/** Animates a number from 0 to `end` over `duration` ms via requestAnimationFrame. */
export function useCountAnimation(end: number, duration = 1000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let frame = 0;

    const step = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        frame = window.requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };

    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [end, duration]);

  return count;
}
