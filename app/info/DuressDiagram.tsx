// Same single field, two outcomes that look identical from the outside —
// the point of this diagram is that a bystander watching the reveal page
// cannot tell which branch is happening. Only the box shading differs
// (accent = duress path), which is not visible to anyone but the reader
// of this diagram; the product itself never shows that distinction.
export default function DuressDiagram() {
  return (
    <svg
      className="diagram"
      viewBox="0 0 640 270"
      role="img"
      aria-label="Diagram: one passphrase field handles both cases. Enter the real passphrase and the real secret is shown, then burned. Enter the duress passphrase instead — the exact same field — and a decoy message is shown, while the real secret is burned at the same moment, silently. From the outside, both look identical: a passphrase was entered, something was shown, the secret is gone."
    >
      <g fontFamily="inherit" fontSize="13" fill="var(--foreground)">
        <rect x="210" y="10" width="220" height="50" rx="10" fill="var(--surface)" stroke="var(--border)" />
        <rect x="226" y="27" width="16" height="16" rx="3" fill="none" stroke="var(--muted)" strokeWidth="1.5" />
        <circle cx="234" cy="35" r="2" fill="var(--muted)" />
        <text x="330" y="40" textAnchor="middle">One passphrase field</text>

        {/* Lines stop a few px short of each branch box so the arrowhead
            never visually fuses with the box border, and the diagonal
            label chips sit at each line's midpoint — a background-colored
            rect drawn after the line "erases" the stroke underneath the
            text instead of letting it run through the letters. */}
        <line x1="278" y1="60" x2="156" y2="103" stroke="var(--muted)" strokeWidth="2" markerEnd="url(#dd-arrow)" />
        <line x1="362" y1="60" x2="484" y2="103" stroke="var(--muted)" strokeWidth="2" markerEnd="url(#dd-arrow)" />

        <rect x="171" y="72" width="92" height="20" rx="10" fill="var(--background)" stroke="var(--border)" />
        <text x="217" y="86" textAnchor="middle" fontSize="11" fill="var(--muted)">real passphrase</text>

        <rect x="369" y="72" width="108" height="20" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" />
        <text x="423" y="86" textAnchor="middle" fontSize="11" fill="var(--accent)">duress passphrase</text>

        <rect x="60" y="106" width="180" height="52" rx="10" fill="var(--surface)" stroke="var(--border)" />
        <text x="150" y="128" textAnchor="middle">Real secret shown</text>
        <text x="150" y="144" textAnchor="middle" fontSize="10" fill="var(--muted)">to whoever opened it</text>

        <rect x="400" y="106" width="180" height="52" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />
        <text x="490" y="128" textAnchor="middle">Decoy message shown</text>
        <text x="490" y="144" textAnchor="middle" fontSize="10" fill="var(--muted)">instead, same screen</text>

        <line x1="150" y1="158" x2="150" y2="200" stroke="var(--muted)" strokeWidth="2" markerEnd="url(#dd-arrow)" />
        <line x1="490" y1="158" x2="490" y2="200" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#dd-arrow-accent)" />

        <rect x="60" y="203" width="180" height="52" rx="10" fill="var(--surface)" stroke="var(--border)" />
        <text x="150" y="225" textAnchor="middle">Secret burned</text>
        <text x="150" y="241" textAnchor="middle" fontSize="10" fill="var(--muted)">gone, same as any reveal</text>

        <rect x="400" y="203" width="180" height="52" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />
        <text x="490" y="225" textAnchor="middle">Real secret burned too</text>
        <text x="490" y="241" textAnchor="middle" fontSize="10" fill="var(--muted)">at the same instant, silently</text>

        {/* A dashed rule connecting the two bottom boxes underlines the
            diagram's point in one glance: both paths end the same way,
            with nothing left to tell them apart afterward. */}
        <line x1="240" y1="229" x2="400" y2="229" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="2 4" />
        <rect x="255" y="219" width="130" height="20" rx="10" fill="var(--background)" />
        <text x="320" y="233" textAnchor="middle" fontSize="10" fill="var(--muted)">indistinguishable afterward</text>

        {/* A small filled, notched-back arrowhead — mirror-symmetric by
            construction and rendered as one solid fill rather than two
            separate strokes, so it can't come out lopsided. */}
        <defs>
          <marker id="dd-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 0.5 0.7 L 7 4.5 L 0.5 8.3 L 2.3 4.5 Z" fill="var(--muted)" />
          </marker>
          <marker id="dd-arrow-accent" markerWidth="9" markerHeight="9" refX="7" refY="4.5" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 0.5 0.7 L 7 4.5 L 0.5 8.3 L 2.3 4.5 Z" fill="var(--accent)" />
          </marker>
        </defs>
      </g>
    </svg>
  );
}
