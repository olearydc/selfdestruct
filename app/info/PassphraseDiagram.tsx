// Two simple rows: without a passphrase the link alone opens the secret;
// with one, the link alone only gets a locked state — the passphrase,
// shared through a separate channel, is what actually opens it.
export default function PassphraseDiagram() {
  return (
    <svg
      className="diagram"
      viewBox="0 0 640 210"
      role="img"
      aria-label="Diagram: without a passphrase, the link alone opens the secret. With a passphrase, the link alone only shows a locked state — opening it also requires the passphrase, which travels through a separate channel from the link."
    >
      <g fontFamily="inherit" fontSize="13" fill="var(--foreground)">
        {/* Row 1 — no passphrase */}
        <text x="10" y="30" fontSize="12" fill="var(--muted)">No passphrase</text>
        <rect x="10" y="40" width="110" height="50" rx="10" fill="var(--surface)" stroke="var(--border)" />
        <text x="65" y="70" textAnchor="middle">Link</text>

        <line x1="123" y1="65" x2="197" y2="65" stroke="var(--muted)" strokeWidth="2" markerEnd="url(#pd-arrow)" />

        <rect x="200" y="40" width="110" height="50" rx="10" fill="var(--surface)" stroke="var(--border)" />
        <text x="255" y="70" textAnchor="middle">Opens</text>

        {/* Row 2 — with passphrase */}
        <text x="10" y="130" fontSize="12" fill="var(--muted)">With a passphrase</text>
        <rect x="10" y="140" width="110" height="50" rx="10" fill="var(--surface)" stroke="var(--border)" />
        <text x="65" y="170" textAnchor="middle">Link</text>

        <line x1="123" y1="165" x2="197" y2="165" stroke="var(--muted)" strokeWidth="2" markerEnd="url(#pd-arrow)" />

        {/* Locked state gets a faint accent tint, not just an outline — the
            point where the link alone runs out should read as visually
            distinct at a glance, not just from its label. */}
        <rect x="200" y="140" width="110" height="50" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" strokeDasharray="4 3" />
        <path d="M 246 156 h 18 v -3 a 9 9 0 0 0 -18 0 z" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
        <rect x="243" y="156" width="24" height="16" rx="2.5" fill="var(--accent)" opacity="0.9" />
        <text x="255" y="182" textAnchor="middle" fontSize="10" fill="var(--muted)">link alone stops here</text>

        <line x1="313" y1="165" x2="487" y2="165" stroke="var(--muted)" strokeWidth="2" markerEnd="url(#pd-arrow)" />

        <rect x="500" y="140" width="110" height="50" rx="10" fill="var(--surface)" stroke="var(--border)" />
        <text x="555" y="170" textAnchor="middle">Opens</text>

        {/* Passphrase joins in from above, at the midpoint of the Locked→Opens arrow */}
        <rect x="330" y="15" width="150" height="50" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />
        <text x="405" y="35" textAnchor="middle" fontSize="11" fill="var(--accent)" fontWeight="600">Passphrase</text>
        <text x="405" y="49" textAnchor="middle" fontSize="9" fill="var(--muted)">shared a different way</text>
        <line x1="405" y1="65" x2="405" y2="161" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#pd-arrow-accent)" />

        {/* A small filled, notched-back arrowhead — mirror-symmetric by
            construction and rendered as one solid fill rather than two
            separate strokes, so it can't come out lopsided. */}
        <defs>
          <marker id="pd-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 0.5 0.7 L 7 4.5 L 0.5 8.3 L 2.3 4.5 Z" fill="var(--muted)" />
          </marker>
          <marker id="pd-arrow-accent" markerWidth="9" markerHeight="9" refX="7" refY="4.5" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 0.5 0.7 L 7 4.5 L 0.5 8.3 L 2.3 4.5 Z" fill="var(--accent)" />
          </marker>
        </defs>
      </g>
    </svg>
  );
}
