// Shared admin-auth check for the private /admin/stats page and its
// /api/admin/* routes. Used in more than one place deliberately: proxy.ts
// gates the request before it reaches any route, and the page/route
// handlers each re-check independently rather than trusting that gate
// alone — the same defense-in-depth this app already applies elsewhere
// (e.g. the Pro API route re-validates its own auth rather than assuming
// middleware handled it), so a future edit to proxy.ts's matcher can't
// silently leave this open.
export function isAdminAuthorized(authorizationHeader: string | null): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  if (!authorizationHeader?.startsWith("Basic ")) return false;

  const decoded = atob(authorizationHeader.slice("Basic ".length));
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return false;
  const password = decoded.slice(separatorIndex + 1);

  // Constant-time comparison — this guards a real credential, so it gets
  // the same timing-attack discipline as passphrase checks elsewhere.
  const a = new TextEncoder().encode(password);
  const b = new TextEncoder().encode(adminPassword);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
