"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { encryptWithKey, exportKeyBase64Url, generateAesKey } from "@/lib/crypto";
import { MAX_SECRET_BYTES, EXPIRY_OPTIONS, DEFAULT_EXPIRY_SECONDS, BATCH_MAX_ITEMS } from "@/lib/constants";

const textEncoder = new TextEncoder();
function byteLength(text: string): number {
  return textEncoder.encode(text).length;
}

const MIN_LINKS = 2;

// How long "Copied" stays visible before the row starts fading, and how
// long that fade itself takes (must match .batch-result-poofing's
// transition duration in globals.css) — a copied link is done its job,
// so it clears itself out of the way rather than sitting there as one
// more thing to track by eye while the rest of the room is still waiting.
const COPIED_DISPLAY_MS = 1000;
const POOF_DURATION_MS = 300;

export default function BatchPageClient() {
  const [message, setMessage] = useState("");
  const [count, setCount] = useState(3);
  const [expiresIn, setExpiresIn] = useState(DEFAULT_EXPIRY_SECONDS);
  const [links, setLinks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [poofingLink, setPoofingLink] = useState<string | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  async function handleCopy(link: string) {
    await navigator.clipboard.writeText(link);
    setCopiedLink(link);

    const poofTimeout = setTimeout(() => {
      setPoofingLink(link);
      const removeTimeout = setTimeout(() => {
        setLinks((prev) => prev.filter((l) => l !== link));
        setPoofingLink((prev) => (prev === link ? null : prev));
        setCopiedLink((prev) => (prev === link ? null : prev));
      }, POOF_DURATION_MS);
      timeoutsRef.current.push(removeTimeout);
    }, COPIED_DISPLAY_MS);
    timeoutsRef.current.push(poofTimeout);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (byteLength(message) > MAX_SECRET_BYTES) {
      setError(`That's too long — please keep it under ${MAX_SECRET_BYTES.toLocaleString()} bytes.`);
      return;
    }

    setLoading(true);
    const created: string[] = [];
    try {
      // Sequential, not parallel — if something goes wrong partway (a
      // rate limit, a network blip), this stops cleanly after however
      // many succeeded, instead of firing all of them at once and
      // leaving it unclear which actually made it.
      for (let i = 0; i < count; i++) {
        // A fresh key and a fresh encryption for every copy, even though
        // the plaintext is identical each time — these end up as
        // genuinely separate secrets that happen to say the same thing,
        // not one secret with several doors into it.
        const key = await generateAesKey();
        const { ciphertext, iv } = await encryptWithKey(message, key);

        const response = await fetch("/api/secret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ciphertext, iv, expiresIn }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            typeof body?.error === "string" ? body.error : `Failed to create a link (${response.status}).`,
          );
        }

        const { id } = await response.json();
        const fragmentKey = await exportKeyBase64Url(key);
        created.push(`${window.location.origin}/s/${id}#${fragmentKey}`);
      }
      setLinks((prev) => [...prev, ...created]);
    } catch (err) {
      setLinks((prev) => [...prev, ...created]);
      const reason = err instanceof Error ? err.message : "Something went wrong.";
      setError(
        created.length > 0
          ? `Created ${created.length} of ${count} before this happened: ${reason} The links below are already live — copy those now, then try again for the rest.`
          : reason,
      );
    } finally {
      // Cleared either way, success or failure: whatever made it through
      // is already sent and doesn't need to sit in the browser as
      // plaintext any longer, and it's quick to retype if it didn't.
      setMessage("");
      setLoading(false);
    }
  }

  return (
    <div className="form-column">
      <form onSubmit={handleSubmit} className="composer-card">
        <textarea
          className="composer-textarea"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="The wifi password, the standup link, whatever the whole room needs."
          autoComplete="off"
          autoFocus
          required
        />

        <div className="composer-meta">
          <span className={byteLength(message) > MAX_SECRET_BYTES ? "error-text" : "muted"}>
            {byteLength(message).toLocaleString()} / {MAX_SECRET_BYTES.toLocaleString()} bytes
          </span>
          <span
            className="pill-static"
            title="Same message, but each link is its own separate secret — opening one never affects the others."
          >
            🔥 Each link deletes itself independently
          </span>
        </div>

        <div className="composer-rows">
          <div className="composer-row">
            <div className="composer-row-info">
              <span className="composer-row-title">Number of links</span>
              <span className="muted composer-row-desc">
                One per person — copy each one individually and send it to whoever needs it.
              </span>
            </div>
            <div className="count-stepper">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCount((c) => Math.max(MIN_LINKS, c - 1))}
                disabled={count <= MIN_LINKS}
                aria-label="Fewer links"
              >
                −
              </button>
              <span className="count-stepper-value">{count}</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCount((c) => Math.min(BATCH_MAX_ITEMS, c + 1))}
                disabled={count >= BATCH_MAX_ITEMS}
                aria-label="More links"
              >
                +
              </button>
            </div>
          </div>

          <div className="composer-row">
            <div className="composer-row-info">
              <span className="composer-row-title">Expires in</span>
              <span className="muted composer-row-desc">Applies to every link in this batch.</span>
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
        </div>

        <div className="composer-submit-row">
          <button
            type="submit"
            className="btn-primary composer-submit"
            disabled={loading || !message || byteLength(message) > MAX_SECRET_BYTES}
          >
            {loading ? "Creating..." : `🔒 Create ${count} links`}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading || !message}
            onClick={() => {
              setMessage("");
              setError(null);
            }}
          >
            Clear
          </button>
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </form>

      {links.length > 0 && (
        <div className="card">
          <p>
            {links.length} link{links.length === 1 ? "" : "s"} ready, all carrying the same message.
            Copy each one individually and send it to the right person — pasting them all into one
            place undoes the point of sending them separately.
          </p>
          <div className="batch-results">
            {links.map((link, index) => (
              <div
                className={poofingLink === link ? "batch-result batch-result-poofing" : "batch-result"}
                key={link}
              >
                <span className="batch-result-label">Link {index + 1}</span>
                <div className="copy-row">
                  <a href={link}>{link}</a>
                  <button type="button" className="btn-secondary" onClick={() => handleCopy(link)}>
                    {copiedLink === link ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary" onClick={() => setLinks([])}>
            Clear list
          </button>
        </div>
      )}
    </div>
  );
}
