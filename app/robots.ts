import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

// /safety is deliberately excluded here too, on top of its own noindex
// metadata (app/safety/page.tsx) and never being linked from the homepage
// (tests/safety-page.spec.ts) — it must stay unreachable by crawl, not
// just unindexed. /s/ is every one-time secret link: there's no reason for
// a crawler to fetch those, and doing so would waste the one real reveal
// on a bot instead of the intended recipient.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/info", "/batch"],
      disallow: ["/safety", "/s/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
