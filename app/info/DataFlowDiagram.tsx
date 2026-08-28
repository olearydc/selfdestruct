// Static data-flow diagram: sender's browser -> server -> recipient's
// browser, with the key path (which never touches the server) highlighted
// separately from the ciphertext path. See docs/AUDIENCE.md § Visual
// pieces to build.
export default function DataFlowDiagram() {
  return (
    <svg
      className="diagram"
      viewBox="0 0 640 230"
      role="img"
      aria-label="Diagram: the sender's browser encrypts the secret and sends only ciphertext to the server. The decryption key travels separately, in the link itself, and never reaches the server."
    >
      <g fontFamily="inherit" fontSize="13" fill="var(--foreground)">
        {/* Sender's browser — a small three-dot chrome bar reads as a
            browser window rather than a generic box. */}
        <rect x="10" y="70" width="150" height="60" rx="10" fill="var(--surface)" stroke="var(--border)" />
        <rect x="10" y="70" width="150" height="16" rx="10" fill="var(--border)" opacity="0.5" />
        <circle cx="21" cy="78" r="2.5" fill="var(--muted)" />
        <circle cx="30" cy="78" r="2.5" fill="var(--muted)" />
        <circle cx="39" cy="78" r="2.5" fill="var(--muted)" />
        <text x="85" y="110" textAnchor="middle">
          Sender&apos;s browser
        </text>

        {/* Server — small rack lines instead of a window chrome, so it
            reads as infrastructure rather than a third browser. */}
        <rect x="245" y="70" width="150" height="60" rx="10" fill="var(--surface)" stroke="var(--border)" />
        <rect x="257" y="80" width="20" height="6" rx="1.5" fill="var(--muted)" opacity="0.6" />
        <rect x="257" y="90" width="20" height="6" rx="1.5" fill="var(--muted)" opacity="0.6" />
        <text x="320" y="105" textAnchor="middle">
          Server
        </text>
        <text x="320" y="121" textAnchor="middle" fontSize="11" fill="var(--muted)">
          ciphertext only
        </text>

        {/* Recipient's browser — same chrome treatment as the sender. */}
        <rect x="480" y="70" width="150" height="60" rx="10" fill="var(--surface)" stroke="var(--border)" />
        <rect x="480" y="70" width="150" height="16" rx="10" fill="var(--border)" opacity="0.5" />
        <circle cx="491" cy="78" r="2.5" fill="var(--muted)" />
        <circle cx="500" cy="78" r="2.5" fill="var(--muted)" />
        <circle cx="509" cy="78" r="2.5" fill="var(--muted)" />
        <text x="555" y="110" textAnchor="middle">
          Recipient&apos;s browser
        </text>

        <line x1="163" y1="95" x2="242" y2="95" stroke="var(--muted)" strokeWidth="2" markerEnd="url(#arrow)" />
        <rect x="180" y="72" width="65" height="16" rx="4" fill="var(--background)" />
        <text x="212" y="84" textAnchor="middle" fontSize="11" fill="var(--muted)">
          ciphertext
        </text>

        <line x1="398" y1="95" x2="477" y2="95" stroke="var(--muted)" strokeWidth="2" markerEnd="url(#arrow)" />
        <rect x="415" y="72" width="65" height="16" rx="4" fill="var(--background)" />
        <text x="437" y="84" textAnchor="middle" fontSize="11" fill="var(--muted)">
          ciphertext
        </text>

        {/* A single packet travels sender → server → recipient, fading out
            while "inside" the server box and back in on the far side —
            reads as the ciphertext actually being relayed through, not
            just two disconnected arrows. transform: translateX only (see
            globals.css) — geometry attributes like cx are animatable in
            modern browsers, but this codebase's other diagrams animate
            exclusively via transform, so this stays consistent with that
            rather than introducing a second technique. */}
        <circle className="dataflow-packet" cx="163" cy="95" r="4" fill="var(--accent)" />

        {/* Straight vertical run leaving the sender box, mirrored by an
            identical one entering the recipient box, with the curve doing
            all its bending in between — a pure cubic Bezier is only
            vertical in the instant at its very endpoints, so without these
            the dashes right next to each box would visibly lean, making
            the departure and arrival look mismatched. The 1px gap before
            the recipient box (131, not 130) keeps the arrowhead's fill
            from anti-aliasing into the border. */}
        <path
          className="dataflow-key-path"
          d="M 85 130 L 85 150 C 85 195, 555 195, 555 150 L 555 131"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          markerEnd="url(#arrow-accent)"
        />
        <rect x="230" y="200" width="180" height="18" rx="4" fill="var(--background)" />
        <text x="320" y="213" textAnchor="middle" fontSize="12" fill="var(--accent)" fontWeight="600">
          decryption key — never sent to the server
        </text>

        {/* A small filled, notched-back arrowhead — mirror-symmetric by
            construction (every point mirrors another across the marker's
            own centerline) and rendered as one solid fill rather than two
            separate strokes, so it can't come out lopsided the way the
            open two-stroke chevron did when paired with a dashed line.
            markerUnits="userSpaceOnUse" keeps its size fixed in px
            regardless of the line's stroke-width. */}
        <defs>
          <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 0.5 0.7 L 7 4.5 L 0.5 8.3 L 2.3 4.5 Z" fill="var(--muted)" />
          </marker>
          <marker id="arrow-accent" markerWidth="11" markerHeight="11" refX="8.5" refY="5.5" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 0.6 0.9 L 8.5 5.5 L 0.6 10.1 L 2.8 5.5 Z" fill="var(--accent)" />
          </marker>
        </defs>
      </g>
    </svg>
  );
}
