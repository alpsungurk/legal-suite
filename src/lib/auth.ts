/**
 * Şifre hash'leme (WebCrypto PBKDF2). Veri tarayıcıda durduğu sürece bu gerçek bir
 * güvenlik sınırı değildir; amaç şifrelerin düz metin saklanmaması ve Supabase'e
 * geçişte aynı akışın korunmasıdır.
 */

const ITERATIONS = 60_000;

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

export async function hashPassword(password: string, salt: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export async function createPasswordRecord(password: string) {
  const salt = randomSalt();
  return { passwordSalt: salt, passwordHash: await hashPassword(password, salt) };
}

export async function verifyPassword(password: string, salt: string, hash: string) {
  if (!hash) return false;
  return (await hashPassword(password, salt)) === hash;
}

export function passwordProblem(password: string): string | null {
  if (password.length < 6) return "Şifre en az 6 karakter olmalı";
  return null;
}
