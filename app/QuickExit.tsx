"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Renders a real <a href> so it works even with JavaScript disabled or not
// yet loaded — the anchor itself is a complete, correct fallback. When JS
// is available, the click is intercepted to use location.replace() instead
// of a normal navigation, so the current page's history entry is replaced
// rather than kept — the browser's back button from the neutral destination
// won't return here. See docs/AUDIENCE.md § The dedicated safety page.
//
// Shared between the safety page's full-width version and the compact
// header version on the general pages — same underlying behavior
// everywhere, just different visual treatment for different contexts.
const NEUTRAL_DESTINATION = "https://www.google.com";

// Any of these counts as "still here" and resets the auto-exit countdown
// below — deliberately broad rather than requiring a specific action,
// since the point is not to demand anything from someone who's just
// reading.
const ACTIVITY_EVENTS = ["mousemove", "keydown", "scroll", "touchstart", "click"] as const;

// How much time left before the button starts its subtle pulse warning.
const WARNING_SECONDS = 60;

export default function QuickExit({
  className,
  children,
  autoExitMinutes,
}: {
  className: string;
  children: ReactNode;
  // Optional — only the /safety page's full-width instance sets this.
  // The compact header version (every other page) omits it entirely, so
  // this whole auto-exit behavior only ever runs where "I might need to
  // leave immediately" is the explicit context, not during ordinary use
  // like composing a secret.
  autoExitMinutes?: number;
}) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() =>
    autoExitMinutes ? autoExitMinutes * 60 : null,
  );
  const deadlineRef = useRef(0);

  function exit() {
    window.location.replace(NEUTRAL_DESTINATION);
  }

  useEffect(() => {
    if (!autoExitMinutes) return;

    const totalMs = autoExitMinutes * 60 * 1000;
    deadlineRef.current = Date.now() + totalMs;

    function resetDeadline() {
      deadlineRef.current = Date.now() + totalMs;
    }
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, resetDeadline, { passive: true }),
    );

    // Polls rather than a single setTimeout so activity can keep pushing
    // the deadline back — a plain setTimeout, once scheduled, can't be
    // "extended," only cancelled and restarted, which would mean
    // rebuilding the timer on every mousemove instead of just bumping a
    // ref. The auto-navigate itself (not just the visual countdown) lives
    // in this same loop, so it still fires correctly even if a browser
    // throttles background-tab timers to once a second or so.
    const interval = setInterval(() => {
      const secondsLeft = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setRemainingSeconds(secondsLeft);
      if (secondsLeft <= 0) {
        exit();
      }
    }, 250);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetDeadline));
      clearInterval(interval);
    };
  }, [autoExitMinutes]);

  const isUrgent = remainingSeconds !== null && remainingSeconds <= WARNING_SECONDS;

  // Pulse speeds up as time runs out — roughly a 1.8s cycle with a full
  // minute left, down to ~0.5s in the final seconds. Kept as a small,
  // slow opacity shift (see .quick-exit-urgent in globals.css) rather
  // than a loud flash: this needs to read as ambient motion to anyone
  // glancing at the screen, not as a visible alarm going off.
  const pulseDuration =
    isUrgent && remainingSeconds !== null
      ? Math.max(0.5, 0.5 + (remainingSeconds / WARNING_SECONDS) * 1.3)
      : undefined;

  return (
    <a
      href={NEUTRAL_DESTINATION}
      className={isUrgent ? `${className} quick-exit-urgent` : className}
      style={pulseDuration ? { animationDuration: `${pulseDuration}s` } : undefined}
      onClick={(event) => {
        event.preventDefault();
        exit();
      }}
    >
      {children}
    </a>
  );
}
