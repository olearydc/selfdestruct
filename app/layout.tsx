import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL, SITE_DESCRIPTION } from "@/lib/constants";

// No mention of "duress" in this description, for the same reason keywords
// omits it below — this feeds openGraph/twitter too, and /s/[id] only
// overrides title/description/robots, not those, so it would otherwise
// leak into that page's og:description and twitter:description as well.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Selfdestruct — a secret that disappears when read",
    template: "%s · Selfdestruct",
  },
  description: SITE_DESCRIPTION,
  // Every page that doesn't set its own canonical (currently just this
  // root layout's own "/" and the /info, /batch overrides) inherits this
  // one — a page that forgets to override would otherwise silently claim
  // the homepage as its canonical URL, telling search engines to index it
  // under the wrong address. /safety and /s/[id] deliberately don't
  // override this: both are already noindex, and a canonical URL on a
  // page telling robots not to index it at all is a contradiction, not a
  // stronger signal.
  alternates: { canonical: "/" },
  // Deliberately no "duress" here, even though it's a real feature we
  // otherwise talk about openly on /info — this list cascades to every
  // page that doesn't set its own keywords, including /s/[id], and that
  // page's HTML must never contain the word "duress" in any form (see
  // tests/duress.spec.ts and CLAUDE.md's non-negotiable #5). Caught by
  // that exact test after an earlier version of this list included it.
  keywords: [
    "one-time secret",
    "self-destructing message",
    "zero-knowledge encryption",
    "secure link sharing",
    "one-time link",
    "encrypted password sharing",
  ],
  // Individual pages narrow this — /safety and /s/[id] both override to
  // noindex, since a one-time secret link or a page meant to stay
  // undiscoverable-by-crawl have no business in a search index.
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Selfdestruct",
    title: "Selfdestruct — a secret that disappears when read",
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Selfdestruct — a secret that disappears when read",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#b3541f" },
    { media: "(prefers-color-scheme: dark)", color: "#e8874a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        {/* The entire mechanism is client-side encryption/decryption — with
            JavaScript disabled this page cannot encrypt, decrypt, or fetch
            anything. It fails closed (nothing renders) rather than falling
            back to a server-side path that would break the zero-knowledge
            guarantee. See docs/SECURITY.md § What stays out of the
            product's control. */}
        <noscript>
          <main>
            <p role="alert">
              Selfdestruct requires JavaScript. The encryption and decryption
              happen entirely in your browser — nothing is sent or received
              until that&apos;s enabled, so there&apos;s no reduced-security
              fallback to offer instead.
            </p>
          </main>
        </noscript>
        {children}
      </body>
    </html>
  );
}
