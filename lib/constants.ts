// Cost/abuse control, not a security measure — safe to state plainly.
// AES-GCM adds a 16-byte tag and base64 expands by ~4/3, so a base64
// ciphertext for a 100KB plaintext lands around 133,500 characters; the
// server-side cap below leaves headroom above that without allowing
// meaningfully larger payloads through.
export const MAX_SECRET_BYTES = 100_000;
export const MAX_CIPHERTEXT_B64_LENGTH = 140_000;

// Falls back to the real production domain rather than localhost, since
// this feeds metadataBase/sitemap/robots — search engines and social-share
// scrapers only ever see the built app, never local dev, so a wrong value
// here would only silently break local-dev previews of these, not anything
// that matters in production.
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://selfdestruct.online";

// Single source for the site-wide description — used by app/layout.tsx's
// metadata (description/openGraph/twitter) and by the homepage's WebSite
// JSON-LD, so the two can't quietly drift apart. Deliberately no mention of
// "duress" — see app/layout.tsx for why that matters beyond just this page.
export const SITE_DESCRIPTION =
  "Send a secret that disappears the moment it's read. Zero-knowledge, one-time links with no accounts, no tracking, and optional passphrase protection — encrypted in your browser, never readable by the server.";

// Shared between the single-secret composer and the batch composer, so the
// two pages can never quietly drift apart on what "1 hour" or "7 days"
// actually means in seconds.
export const EXPIRY_OPTIONS = [
  { label: "5 minutes", seconds: 60 * 5 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "1 day", seconds: 60 * 60 * 24 },
  { label: "7 days", seconds: 60 * 60 * 24 * 7 },
];
export const DEFAULT_EXPIRY_SECONDS = EXPIRY_OPTIONS[1].seconds;

// Matches /api/secret's own RATE_LIMIT_MAX_CREATES — a batch that filled
// the entire hourly allowance in one submission would leave zero room for
// anything else that session does for the next hour, so the batch page
// stays comfortably under it rather than racing it.
export const BATCH_MAX_ITEMS = 15;

// The actual per-browser hourly cap enforced in app/api/secret/route.ts.
// Duplicated here (rather than imported from that route file, which
// pulls in server-only code) purely so client components — the batch
// page's own explanatory copy — can state the real number instead of a
// second, hand-typed one that could quietly drift out of sync with it.
export const RATE_LIMIT_MAX_CREATES = 50;

// Pro tier (Phase 8, see docs/phases/phase-8-pro-tier.md) — the values a
// manually-issued API key gets today, absent real payment/plan tiers yet.
// scripts/create-api-key.mjs duplicates these two numbers rather than
// importing this file (a plain .mjs script importing a TS module that
// itself has no server-only dependencies would work, but duplicating two
// integers is simpler and more robust than relying on Node's ESM resolving
// an extensionless TS import correctly outside the Next.js build).
export const PRO_MAX_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const PRO_DEFAULT_RATE_LIMIT_MAX = 500; // per hour

// Supporter tier (MONETISATION.md) — a low-cost, non-feature-gated
// donation, deliberately separate from Pro. Ko-fi, not our own billing:
// nothing in this app reads or writes any state related to it.
export const SUPPORTER_KOFI_URL = "https://ko-fi.com/olearydc";
