import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------
   Fixed-row virtualiser. The original rendered all 723 buttons and
   re-sorted them with localeCompare on every keystroke.
   ------------------------------------------------------------------ */
export function useVirtualRows({
  count,
  rowHeight,
  overscan = 6,
  ref,
}: {
  count: number;
  rowHeight: number;
  overscan?: number;
  ref: React.RefObject<HTMLElement | null>;
}) {
  const [range, setRange] = useState({ start: 0, end: Math.min(count, 24) });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = el.scrollTop;
        const h = el.clientHeight || 400;
        const start = Math.max(0, Math.floor(top / rowHeight) - overscan);
        const end = Math.min(count, Math.ceil((top + h) / rowHeight) + overscan);
        setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [count, rowHeight, overscan, ref]);

  const scrollToIndex = useCallback(
    (i: number) => {
      const el = ref.current;
      if (!el) return;
      const top = i * rowHeight;
      const bottom = top + rowHeight;
      if (top < el.scrollTop) el.scrollTop = top;
      else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
    },
    [rowHeight, ref],
  );

  return { ...range, totalHeight: count * rowHeight, scrollToIndex };
}

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or blocked */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

/** Keeps typing at 60fps while an expensive filter catches up. */
export function useDebounced<T>(value: T, ms = 140) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

/** Live elapsed clock for long-running jobs. */
export function useElapsed(active: boolean, since: number) {
  const [, tick] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!active) return;
    const loop = () => {
      tick((n) => n + 1);
      raf.current = window.setTimeout(loop, 250);
    };
    loop();
    return () => clearTimeout(raf.current);
  }, [active]);
  return active ? Date.now() - since : 0;
}
