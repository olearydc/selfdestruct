"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { decryptSecret, hashPassphrase } from "@/lib/crypto";
import Header from "../../Header";
import Footer from "../../Footer";

type Stage =
  | "initial"
  | "needsPassphrase"
  | "wrongPassphrase"
  | "revealed"
  | "gone";

export default function RevealPage() {
  const params = useParams<{ id: string }>();
  const [stage, setStage] = useState<Stage>("initial");
  const [secret, setSecret] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // Belt-and-suspenders: also drop the plaintext reference on navigation
  // away, on top of the explicit "Done" button below.
  useEffect(() => {
    return () => setSecret(null);
  }, []);

  function getFragmentKey(): string {
    const key = window.location.hash.slice(1);
    if (!key) throw new Error("This link is missing its decryption key.");
    return key;
  }

  async function attemptReveal(passphraseHash: string) {
    setLoading(true);
    setFatalError(null);

    try {
      const response = await fetch(`/api/secret/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passphraseHash ? { passphraseHash } : {}),
      });

      if (response.status === 404) {
        setStage("gone");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch secret.");
      }

      const data = await response.json();

      if (data.status === "requiresPassphrase") {
        setStage("needsPassphrase");
        return;
      }

      if (data.status === "wrongPassphrase") {
        setStage("wrongPassphrase");
        return;
      }

      // data.status === "ok" — same code path regardless of whether this
      // was the real or duress passphrase; the server alone knows which.
      const key = getFragmentKey();
      let decrypted: string;
      try {
        decrypted = await decryptSecret(data.ciphertext, data.iv, key);
      } catch {
        // Decryption failed client-side — most likely a corrupted or
        // truncated key fragment. The fetch above did NOT delete the
        // secret (see lib/redis.ts), so it's still intact: burn is only
        // ever called after a successful decrypt, below. The original,
        // uncorrupted link will still work.
        setFatalError(
          "Couldn't decrypt this secret — the link may be incomplete or corrupted. " +
            "If you copied it manually, try the original link again.",
        );
        return;
      }

      // Only a confirmed, successful decrypt burns the secret.
      await fetch(`/api/secret/${params.id}/burn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passphraseHash ? { passphraseHash } : {}),
      }).catch(() => {
        // Best-effort: the client already has the plaintext regardless of
        // whether this confirmation round-trip succeeds.
      });

      setSecret(decrypted);
      setStage("revealed");
    } catch {
      setFatalError("Something went wrong. This link may be invalid.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePassphraseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await attemptReveal(await hashPassphrase(passphrase));
    setPassphrase("");
  }

  if (stage === "revealed") {
    return (
      <>
        <Header />
        <main>
          {secret !== null && (
            <div className="card">
              <div className="copy-row">
                <pre className="revealed-secret">{secret}</pre>
              </div>
              <div className="copy-row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(secret);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <span
                  className="info-icon"
                  title="Copying this text may save it to your device's clipboard history. Clear your clipboard after use if this matters."
                >
                  i
                </span>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setSecret(null)}>
                Done — clear from screen
              </button>
            </div>
          )}
          <p className="muted">
            🔥 Gone — no trace left. This secret has been permanently destroyed and can&apos;t
            be viewed again.
          </p>
        </main>
        <Footer />
      </>
    );
  }

  if (stage === "gone") {
    return (
      <>
        <Header />
        <main>
          <p role="alert">This secret no longer exists.</p>
        </main>
        <Footer />
      </>
    );
  }

  if (stage === "needsPassphrase" || stage === "wrongPassphrase") {
    return (
      <>
        <Header />
        <main>
          <form onSubmit={handlePassphraseSubmit} className="field-group">
            <label htmlFor="reveal-passphrase">This secret is protected by a passphrase.</label>
            <input
              id="reveal-passphrase"
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Passphrase"
              autoComplete="off"
              autoFocus
              required
            />
            <button type="submit" className="btn-primary" disabled={loading || !passphrase}>
              {loading ? "Checking..." : "Reveal secret"}
            </button>
            {stage === "wrongPassphrase" && (
              <p className="error-text" role="alert">
                That passphrase doesn&apos;t match. Try again.
              </p>
            )}
          </form>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main>
        {/* Deliberately not fetched on mount: an explicit click is required so
            a link-preview bot (Slack, iMessage, etc.) fetching the URL for a
            preview doesn't burn the secret before the intended recipient ever
            sees it. */}
        <button
          type="button"
          className="btn-primary"
          onClick={() => attemptReveal("")}
          disabled={loading}
        >
          {loading ? "Revealing..." : "Reveal secret — this can only be viewed once"}
        </button>
        {fatalError && (
          <p className="error-text" role="alert">
            {fatalError}
          </p>
        )}
      </main>
      <Footer />
    </>
  );
}
