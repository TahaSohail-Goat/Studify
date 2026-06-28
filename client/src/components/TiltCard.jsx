import { useRef } from "react";

// Honour reduced-motion: skip the 3D tilt (the spotlight still works).
const REDUCE =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * TiltCard — wraps any element so it tilts toward the cursor and shows a soft
 * spotlight that tracks the pointer. Pure CSS-variable updates via a ref, so it
 * never triggers a React re-render.
 *
 * Works on a <Link> too (pass `as={Link} to="…"`).
 */
export default function TiltCard({ as: Tag = "div", className = "", max = 8, children, ...rest }) {
  const ref = useRef(null);

  function handleMove(e) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;  // 0..1
    const py = (e.clientY - r.top) / r.height;  // 0..1
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    if (!REDUCE) {
      el.style.setProperty("--rx", `${((0.5 - py) * max * 2).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((px - 0.5) * max * 2).toFixed(2)}deg`);
    }
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <Tag
      ref={ref}
      className={`tilt ${className}`.trim()}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...rest}
    >
      {children}
    </Tag>
  );
}
