"use client";

import { useEffect, useRef } from "react";

const BADGES = [
  "End-to-end encrypted",
  "Zero-knowledge",
  "No account",
  "Auto-destruct",
  "Passphrase protection",
  "Duress passphrase",
  "Decoy message",
  "One-time link",
  "Hosted in the EU",
  "100% free",
];

export default function TrustBadgeStrip() {
  const viewportRef = useRef<HTMLDivElement>(null);

  // Badges vary a lot in width ("100% free" vs "Passphrase protection"),
  // so there's no fixed time offset per badge that lines a "blow up" burst
  // up with the moment it actually reaches the left edge — an earlier,
  // purely time-based version (evenly-spaced animation-delays assuming
  // equal badge widths) drifted out of sync with the real edge crossing.
  // Watching each badge's actual on-screen position and triggering the
  // burst exactly when it crosses is the only way to keep it pinned to
  // the edge regardless of badge width.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame: number;

    function tick() {
      const containerLeft = viewport!.getBoundingClientRect().left;
      viewport!.querySelectorAll<HTMLElement>(".badge").forEach((badge) => {
        const rect = badge.getBoundingClientRect();
        const left = rect.left - containerLeft;
        const right = rect.right - containerLeft;

        if (badge.classList.contains("badge-burst")) {
          // Only reset once the badge is fully clipped past the left
          // edge (right <= 0) — a fixed timeout here previously reset it
          // while a sliver was still technically within the container's
          // bounds, and the abrupt jump back to full opacity showed
          // through even a heavy mask fade as a faint pop. Tying the
          // reset to real geometry, the same way the trigger below is,
          // means it can never fire early regardless of badge width or
          // scroll speed.
          if (right <= 0) {
            badge.classList.remove("badge-burst");
          }
          return;
        }

        // Trigger well before the left edge, comfortably inside the
        // unmasked zone (the mask below starts fading at ~6% of the
        // viewport width) — triggering too close to the edge made the
        // burst itself hard to see, reading as a too-fast flash right at
        // the already-fading edge instead of a clear, deliberate blow-up.
        const center = left + rect.width / 2;
        if (center > 50 && center < 90) {
          badge.classList.add("badge-burst");
        }
      });
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="badge-strip-viewport" ref={viewportRef}>
      <div className="badge-strip" role="list" aria-label="Trust summary">
        {BADGES.map((badge) => (
          <span key={badge} className="badge" role="listitem">
            {badge}
          </span>
        ))}
        {/* A second, hidden-from-assistive-tech copy immediately after the
            real list — purely so the marquee has something to scroll into
            for a seamless loop. The accessible content is the first copy
            only. */}
        {BADGES.map((badge) => (
          <span key={`repeat-${badge}`} className="badge" aria-hidden="true">
            {badge}
          </span>
        ))}
      </div>
    </div>
  );
}
