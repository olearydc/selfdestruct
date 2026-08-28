import Link from "next/link";

import Header from "./Header";
import Footer from "./Footer";
import CreatePageClient from "./CreatePageClient";
import FeatureCards from "./FeatureCards";
import UseCases from "./UseCases";
import ComparisonTable from "./ComparisonTable";
import HeroIllustration from "./HeroIllustration";
import TrustBadgeStrip from "./info/TrustBadgeStrip";
import DataFlowDiagram from "./info/DataFlowDiagram";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function CreatePage() {
  return (
    <>
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
