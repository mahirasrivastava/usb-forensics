import { useEffect, useRef, useState } from "react";

/** Shared hover-tooltip plumbing: charts call show()/hide() from pointer
 *  handlers on hit targets that are larger than the marks themselves. */
export function useTooltip() {
  const [tip, setTip] = useState(null);
  return {
    tip,
    show: (x, y, content, key) => setTip({ x, y, content, key }),
    hide: () => setTip(null),
  };
}

export function Tooltip({ tip }) {
  const ref = useRef(null);
  const [shift, setShift] = useState(0);

  // nudge back inside the chart if the anchor would push it past an edge
  useEffect(() => {
    const el = ref.current;
    if (!el || !tip) { setShift(0); return; }
    const box = el.getBoundingClientRect();
    const host = el.parentElement.getBoundingClientRect();
    let dx = 0;
    if (box.right > host.right) dx = host.right - box.right;
    if (box.left + dx < host.left) dx = host.left - box.left;
    setShift((prev) => (Math.abs(dx) < 0.5 ? prev : prev + dx));
  }, [tip]);

  if (!tip) return null;
  return (
    <div ref={ref} className="tooltip" role="status"
         style={{ left: tip.x + shift, top: tip.y - 8 }}>
      {tip.content}
    </div>
  );
}
