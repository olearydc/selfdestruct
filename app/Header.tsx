import Link from "next/link";

import QuickExit from "./QuickExit";

// Used on the create, info, and reveal pages — not on /safety, whose own
// full-width quick-exit must stay the literal first element on the page,
// nothing above it — see docs/AUDIENCE.md § The dedicated safety page.
export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="16" fill="var(--accent)" />
            <path
              d="M16 5 L18.6 13.4 L27 16 L18.6 18.6 L16 27 L13.4 18.6 L5 16 L13.4 13.4 Z"
              fill="var(--surface)"
            />
          </svg>
          Selfdestruct
        </Link>
        <nav className="site-nav">
          <Link href="/info">How it works</Link>
          <QuickExit className="quick-exit-compact">Quick exit</QuickExit>
        </nav>
      </div>
    </header>
  );
}
