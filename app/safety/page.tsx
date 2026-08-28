import type { Metadata } from "next";

import QuickExit from "../QuickExit";

export const metadata: Metadata = {
  // absolute — this title already names the brand, so the root layout's
  // "%s · Selfdestruct" template would otherwise double it up.
  title: { absolute: "Using Selfdestruct safely" },
  description: "Plain-language safety steps for using Selfdestruct.",
  robots: { index: false, follow: false },
};

// Required for the per-request CSP nonce set in proxy.ts — see the comment
// there for why every page needs one, not just the create/reveal flow.
export const dynamic = "force-dynamic";

export default function SafetyPage() {
  return (
    <main className="wide-main">
      <QuickExit className="quick-exit" autoExitMinutes={5}>
        Leave this site now
      </QuickExit>

      <section className="page-section">
        <h1 className="headline">Using Selfdestruct safely</h1>
        <p className="muted">
          Four things worth doing, one at a time. You don&apos;t need to read all of them before
          starting the first one.
        </p>
        <p className="muted">
          This page also leaves on its own after a few quiet minutes, in case you can&apos;t
          click the button yourself — any movement or scrolling resets that.
        </p>
        <ol className="step-list">
          <li>Use a private browsing window, so this doesn&apos;t stay in your normal history.</li>
          <li>Choose the shortest expiry that still gives the recipient time to open it.</li>
          <li>Send any passphrase through a different channel than the link itself — a call, in person, a different app.</li>
          <li>Close the tab when you&apos;re done, rather than leaving it open.</li>
        </ol>
      </section>

      <section className="page-section limitations-box">
        <h2>What this tool can&apos;t do</h2>
        <p className="muted">
          Being honest about the limits matters more here than anywhere else on this site.
          Selfdestruct can&apos;t protect you from someone who already has access to your
          device, or who can physically see your screen. It can&apos;t stop a recipient from
          screenshotting or copying a secret after they open it. Malware or a browser
          extension on either device can still see content on the page. If you&apos;re
          using a browser&apos;s strictest privacy mode (for example Tor Browser&apos;s
          &quot;Safest&quot; setting) with JavaScript disabled, creating or opening a secret
          won&apos;t work at all — it fails outright rather than falling back to something
          weaker, so check this before you rely on it. This is one small tool, not a full
          safety plan.
        </p>
      </section>

      <section className="page-section">
        <h2>If you&apos;re in immediate danger</h2>
        <p className="muted">
          Contact your local emergency services number. For ongoing safety planning, a local
          support organisation is better placed to help than any web tool — search for one in
          your area, or ask a trusted professional (a doctor, a counsellor, a shelter) to
          connect you with one.
        </p>
      </section>
    </main>
  );
}
