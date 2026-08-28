// Lifecycle diagram: the four states a secret moves through, each with a
// one-line explanation of what's actually true at that stage — not just a
// label. See docs/AUDIENCE.md § Visual pieces to build.
const STAGES = [
  { label: "Created", detail: "Typed in, encrypted first" },
  { label: "Stored, encrypted", detail: "Ciphertext only, server-side" },
  { label: "Opened once", detail: "Recipient decrypts locally" },
  { label: "Destroyed", detail: "Deleted that same instant" },
];

// Track the traveling pulse crosses — matches the circles' spacing (165px
// apart) exactly, so it visits the center of every node along the way.
// The 495px travel distance in globals.css's .lifecycle-packet keyframes
// is this same span (165 * 3 stage-gaps) — keep both in sync if the
// number of stages or their spacing ever changes.
const TRACK_START = 85;

export default function LifecycleDiagram() {
  return (
    <svg
      className="diagram"
      viewBox="0 0 640 150"
      role="img"
      aria-label="Diagram: a secret's lifecycle. Created, then stored encrypted, then opened once, then permanently destroyed."
    >
      <g fontFamily="inherit" fontSize="13" fill="var(--foreground)">
        {STAGES.map((stage, i) => {
          const x = 20 + i * 165;
          const isLast = i === STAGES.length - 1;
          return (
            <g key={stage.label}>
              <circle
                cx={x + 65}
                cy="60"
                r="34"
                fill={isLast ? "var(--danger)" : "var(--surface)"}
                stroke={isLast ? "var(--danger)" : "var(--border)"}
              />
              {/* A pulse ring that quietly expands and fades on the final
                  node only — the one stage worth a beat of extra emphasis,
                  since it's the point nothing can be recovered past. */}
              {isLast && (
                <circle
                  className="lifecycle-pulse"
                  cx={x + 65}
                  cy="60"
                  r="34"
                  fill="none"
                  stroke="var(--danger)"
                  strokeWidth="2"
                />
              )}
              <text
                x={x + 65}
                y="65"
                textAnchor="middle"
                fontSize="11"
                fill={isLast ? "#ffffff" : "var(--foreground)"}
              >
                {i + 1}
              </text>
              <text x={x + 65} y="115" textAnchor="middle" fontWeight="600">
                {stage.label}
              </text>
              <text x={x + 65} y="131" textAnchor="middle" fontSize="10" fill="var(--muted)">
                {stage.detail}
              </text>
              {i < STAGES.length - 1 && (
                <line
                  x1={x + 101}
                  y1="60"
                  x2={x + 195}
                  y2="60"
                  stroke="var(--muted)"
                  strokeWidth="2"
                  markerEnd="url(#lc-arrow)"
                />
              )}
            </g>
          );
        })}

        {/* A single pulse travels the whole track once per cycle, visiting
            every node in order — reads as the secret's own timeline
            actually progressing, not a static list of four boxes.
            transform: translateX only, consistent with the other diagrams'
            animated pieces (see globals.css). */}
        <circle className="lifecycle-packet" cx={TRACK_START} cy="60" r="4.5" fill="var(--accent)" />

        {/* A small filled, notched-back arrowhead — mirror-symmetric by
            construction and rendered as one solid fill rather than two
            separate strokes, so it can't come out lopsided. */}
        <defs>
          <marker id="lc-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 0.5 0.7 L 7 4.5 L 0.5 8.3 L 2.3 4.5 Z" fill="var(--muted)" />
          </marker>
        </defs>
      </g>
    </svg>
  );
}
