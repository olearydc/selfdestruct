import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { redis } from "@/lib/redis";
import { isAdminAuthorized } from "@/lib/adminAuth";
import ResetButton from "./ResetButton";

export const metadata: Metadata = {
  title: { absolute: "Usage" },
  robots: { index: false, follow: false },
};

// Required for the per-request CSP nonce set in proxy.ts, same as every
// other route — see that file's comment for why.
export const dynamic = "force-dynamic";

export default async function AdminStatsPage() {
  // Defense-in-depth, not the only gate: proxy.ts already refuses an
  // unauthenticated request before this ever renders. Re-checking here
  // means a future change to proxy.ts's matcher can't silently expose
  // this page — see lib/adminAuth.ts's own comment.
  const headersList = await headers();
  if (!isAdminAuthorized(headersList.get("authorization"))) notFound();

  const [created, opened] = await Promise.all([
    redis.get("stats:secrets_created"),
    redis.get("stats:secrets_opened"),
  ]);

  return (
    <main className="admin-stats">
      <h1>Usage</h1>
      <dl>
        <dt>Secrets created</dt>
        <dd>{created ?? 0}</dd>
        <dt>Secrets opened</dt>
        <dd>{opened ?? 0}</dd>
      </dl>
      <p className="muted">
        Aggregate counters only — no IDs, timestamps, or per-secret data behind these numbers.
      </p>
      <ResetButton />
    </main>
  );
}
