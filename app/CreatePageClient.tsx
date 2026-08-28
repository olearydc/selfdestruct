"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
  encryptWithKey,
  exportKeyBase64Url,
  generateAesKey,
  hashPassphrase,
} from "@/lib/crypto";
import { MAX_SECRET_BYTES, EXPIRY_OPTIONS, DEFAULT_EXPIRY_SECONDS } from "@/lib/constants";
import PassphraseDiagram from "./info/PassphraseDiagram";

const textEncoder = new TextEncoder();
function byteLength(text: string): number {
  return textEncoder.encode(text).length;
}

function formatAbsoluteUtc(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

// A real on/off switch — the pill-button toggle it replaced tested fine
// but visually read as a text field to a first-time user (see commit
// history). Wrapping the <input> in the <label> keeps the whole control
// clickable, but the accessible name comes from aria-labelledby pointing
// at the row's own title (not the wrapping label's text) — otherwise the
// visible "On"/"Off" state text would become the checkbox's announced
// name instead of what it actually controls.
function ToggleSwitch({
  id,
  labelledBy,
  checked,
  onChange,
}: {
  id: string;
  labelledBy: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="toggle-switch">
      <input
        type="checkbox"
        id={id}
        aria-labelledby={labelledBy}
        className="toggle-switch-input"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-switch-track">
        <span className="toggle-switch-thumb" />
      </span>
      <span className="toggle-switch-state" aria-hidden="true">
        {checked ? "On" : "Off"}
      </span>
    </label>
  );
}

export default function CreatePage() {
  const [secret, setSecret] = useState("");
  const [expiresIn, setExpiresIn] = useState(DEFAULT_EXPIRY_SECONDS);
  const [passphraseEnabled, setPassphraseEnabled] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [duressEnabled, setDuressEnabled] = useState(false);
  const [duressPassphrase, setDuressPassphrase] = useState("");
  const [decoyMessage, setDecoyMessage] = useState("");

  const [result, setResult] = useState<{ link: string; expiresAt: Date } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (duressEnabled && duressPassphrase === passphrase) {
      setError("The duress passphrase must be different from the real passphrase.");
      return;
    }

    if (byteLength(secret) > MAX_SECRET_BYTES) {
      setError(`That's too long — please keep it under ${MAX_SECRET_BYTES.toLocaleString()} bytes.`);
      return;
    }

    if (duressEnabled && byteLength(decoyMessage) > MAX_SECRET_BYTES) {
      setError(`The decoy message is too long — please keep it under ${MAX_SECRET_BYTES.toLocaleString()} bytes.`);
      return;
    }

    setLoading(true);
    try {
      const key = await generateAesKey();
      const { ciphertext, iv } = await encryptWithKey(secret, key);

      const payload: Record<string, unknown> = { ciphertext, iv, expiresIn };

      if (passphraseEnabled && passphrase) {
        payload.passphraseHash = await hashPassphrase(passphrase);

        if (duressEnabled && duressPassphrase) {
          const decoy = await encryptWithKey(decoyMessage, key);
          payload.duress = {
            ciphertext: decoy.ciphertext,
            iv: decoy.iv,
            passphraseHash: await hashPassphrase(duressPassphrase),
          };
        }
      }

      const response = await fetch("/api/secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to create secret");
      }

      const { id } = await response.json();
      const fragmentKey = await exportKeyBase64Url(key);
      setResult({
        link: `${window.location.origin}/s/${id}#${fragmentKey}`,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      });

      // The plaintext is encrypted and sent — nothing further needs it.
      setSecret("");
      setPassphrase("");
      setDuressPassphrase("");
      setDecoyMessage("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const expiryLabel =
      EXPIRY_OPTIONS.find((option) => option.seconds === expiresIn)?.label ?? "soon";

    return (
      <div className="form-column">
        <div className="card">
          <p>Your one-time link is ready.</p>
          <div className="copy-row">
            <a href={result.link}>{result.link}</a>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(result.link);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="muted">
            This message will self-destruct in {expiryLabel} ({formatAbsoluteUtc(result.expiresAt)})
            — or the moment it&apos;s opened, whichever comes first.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => setResult(null)}>
          Create another
        </button>
      </div>
    );
  }

  return (
    <div className="form-column">
      <form onSubmit={handleSubmit} className="composer-card">
        <textarea
          className="composer-textarea"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder="Type it. Send it. Gone."
          autoComplete="off"
          autoFocus
          required
        />

        <div className="composer-meta">
          <span className={byteLength(secret) > MAX_SECRET_BYTES ? "error-text" : "muted"}>
            {byteLength(secret).toLocaleString()} / {MAX_SECRET_BYTES.toLocaleString()} bytes
          </span>
          <span className="pill-static" title="Not a setting — every secret deletes itself on the one time it's opened.">
            🔥 Always deletes after read
          </span>
        </div>

        <div className="composer-rows">
          <div className="composer-row">
            <div className="composer-row-info">
              <span className="composer-row-title">Expires in</span>
              <span className="muted composer-row-desc">
                How long the link stays valid before it self-destructs unopened.
              </span>
            </div>
            <div className="pill-row composer-row-options" role="group" aria-label="Expiry">
              {EXPIRY_OPTIONS.map((option) => (
                <button
                  key={option.seconds}
                  type="button"
                  className="pill"
                  aria-pressed={expiresIn === option.seconds}
                  onClick={() => setExpiresIn(option.seconds)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="composer-row">
            <div className="composer-row-info">
              <span className="composer-row-title" id="passphrase-toggle-label">Add a passphrase</span>
              <span className="muted composer-row-desc">
                If you add a passphrase, the link alone won&apos;t be enough — the recipient will
                also need the passphrase to open it.
              </span>
            </div>
            <ToggleSwitch
              id="passphrase-toggle"
              labelledBy="passphrase-toggle-label"
              checked={passphraseEnabled}
              onChange={(checked) => {
                setPassphraseEnabled(checked);
                if (!checked) setDuressEnabled(false);
              }}
            />
          </div>
        </div>

        {passphraseEnabled && (
          <div className="field-group composer-expanded">
            <input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Passphrase"
              autoComplete="off"
              required
            />
            <span className="muted">
              Share this with the recipient a different way, never with the link itself — a call,
              a different app, in person.
            </span>

            <PassphraseDiagram />
            <p className="muted composer-diagram-caption">
              <Link href="/info#passphrase">Read the full breakdown, including duress passphrases →</Link>
            </p>

            <div className="composer-row composer-row-nested">
              <div className="composer-row-info">
                <span className="composer-row-title" id="duress-toggle-label">Duress passphrase</span>
                <span className="muted composer-row-desc">
                  A second passphrase that shows a decoy instead of the real secret if you&apos;re
                  ever forced to unlock it — indistinguishable from the real one to anyone
                  watching.
                </span>
              </div>
              <ToggleSwitch
                id="duress-toggle"
                labelledBy="duress-toggle-label"
                checked={duressEnabled}
                onChange={setDuressEnabled}
              />
            </div>

            {duressEnabled && (
              <div className="field-group">
                <input
                  type="password"
                  value={duressPassphrase}
                  onChange={(event) => setDuressPassphrase(event.target.value)}
                  placeholder="Duress passphrase (must differ from the real one)"
                  autoComplete="off"
                  required
                />
                <textarea
                  value={decoyMessage}
                  onChange={(event) => setDecoyMessage(event.target.value)}
                  placeholder="Decoy message shown if the duress passphrase is entered"
                  autoComplete="off"
                  required
                />
                <span className="muted">
                  Entering the duress passphrase permanently destroys the real secret, at the
                  same time it shows the decoy. Neither you nor the recipient can tell afterwards
                  which passphrase was used.
                </span>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary composer-submit"
          disabled={loading || !secret || byteLength(secret) > MAX_SECRET_BYTES}
        >
          {loading ? "Creating..." : "🔒 Create secret link"}
        </button>
        {error && <p className="error-text" role="alert">{error}</p>}
      </form>
    </div>
  );
}
