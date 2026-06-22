// ── AuthLayout ───────────────────────────────────────────────────────────────
// The shared visual shell for the Login & Signup pages: animated background
// orbs + a frosted glass card that tilts in 3D toward your mouse.

import { useRef } from "react";
import { GraduationCap } from "lucide-react";

export default function AuthLayout({ title, subtitle, children, footer }) {
  const cardRef = useRef(null);

  // 3D tilt: figure out where the mouse is over the card (-0.5 .. 0.5 on each
  // axis) and rotate the card a few degrees toward it. We write the transform
  // straight to the DOM via the ref so it stays buttery smooth.
  function handleMouseMove(e) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 .. 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    const MAX = 8; // max tilt in degrees
    card.style.transform = `rotateY(${px * MAX}deg) rotateX(${-py * MAX}deg)`;
  }

  function resetTilt() {
    const card = cardRef.current;
    if (card) card.style.transform = "rotateY(0deg) rotateX(0deg)";
  }

  return (
    <div className="auth-page">
      {/* Animated, blurred gradient orbs that give the glass something to refract */}
      <div className="orb orb--1" />
      <div className="orb orb--2" />
      <div className="orb orb--3" />

      {/* The perspective wrapper is what makes the rotation look 3D */}
      <div
        className="auth-stage"
        onMouseMove={handleMouseMove}
        onMouseLeave={resetTilt}
      >
        <div className="auth-card" ref={cardRef}>
          {/* translateZ on these lifts them "above" the card for a parallax feel */}
          <div className="auth-brand" style={{ transform: "translateZ(40px)" }}>
            <span className="auth-brand__logo">
              <GraduationCap size={20} strokeWidth={2.2} />
            </span>
            <span className="auth-brand__name">Studyify</span>
          </div>

          <h1 className="auth-title" style={{ transform: "translateZ(30px)" }}>
            {title}
          </h1>
          <p className="auth-subtitle" style={{ transform: "translateZ(24px)" }}>
            {subtitle}
          </p>

          <div style={{ transform: "translateZ(20px)" }}>{children}</div>

          <div className="auth-footer" style={{ transform: "translateZ(16px)" }}>
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
