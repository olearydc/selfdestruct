import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

// Deliberately just these three. /safety stays out — see robots.ts — and
// /s/[id] links are one-time and per-secret, never something a sitemap
// should list.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/info`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/batch`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
