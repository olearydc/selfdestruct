import type { Metadata } from "next";
import RevealPageClient from "./RevealPageClient";

// Generic on purpose — this title/description must never hint at whether
// a given link holds anything, let alone what. noindex/nofollow since a
// one-time link has no business in a search index; a crawler visiting one
// would also waste its single real reveal on a bot instead of the
// intended recipient.
export const metadata: Metadata = {
  // absolute, not the plain string form — opts out of the root layout's
  // "%s · Selfdestruct" template, which would otherwise double up into
  // "...one-time secret · Selfdestruct".
  title: { absolute: "Selfdestruct — one-time secret" },
  description: "Open a one-time secret link.",
  robots: { index: false, follow: false },
  // Explicitly overridden, not inherited — openGraph/twitter aren't
  // covered by the title/description overrides above (Next only replaces
  // the specific keys a page sets), so without this a link shared in
  // Slack/iMessage would preview the root layout's full marketing
  // description, keywords, and generated image. A one-time secret link
  // deserves a plain, generic preview, not a product pitch.
  openGraph: {
    title: "Selfdestruct — one-time secret",
    description: "Open a one-time secret link.",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "Selfdestruct — one-time secret",
    description: "Open a one-time secret link.",
    images: [],
  },
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function RevealPage() {
  return <RevealPageClient />;
}
