import type { Metadata } from "next";
import Link from "next/link";

import Header from "../Header";
import Footer from "../Footer";
import BatchPageClient from "./BatchPageClient";
import { RATE_LIMIT_MAX_CREATES } from "@/lib/constants";

export const metadata: Metadata = {
  // absolute — this title already names the brand implicitly enough on
  // its own; see app/info/page.tsx for why the other secondary pages do
  // the same.
  title: { absolute: "Send the same secret to several people — Selfdestruct" },
  description:
    "Type one message and get back several separate one-time links to hand out — each one is still its own zero-knowledge secret, opened and destroyed independently of the others.",
};

// Required for the per-request CSP nonce set in proxy.ts — see the comment
// there for why every page needs one, not just the create/reveal flow.
export const dynamic = "force-dynamic";

export default function BatchPage() {
  return (
    <>
      <Header />
      <main className="wide-main">
        <section className="page-section">
          <h1 className="headline">Send the same secret to several people</h1>
          <p className="muted">
            For a meeting where everyone needs the same wifi password or standup link, without
            pasting it into the chat where it sits forever. Type the message once, choose how many
            links you need, and copy each one out individually — every link is still its own
            one-time secret, so one being opened never affects the rest, and none of them carry a
            passphrase. If you need passphrase protection or the duress option, send that one from
            the <Link href="/">main page</Link> instead.
          </p>
          <p className="muted">
            One limit worth knowing about:{" "}
            <strong>this browser can create up to {RATE_LIMIT_MAX_CREATES} secrets an hour.</strong>
          </p>
          <p className="muted">
            The same abuse-prevention cap the main page uses, just shared across every link in this
            batch tool also. A big batch, or a couple of batches close together, can use up a real
            chunk of that. If a batch stops partway through with an error, the links already shown
            above it are still live — copy those, then wait a bit before creating more.
          </p>
        </section>
        <BatchPageClient />
      </main>
      <Footer />
    </>
  );
}
