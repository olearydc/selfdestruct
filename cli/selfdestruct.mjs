#!/usr/bin/env node
// Customer-facing CLI for Pro API users — a thin wrapper around
// POST /api/pro/secret, per docs/phases/phase-8-pro-tier.md and
// MONETISATION.md's "near-zero additional engineering cost" estimate.
//
// Not the same thing as scripts/create-api-key.mjs / revoke-api-key.mjs,
// which are operator-only key management. This is what a paying customer
// actually runs to create a secret from a terminal or a script.
//
// Encryption happens here, client-side, exactly the way it does in the
// browser (lib/crypto.ts) — AES-256-GCM via Node's own crypto module
// rather than Web Crypto, since there's no browser here, but byte-for-byte
// the same format: a random 256-bit key, a random 12-byte IV, ciphertext
// with its 16-byte GCM auth tag appended (the WebCrypto convention), all
// base64url-encoded. The server only ever sees ciphertext+iv, never the
// key — same zero-knowledge guarantee, same code, just a different client.
import { createCipheriv, createHash, randomBytes } from "node:crypto";

const DEFAULT_API_URL = process.env.SELFDESTRUCT_API_URL ?? "https://selfdestruct.online";
const DEFAULT_EXPIRES_IN = 60 * 60; // 1 hour, same default as the web UI

function encryptSecret(plaintext) {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([ciphertext, tag]).toString("base64url"),
    iv: iv.toString("base64url"),
    key: key.toString("base64url"),
  };
}

function hashPassphrase(passphrase) {
  return createHash("sha256").update(passphrase, "utf8").digest("base64url");
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data.replace(/\n$/, "")));
    process.stdin.on("error", reject);
  });
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--expires-in") args.expiresIn = Number(argv[++i]);
    else if (arg === "--passphrase") args.passphrase = argv[++i];
    else if (arg === "--slug") args.slug = argv[++i];
    else if (arg === "--api-url") args.apiUrl = argv[++i];
    else args._.push(arg);
  }
  return args;
}

function printUsage() {
  console.error(`Usage:
  SELFDESTRUCT_API_KEY=<key> node cli/selfdestruct.mjs create "secret text" [options]
  echo "secret text" | SELFDESTRUCT_API_KEY=<key> node cli/selfdestruct.mjs create [options]

Options:
  --expires-in <seconds>   Default ${DEFAULT_EXPIRES_IN} (1 hour), up to your key's own limit
  --passphrase <text>      Optional. Required if using --slug.
  --slug <name>            Optional custom link ending, e.g. --slug client-invoice
  --api-url <url>          Default ${DEFAULT_API_URL} (or $SELFDESTRUCT_API_URL)

The API key is never read from a flag — only $SELFDESTRUCT_API_KEY —
so it can't end up in shell history or a process list.`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== "create") {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const args = parseArgs(rest);
  const apiKey = process.env.SELFDESTRUCT_API_KEY;
  if (!apiKey) {
    console.error("Error: set SELFDESTRUCT_API_KEY in your environment.");
    process.exitCode = 1;
    return;
  }

  const text = args._[0] ?? (await readStdin());
  if (!text) {
    console.error("Error: no secret text given (as an argument or on stdin).");
    process.exitCode = 1;
    return;
  }

  if (args.slug && !args.passphrase) {
    console.error(
      "Error: --slug requires --passphrase — a guessable custom link without one could let someone else destroy the secret before your recipient opens it.",
    );
    process.exitCode = 1;
    return;
  }

  const { ciphertext, iv, key } = encryptSecret(text);
  const apiUrl = args.apiUrl ?? DEFAULT_API_URL;

  const body = {
    ciphertext,
    iv,
    expiresIn: args.expiresIn ?? DEFAULT_EXPIRES_IN,
  };
  if (args.passphrase) body.passphraseHash = hashPassphrase(args.passphrase);
  if (args.slug) body.slug = args.slug;

  const response = await fetch(new URL("/api/pro/secret", apiUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error(`Error (${response.status}): ${result.error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`${apiUrl}/s/${result.id}#${key}`);
}

main();
