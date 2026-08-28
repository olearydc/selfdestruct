import { headers } from "next/headers";
import { RATE_LIMIT_MAX_CREATES } from "@/lib/constants";

const FAQ_ITEMS = [
  {
    q: "What if someone intercepts the link?",
    a: "Whoever opens the link first gets the one-and-only reveal — the secret is then destroyed. If that's not you, opening it yourself will show \"no longer exists,\" which is itself a signal something's wrong. If you added a passphrase, an intercepted link alone isn't enough — for example, a link sitting unread in a hacked email account is useless without it.",
  },
  {
    q: "Can you read my secret?",
    a: "No. Encryption and decryption both happen in your browser. All we ever receive is scrambled bytes — the decryption key never reaches us, since it lives in the link itself, in a part of the URL browsers don't transmit to servers.",
  },
  {
    q: "What encryption does this actually use?",
    a: "AES-256-GCM, generated and run through your browser's built-in Web Crypto API — not a library we wrote ourselves. Every secret gets its own one-time key; nothing is ever reused across secrets. The full implementation is public — see \"Verify it yourself\" below rather than take our word for it.",
  },
  {
    q: "Is this protected against quantum computers?",
    a: "The connection between your browser and our server already is — it uses post-quantum hybrid key exchange (ML-KEM), confirmed with a real test against the live site, not just a setting we assume is on. That protects the scrambled data in transit from a \"harvest now, decrypt later\" attack. It doesn't extend to however you send the link itself (text, email, chat) — that's a channel we have no part in and can't control, so its own security depends on whatever app you used to send it.",
  },
  {
    q: "What happens after it's opened?",
    a: "It's permanently deleted from the server in the same atomic step as the reveal, not on a delay and not as a separate cleanup job. There's no way to view it a second time, including by us — a second visit to the same link gets \"no longer exists,\" not a cached copy.",
  },
  {
    q: "What if I lose the link before anyone opens it?",
    a: "The secret is gone. There are no accounts and no recovery — that's by design, not a missing feature. Treat the link itself as the only copy that exists anywhere, because it is.",
  },
  {
    q: "How big a secret can I send, and can I attach a file?",
    a: "Up to 100,000 characters of text — enough for a full config file or a long block of credentials, not just a single password. There's no file, image, or attachment support, and there won't be: keeping this to text only is what makes the zero-knowledge guarantee simple enough to actually verify, rather than a promise about a much larger, harder-to-audit surface.",
  },
  {
    q: "How long can a link stay active?",
    a: "You choose at creation: 5 minutes, 1 hour, 1 day, or 7 days. Whichever comes first — the expiry or someone opening it — ends the secret's life. There's no way to extend an expiry after the fact, and no way to shorten it either once it's set.",
  },
  {
    q: "Why does the reveal page need an extra click instead of just showing the secret?",
    a: "Requiring an explicit \"Reveal secret\" click, rather than decrypting automatically the instant the page loads, stops a link-preview bot (Slack, Teams, and similar apps often fetch a link automatically to generate a preview) from silently burning a secret before the real recipient ever sees it.",
  },
  {
    q: "Why would I ever use the duress passphrase?",
    a: "For anyone who might be forced to open a secret in front of someone else — handing over a phone at a border crossing, or under direct pressure from someone standing over your shoulder. Typing the duress passphrase instead of the real one shows a harmless decoy and destroys the real secret in the same instant, and nothing about the page or the response gives away that a duress passphrase was used, even to you afterward.",
  },
  {
    q: "Is there a limit on how many secrets I can create?",
    a: `Yes — up to ${RATE_LIMIT_MAX_CREATES} per hour, per browser. It's an anti-abuse limit, not IP-based (see the cookies question below), so it's easy to reset by switching browsers, and it exists purely to slow down automated abuse, not to cap normal use. It's shared with the batch-send page, so a large batch (or a couple close together) can use up a real chunk of it — if you hit the limit partway through a batch, the links already created are still live; wait a bit before creating more.`,
  },
  {
    q: "Do you use cookies or tracking scripts?",
    a: "No. There are no accounts, no analytics or session-replay scripts, and no per-secret or per-visitor logging. We keep only coarse, anonymous aggregate counters (like a total-secrets-created number) with nothing tying a count back to a specific secret or person.",
  },
  {
    q: "Is this really free?",
    a: "Yes. Encryption strength, zero-knowledge architecture, and every safety feature are free for everyone. Paid tiers, if offered, only add convenience — branded links, longer expiries, API limits — never stronger privacy for a fee.",
  },
];

// Generated straight from FAQ_ITEMS, not maintained as a separate copy, so
// the structured data can never say something different from what's
// actually on the page. Note for whoever revisits this: Google restricted
// FAQPage rich results to a small set of authoritative government/health
// sites in August 2023, so this won't produce a rich snippet in Google
// search specifically — it's still accurate, still standard schema.org
// markup, and other consumers (Bing, general entity/content understanding)
// don't carry that same restriction.
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default async function Faq() {
  // See app/page.tsx's WebSite JSON-LD for why this nonce is required.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(FAQ_JSON_LD).replace(/</g, "\\u003c"),
        }}
      />
      {FAQ_ITEMS.map((item) => (
        <details key={item.q} className="faq-item">
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
