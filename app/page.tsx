import Link from "next/link";
import { headers } from "next/headers";

import Header from "./Header";
import Footer from "./Footer";
import CreatePageClient from "./CreatePageClient";
import FeatureCards from "./FeatureCards";
import UseCases from "./UseCases";
import ComparisonTable from "./ComparisonTable";
import HeroIllustration from "./HeroIllustration";
import TrustBadgeStrip from "./info/TrustBadgeStrip";
import DataFlowDiagram from "./info/DataFlowDiagram";
import { SITE_URL, SITE_DESCRIPTION } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Plain WebSite entity only — no SoftwareApplication/aggregateRating, since
// this product has no reviews or ratings to report and fabricating one
// would violate Google's structured-data guidelines (and just be untrue).
const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Selfdestruct",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
};

export default async function CreatePage() {
  // CSP is strict-dynamic/nonce-based (see proxy.ts) and applies to every
  // <script> tag regardless of type, including this JSON-LD data island —
  // without the nonce the browser drops it silently, no error, no schema.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        // JSON.stringify already produces valid embedded JSON; the extra
        // escape guards only against a literal "</script>" inside a value
        // ever prematurely closing this tag — schema.org text fields are
        // free-form strings, not something to trust blindly even when we
        // wrote them ourselves.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(WEBSITE_JSON_LD).replace(/</g, "\\u003c"),
        }}
      />
      <Header />
      <main className="wide-main">
        <section className="hero-section">
          <div className="hero-top">
            <div className="hero-copy">
              <h1 className="headline hero-headline">
                Send a secret.{" "}
                <span className="accent-text">It disappears the moment it&apos;s read.</span>
              </h1>
              <p className="hero-subhead">
                Zero-knowledge, one-time links for anything you&apos;d rather not leave sitting in
                an inbox or a chat log. No account, no tracking, nothing left behind.
              </p>
            </div>
            <HeroIllustration />
          </div>
          <TrustBadgeStrip />
        </section>

        <CreatePageClient />

        <section className="page-section">
          <div className="section-intro">
            <h2>What ends up going through Selfdestruct</h2>
          </div>
          <UseCases />
        </section>

        <section className="page-section">
          <div className="section-intro">
            <h2>Built-in protection</h2>
          </div>
          <FeatureCards />
        </section>

        <section className="page-section">
          <div className="section-intro">
            <h2>How it works</h2>
          </div>
          <DataFlowDiagram />
          <p className="muted section-intro-text">
            The ciphertext and the decryption key take different paths — the key never reaches
            the server.{" "}
            <Link href="/info">See the full breakdown, FAQ, and warrant canary →</Link>
          </p>
        </section>

        <section className="page-section">
          <div className="section-intro">
            <h2>Compared to how you&apos;d normally send this</h2>
            <p className="muted">
              Email and chat apps weren&apos;t built for one-time secrets. Here&apos;s what changes
              when you use a tool that is.
            </p>
          </div>
          <ComparisonTable />
        </section>
      </main>
      <Footer />
    </>
  );
}
