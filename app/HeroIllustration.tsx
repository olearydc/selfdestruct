"use client";

import { useEffect, useRef } from "react";

// Custom, dependency-free hero illustration: a push-button with a countdown
// ring draining around it. The button fades out as the ring empties, then
// resets and loops — a subtle nod to the product mechanism rather than a
// literal, alarming countdown. Pure SVG + CSS animation, no image assets,
// no animation library.
//
// The countdown ring's rotation lives on a wrapping <g> with only a plain
// SVG transform attribute — not on the dashed circle itself, and not
// paired with any CSS transform-origin. Combining an SVG transform
// attribute, a CSS transform-origin, and stroke-dasharray/pathLength on
// the same element reliably made the stroke fail to paint at all in
// testing; separating "rotate" (the group) from "dash" (the circle)
// sidesteps that entirely.
//
// The four words drifting toward the button were originally animated along
// a hand-keyframed spiral — visually appealing in principle, but "ease-in"
// restarting its acceleration curve at every waypoint made it read as a
// stutter rather than a swirl, and more waypoints didn't fully fix it.
// A single straight vector per word, paired with a scale-down as it
// approaches center, reads as "pulled in and shrinking into the distance"
// with none of that risk — only two real keyframe stops, so there's
// nothing for the timing function to stumble over between them.
const RADIUS = 92;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const WORD_POOL = [
  "p@ss123",
  "ssh-key",
  "AES-256",
  "•hidden•",
  "t0ken99",
  "bank-pin",
  "2fa-code",
  "priv-key",
  "wifi-pwd",
  "api-key",
  "seed:12",
  "vault#3",
  "cvv-999",
  "otp:482",
];

function pickFour(): string[] {
  const shuffled = [...WORD_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4);
}

export default function HeroIllustration() {
  const textRefs = useRef<(SVGTextElement | null)[]>([]);

  // Renders a fixed order (server and first client render match, avoiding
  // a hydration mismatch from Math.random() running differently on each
  // side), then reshuffles once mounted by writing directly into the DOM —
  // a genuine client-only visual tweak, not React state, so there's no
  // extra render to trigger.
  //
  // Vertical centering is done by measuring each word's actual rendered
  // bounding box (getBBox) and correcting its y from that, rather than
  // trusting dominant-baseline or a fixed dy="0.35em" — both are font-
  // metric guesses that render inconsistently enough across engines to
  // visibly throw the words off-center.
  useEffect(() => {
    pickFour().forEach((word, index) => {
      const el = textRefs.current[index];
      if (!el) return;
      el.textContent = word;
      el.removeAttribute("y");
      const box = el.getBBox();
      el.setAttribute("y", String(-(box.y + box.height / 2)));
    });
  }, []);

  return (
    <svg
      className="hero-illustration"
      viewBox="0 0 300 300"
      role="img"
      aria-hidden="true"
    >
      <circle className="hero-illustration-glow" cx="150" cy="150" r="110" />

      <g className="hero-illustration-button">
        <circle
          className="hero-illustration-ring-track"
          cx="150"
          cy="150"
          r={RADIUS}
          fill="none"
          strokeWidth="6"
        />
        <g transform="rotate(-90 150 150)">
          <circle
            className="hero-illustration-ring"
            cx="150"
            cy="150"
            r={RADIUS}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
          />
        </g>

        {/* Four quarter marks — lit at rest, going out one at a time
            (top, right, bottom, left, matching the ring's own clockwise
            drain from the top) as a discrete "4, 3, 2, 1" alongside the
            continuous ring. */}
        <circle className="hero-illustration-notch hero-illustration-notch-1" cx="150" cy="46" r="4" />
        <circle className="hero-illustration-notch hero-illustration-notch-2" cx="254" cy="150" r="4" />
        <circle className="hero-illustration-notch hero-illustration-notch-3" cx="150" cy="254" r="4" />
        <circle className="hero-illustration-notch hero-illustration-notch-4" cx="46" cy="150" r="4" />

        {/* A static wrapper anchors the whole stream at the button's own
            center; each word's own <g> carries the CSS-animated
            translate/scale (drift-in-N), and the <text> inside sits at
            local (0,0) — its y gets corrected post-mount from a real
            measurement, see the effect above. */}
        <g
          className="hero-illustration-stream"
          transform="translate(150 150)"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize="14"
          fill="var(--muted)"
        >
          {WORD_POOL.slice(0, 4).map((word, index) => (
            <g key={index} className={`hero-illustration-char hero-illustration-char-${index + 1}`}>
              <text
                ref={(el) => {
                  textRefs.current[index] = el;
                }}
                x="0"
                textAnchor="middle"
              >
                {word}
              </text>
            </g>
          ))}
        </g>

        <circle cx="150" cy="150" r="58" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
        <circle cx="150" cy="150" r="44" fill="var(--accent)" />
        <circle cx="150" cy="150" r="44" fill="none" stroke="var(--accent-foreground)" strokeOpacity="0.25" strokeWidth="1" />
      </g>

      <g className="hero-illustration-poof" fill="var(--muted)">
        <circle cx="150" cy="150" r="4" />
        <circle cx="128" cy="132" r="3" />
        <circle cx="172" cy="132" r="3" />
        <circle cx="128" cy="168" r="2.5" />
        <circle cx="172" cy="168" r="2.5" />
        <circle cx="150" cy="112" r="2.5" />
        <circle cx="150" cy="188" r="2.5" />
      </g>
    </svg>
  );
}
