"use client";

import { useState } from "react";

const STAGES = [
  {
    label: "Write",
    detail:
      "You type your secret into the create page. It never leaves your browser in this form.",
  },
  {
    label: "Encrypt",
    detail:
      "Your browser generates a one-time AES-256 key and encrypts the secret locally, before anything is sent anywhere.",
  },
  {
    label: "Split-path travel",
    detail:
      "Only the ciphertext goes to the server. The decryption key travels separately, inside the link itself, after the # — a part of the URL browsers never send to servers.",
  },
  {
    label: "Optional passphrase",
    detail:
      "You can add a passphrase, shared with the recipient through a different channel. You can also set a second, duress passphrase that quietly shows a decoy instead — indistinguishable from the real thing to anyone watching.",
  },
  {
    label: "One-time reveal",
    detail:
      "The recipient opens the link. Their browser fetches the ciphertext, reconstructs the key from the link, and decrypts locally — the server never sees the plaintext.",
  },
  {
    label: "Destroyed",
    detail:
      "The instant a successful reveal happens, the server permanently deletes the ciphertext in the same atomic step. A second visit finds nothing — not even a record that it once existed.",
  },
];

export default function MissionBriefing() {
  const [active, setActive] = useState(0);
  const stage = STAGES[active];

  return (
    <div>
      <div className="stepper" role="tablist" aria-label="Secret lifecycle stages">
        {STAGES.map((s, i) => (
          <button
            key={s.label}
            type="button"
            role="tab"
            aria-selected={active === i}
            className="pill"
            onClick={() => setActive(i)}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>
      <div className="stepper-detail" role="tabpanel" style={{ marginTop: "0.75rem" }}>
        <strong>{stage.label}</strong>
        <p className="muted" style={{ margin: "0.5rem 0 0" }}>
          {stage.detail}
        </p>
      </div>
    </div>
  );
}
