# selfdestruct

A zero-knowledge, one-time secret-sharing tool. Paste a secret, get a
link. The recipient opens it once. Then it's gone — permanently, for
everyone, including us.

## How it works

Your browser generates an AES-256-GCM encryption key and encrypts the
secret locally, before anything is sent anywhere. Only the ciphertext is
sent to the server. The decryption key lives in the link itself, after
the `#` — a part of a URL that browsers never transmit to a server — so
the server never sees the plaintext or holds a key that could decrypt it.

Opening the link performs an atomic read-and-delete: the first successful
reveal both returns and permanently destroys the secret in the same
operation. A second visit finds nothing.

An optional passphrase can be added, itself never sent to the server in
plaintext. A second, duress passphrase can also be set — entering it
shows a decoy message instead of the real secret and permanently
destroys the real one, indistinguishable from a normal reveal to anyone
watching.

A separate batch page can also generate several independent one-time
links for the same message in one go (for handing the same password to
several people at once) — each link is still its own separate secret
with its own key, opened and destroyed independently of the others, not
one link shared several ways.

## Stack

Next.js (App Router) + Redis, no accounts, no database beyond the
key-value store used purely as short-lived ciphertext storage.

## Running locally

```
npm install
cp .env.example .env.local   # set REDIS_URL to a Redis instance you control
npm run dev
```

## Tests

```
npm run test:e2e
```

Playwright specs covering the create/reveal flow, the duress mechanism,
edge cases (expired/burned/malformed IDs, oversized payloads, failed
decrypts), CSP/hardening headers, and WCAG 2.1 AA accessibility.

## License

MIT — see [LICENSE](LICENSE).
