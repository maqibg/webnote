import { addSeconds, nowIso } from "./time.js";

const PBKDF2_ITERATIONS = 210000;
const HASH_BYTES = 32;
const encoder = new TextEncoder();

function base64UrlEncode(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function hashPassword(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: encoder.encode(salt),
    iterations: PBKDF2_ITERATIONS
  }, baseKey, HASH_BYTES * 8);

  return base64UrlEncode(bits);
}

export function generateSalt() {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
}

export async function verifyPassword(password, salt, expectedHash) {
  const actualHash = await hashPassword(password, salt);
  return timingSafeEqual(actualHash, expectedHash);
}

export function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

export async function createJwt(payload, secret, lifetimeSeconds) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + lifetimeSeconds;
  const jti = crypto.randomUUID();
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = base64UrlEncode(encoder.encode(JSON.stringify({
    ...payload,
    iat: issuedAt,
    exp: expiresAt,
    jti
  })));
  const unsigned = `${header}.${body}`;
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned));

  return {
    token: `${unsigned}.${base64UrlEncode(signature)}`,
    jti,
    expiresAt: addSeconds(new Date(), lifetimeSeconds).toISOString()
  };
}

export async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const key = await importHmacKey(secret);
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signature),
    encoder.encode(`${header}.${payload}`)
  );

  if (!isValid) {
    return null;
  }

  const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
  if (decoded.exp * 1000 < Date.now()) {
    return null;
  }

  return decoded;
}

export async function hashIp(ip) {
  if (!ip) {
    return "";
  }

  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(ip));
  return base64UrlEncode(digest);
}

export async function createNoteUnlockToken(noteId, mode, secret) {
  const payload = { scope: "note_unlock", noteId, mode, issuedAt: nowIso() };
  return createJwt(payload, secret, 3600);
}

