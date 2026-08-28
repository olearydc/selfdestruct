const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function exportKeyBase64Url(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bufferToBase64Url(raw);
}

export async function encryptWithKey(
  plaintext: string,
  key: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(plaintext),
  );

  return {
    ciphertext: bufferToBase64Url(ciphertextBuffer),
    iv: bufferToBase64Url(iv.buffer as ArrayBuffer),
  };
}

/** Convenience wrapper for the common case: one secret, one fresh key. */
export async function encryptSecret(
  plaintext: string,
): Promise<{ ciphertext: string; iv: string; key: string }> {
  const key = await generateAesKey();
  const { ciphertext, iv } = await encryptWithKey(plaintext, key);
  return { ciphertext, iv, key: await exportKeyBase64Url(key) };
}

export async function decryptSecret(
  ciphertext: string,
  iv: string,
  keyBase64Url: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    base64UrlToBuffer(keyBase64Url),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBuffer(iv) },
    key,
    base64UrlToBuffer(ciphertext),
  );

  return textDecoder.decode(plaintextBuffer);
}

/**
 * Passphrases are hashed client-side and only the hash ever reaches the
 * server (for both storing and checking) — the server never sees a
 * plaintext passphrase. A plain SHA-256 digest, not a slow KDF: the
 * passphrase never touches the server in the clear either way, and this
 * keeps the reveal endpoint's atomic Lua comparison a simple string match.
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(passphrase));
  return bufferToBase64Url(digest);
}
