import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";

// Strict, nonce-based CSP applied to every page. The create/reveal pages
// (and /batch, which runs the same client-side encrypt-before-send path as
// the create page) need this because they handle plaintext (before
// encryption, after decryption) — blocking inline scripts and unexpected
// origins closes off script-injection as a route to exfiltrate the secret.
// See docs/SECURITY.md § Closing the incidental-copy gap.
//
// The info/safety pages don't handle plaintext, but get the same treatment
// anyway: Next.js injects its own inline hydration scripts/styles on every
// page regardless of whether the route itself uses any, and those need a
// nonce to run under a strict CSP — there's no simpler nonce-free variant
// that still allows client interactivity. A per-request nonce means all
// five routes must be dynamically rendered (`force-dynamic`), not
// statically optimized; see each page's own file for that export.
//
// Cache-Control and Referrer-Policy are set here too, not just
// next.config.ts headers() — Next.js overrides a page-level Cache-Control
// set via headers() for dynamically rendered routes, but not one set here.
// The private operator-only stats page (app/admin/stats) and its reset
// endpoint (app/api/admin/stats/reset) are the one part of this app gated
// behind a credential — everything else is deliberately account-free. HTTP
// Basic Auth, checked here rather than per-route, so a route can never be
// added under /admin later and forget the check: the matcher below covers
// the whole subtree. ADMIN_PASSWORD must be set in the deploy
// environment — with it unset, /admin is refused entirely rather than
// left open, since an unset check is a worse failure mode than a
// locked-out operator.
function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' },
  });
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    if (!isAdminAuthorized(request.headers.get("authorization"))) return unauthorized();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`};
    img-src 'self' data:;
    font-src 'self';
    connect-src 'self';
    object-src 'none';
    base-uri 'none';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: ["/", "/s/:id", "/info", "/safety", "/batch", "/admin/:path*", "/api/admin/:path*"],
};
