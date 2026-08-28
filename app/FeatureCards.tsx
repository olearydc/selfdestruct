const FEATURES = [
  {
    title: "Zero-knowledge encryption",
    description:
      "Encryption happens on your device, before anything is sent. We store scrambled bytes we can't unscramble — there's no key on our end to lose, hand over, or be compelled to produce.",
  },
  {
    title: "One-time, self-destructing link",
    description:
      "The link works exactly once. The moment it's opened, the secret is deleted — permanently, not just hidden.",
  },
  {
    title: "Duress passphrase",
    description:
      "An optional second passphrase that reveals a stand-in message instead of the real secret — indistinguishable from the real one to anyone watching.",
  },
  {
    title: "Quick exit",
    description:
      "A one-click way to leave instantly and land somewhere neutral, available on every page — the small button in the header. If you ever need it, it's always right there.",
  },
  {
    title: "No accounts, ever",
    description:
      "Nothing to sign up for on either end. No email, no password to reuse, no profile tying a secret back to you.",
  },
  {
    title: "EU-hosted infrastructure",
    description:
      "Runs on servers we operate, headquartered in the EU — not just an EU region of a company based elsewhere. Real jurisdiction, not a marketing distinction.",
  },
  {
    title: "No logs of what you send",
    description:
      "No per-secret or per-visitor logging, no analytics scripts, nothing to subpoena that would reveal a secret's contents after the fact.",
  },
];

export default function FeatureCards() {
  return (
    <div className="feature-grid">
      {FEATURES.map((feature) => (
        <div className="feature-card" key={feature.title}>
          <h3>{feature.title}</h3>
          <p className="muted">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}
