import { useEffect, useRef, useState } from "react";

// Anima desde el ultimo valor mostrado hacia el nuevo target (no siempre desde 0),
// asi sumar/restar un movimiento se ve como un +/- sobre el numero anterior.
export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  const displayedRef = useRef(0);

  useEffect(() => {
    const from = displayedRef.current;
    const to = target;

    if (from === to) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      displayedRef.current = to;
      setValue(to);
      return;
    }

    let start: number | null = null;
    let frame: number;

    function step(timestamp: number) {
      if (start === null) start = timestamp;
      const progress = Math.min(1, (timestamp - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      const current = from + (to - from) * eased;
      displayedRef.current = current;
      setValue(current);
      if (progress < 1) frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
