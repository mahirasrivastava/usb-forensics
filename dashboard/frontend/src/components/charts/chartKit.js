import { useEffect, useRef, useState } from "react";

/** Measures the container so the SVG can be laid out in real pixels —
 *  scaling a viewBox would distort the type. */
export function useWidth(initial = 640) {
  const ref = useRef(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(el.clientWidth || initial);
    set();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", set);
      return () => window.removeEventListener("resize", set);
    }
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [initial]);
  return [ref, w];
}

/** Bar with 4px rounded data-end, square against the baseline. */
export function barPath({ x, y, w, h, r = 4, dir = "right" }) {
  if (w <= 0 || h <= 0) return "";
  const rad = Math.max(0, Math.min(r, dir === "up" ? w / 2 : h / 2, dir === "up" ? h : w));
  if (dir === "up") {
    // grows upward: round the top two corners
    return `M${x},${y + h} V${y + rad} Q${x},${y} ${x + rad},${y} H${x + w - rad} Q${x + w},${y} ${x + w},${y + rad} V${y + h} Z`;
  }
  // grows rightward: round the right two corners
  return `M${x},${y} H${x + w - rad} Q${x + w},${y} ${x + w},${y + rad} V${y + h - rad} Q${x + w},${y + h} ${x + w - rad},${y + h} H${x} Z`;
}

/** Counts are whole things, so the axis is built from a whole-number step:
 *  pick a 1/2/5 step at least max/targetTicks, then walk 0 to the top by it.
 *  Returns evenly spaced integer ticks — never "0.25 connections". */
export function niceScale(maxValue, targetTicks = 4) {
  const raw = Math.max(1, maxValue || 0);
  const rough = raw / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = Math.max(1, Math.ceil([1, 2, 5, 10].find((s) => s * mag >= rough) * mag));
  const top = Math.ceil(raw / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v));
  return { top, step, ticks };
}
