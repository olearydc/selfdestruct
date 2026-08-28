import type { Metadata } from "next";

import Header from "../Header";
import Footer from "../Footer";
import TrustBadgeStrip from "./TrustBadgeStrip";
import DataFlowDiagram from "./DataFlowDiagram";
import LifecycleDiagram from "./LifecycleDiagram";
import PassphraseDiagram from "./PassphraseDiagram";
import DuressDiagram from "./DuressDiagram";
import MissionBriefing from "./MissionBriefing";
import Faq from "./Faq";
import { SUPPORTER_KOFI_URL } from "@/lib/constants";

export const metadata: Metadata = {
  // absolute — this title already names the brand, so the root layout's
  // "%s · Selfdestruct" template would otherwise double it up.
  title: { absolute: "How Selfdestruct works" },
  description:
    "A zero-knowledge, one-time secret-sharing tool. Here's exactly how the encryption, the one-time link, and the auto-destruct actually work.",
  // Explicit, not inherited — the root layout's canonical is "/", and
  // Next.js only replaces the specific metadata keys a page sets, so
  // leaving this out would silently claim the homepage as this page's
  // canonical URL instead of itself.
  alternates: { canonical: "/info" },
};

// Required for the per-request CSP nonce set in proxy.ts — see the comment
// there for why every page needs one, not just the create/reveal flow.
export const dynamic = "force-dynamic";

const CANARY_DATE = "2026-08-28";

export default function InfoPage() {
  return (
    <>
      <Header />
      <main className="wide-main">
        <section className="page-section">
          <h1 className="headline">We never see your secret. Here&apos;s exactly how that works.</h1>
          <TrustBadgeStrip />
        </section>

        <section className="page-section">
          <h2>How a secret travels</h2>
          <DataFlowDiagram />
          <p className="muted">
            The ciphertext and the decryption key take different paths. The key never reaches
            the server — not encrypted, not hashed, not at all.
          </p>
          <p className="muted">
            <strong>Two examples.</strong> Say you&apos;re walking a relative through their online
            banking on a Zoom call and need to hand them a PIN — instead of reading it aloud on a
            recorded call or pasting it into Zoom&apos;s chat, where it sits in the meeting history
            afterward, you paste it here and send the link; they open it once, after the call ends.
            Or say you&apos;re a sysadmin handing a contractor a database password — you paste it
            in and drop the link in a Teams or Slack channel instead of the password itself, so it&apos;s
            gone the moment they&apos;ve read it, with nothing permanent left in that channel&apos;s
            history for the next person with access to stumble on.
          </p>
          <p className="muted">
            Either way, the mechanics are identical: your browser encrypts the secret and sends only
            the resulting ciphertext to us — that&apos;s all we ever store. The key stays in the link
            itself, after the <code>#</code>, a part of the URL browsers never transmit anywhere.
            When the recipient opens the link, it&apos;s their browser, not ours, that reconstructs
            the key and decrypts the secret. At no point does a copy of the plaintext or the key
            pass through anything we run.
          </p>
        </section>

        <section className="page-section">
          <h2>What happens to it over time</h2>
          <LifecycleDiagram />
        </section>

        <section className="page-section" id="passphrase">
          <h2>Using a passphrase</h2>
          <p className="muted">
            By default, anyone with the link can open your secret — that&apos;s normal, and fine
            for most things. Adding a passphrase changes that: the link alone stops at a locked
            state. The recipient also needs the passphrase, which you send through a completely
            different channel — a phone call, a different app, in person. Never alongside the
            link itself, or you&apos;ve just recreated the same single point of failure a
            passphrase is meant to avoid.
          </p>
          <PassphraseDiagram />
          <p className="muted">
            This matters whenever the link itself might end up somewhere you don&apos;t control —
            forwarded by accident, sitting in a browser history, logged by a proxy along the way.
            The passphrase is a second, independent barrier that never sits next to the link
            anywhere.
          </p>
          <p className="muted">
            If you&apos;re worried about being pressured into handing a passphrase over, you can
            also set a <strong>duress passphrase</strong> — a second one that opens a decoy
            message instead of the real secret, and permanently destroys the real one at the same
            moment. Afterward, there&apos;s no way for anyone — including you — to tell which
            passphrase was actually used.
          </p>
          <DuressDiagram />
          <p className="muted">
            <strong>For example:</strong> you set your real passphrase to unlock the actual
            secret, and a duress passphrase that instead unlocks something harmless-looking — a
            grocery list, a note that says &quot;nothing here.&quot; Both passphrases go into the
            exact same single field on the reveal page; nothing about the page, the request, or
            the response differs based on which one gets typed. If you&apos;re ever forced to
            open it in front of someone, entering the duress passphrase shows them the decoy and
            permanently destroys the real secret in the same instant — there is no third state
            like &quot;duress was used&quot; stored anywhere, for anyone to find later, including
            you.
          </p>
        </section>

        <section className="page-section">
          <h2>Walk through it stage by stage</h2>
          <MissionBriefing />
        </section>

        <section className="page-section">
          <h2>Why not just use email or chat?</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col"></th>
                  <th scope="col">Email / chat app</th>
                  <th scope="col">Selfdestruct</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Where it lives afterward</th>
                  <td>Sits in inboxes, backups, and sync history — often on several devices</td>
                  <td>Nowhere — deleted from the server the moment it&apos;s read</td>
                </tr>
                <tr>
                  <th scope="row">Who could technically read it</th>
                  <td>The provider, anyone with inbox/backup access, forwarded threads</td>
                  <td>Only whoever holds the link — not us, not the server</td>
                </tr>
                <tr>
                  <th scope="row">Can it be opened more than once</th>
                  <td>Yes, indefinitely, by anyone with access</td>
                  <td>No — one successful reveal, then it&apos;s gone</td>
                </tr>
                <tr>
                  <th scope="row">Account required</th>
                  <td>Usually, for both sides</td>
                  <td>Never, for either side</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="page-section">
          <h2>What we explicitly don&apos;t do</h2>
          <ul className="list-check">
            <li>No logs of secret contents, on any route</li>
            <li>No accounts, so no per-user records to build up</li>
            <li>No analytics or session-replay scripts on the create or reveal pages</li>
            <li>No backups of secret data — storage is genuinely ephemeral, not just deleted-looking</li>
            <li>No IP logging or device fingerprinting on reveal</li>
            <li>No read receipts by default, and never a way to tell if the duress passphrase was used</li>
          </ul>
        </section>

        <section className="page-section">
          <h2>What&apos;s outside our control</h2>
          <p className="muted">
            Being honest about the edges matters as much as the guarantees above.
          </p>
          <ul className="list-check">
            <li>A malicious or compromised browser extension on either device can still read page content</li>
            <li>Screenshots or copies made after a secret is revealed — we have no visibility into that</li>
            <li>Screen-recording software defeats this system the same way it defeats any other</li>
            <li>Clipboard managers or clipboard history on your device can retain a copied secret</li>
            <li>With JavaScript disabled, the page can&apos;t encrypt or decrypt anything, so it fails closed rather than falling back to a weaker method</li>
          </ul>
        </section>

        <section className="page-section">
          <h2>The trade-off we accept on purpose</h2>
          <p className="muted">
            Because we don&apos;t log IPs or fingerprint visitors, we can&apos;t use those signals to
            throttle abuse the way many services do. We accept that deliberately, as the cost of
            genuine metadata minimisation — not as an oversight found later.
          </p>
        </section>

        <section className="page-section">
          <h2>Frequently asked questions</h2>
          <Faq />
        </section>

        <section className="page-section canary">
          <h2>Warrant canary</h2>
          <p>
            As of {CANARY_DATE}, Selfdestruct has received zero government or third-party requests
            for user data, and made zero changes to add backdoors or weaken this product&apos;s
            encryption. This statement is dated and updated regularly. If it stops being updated,
            treat that absence itself as a signal.
          </p>
        </section>

        <section className="page-section">
          <h2>Verify it yourself</h2>
          <p className="muted">
            The full source is public — the encryption, the atomic reveal-and-delete, the duress
            mechanism, all of it. Don&apos;t take the claims on this page on trust; read the code
            that makes them true.
          </p>
          <p>
            <a href="https://github.com/olearydc/selfdestruct">github.com/olearydc/selfdestruct</a>
          </p>
        </section>

        <section className="page-section">
          <h2>Support this project</h2>
          <p className="muted">
            Selfdestruct is free, always, for everyone — every security property on this page
            included. If it&apos;s been useful to you and you&apos;d like to help cover hosting
            costs, you can{" "}
            <a href={SUPPORTER_KOFI_URL}>leave a small contribution on Ko-fi</a>. It&apos;s
            entirely optional and doesn&apos;t unlock or change anything — just a thank-you that
            helps keep the lights on.
          </p>
        </section>

        <section className="page-section">
          <h2>Get in touch</h2>
          <p className="muted">
            Questions, a security issue to report, or something on this page that doesn&apos;t
            hold up — <a href="mailto:info@selfdestruct.online">info@selfdestruct.online</a>.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
