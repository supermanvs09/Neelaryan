import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

function scrypt(password: string, salt: Buffer, keylen: number, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, keylen, { N: n, r, p, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** scrypt (memory-hard) password hash, stored as `scrypt$N$r$p$salt$hash` (base64 parts). */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(password, Buffer.from(salt, "base64"), expected.length, Number(n), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Returns what's wrong with a new password, or null when it is acceptable. */
export function passwordProblem(password: string, opts: { username?: string; current?: string } = {}) {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 128) return "Use at most 128 characters.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Include letters and at least one number.";
  const lower = password.toLowerCase();
  if (opts.username && opts.username.length >= 3 && lower.includes(opts.username.toLowerCase())) return "Don't include your username.";
  const initial = (process.env.INITIAL_ADMIN_PASSWORD ?? "welcome@2026").toLowerCase();
  if ([initial, "welcome@2026", "password123", "neelaryan123", "admin@12345"].includes(lower)) return "That password is too common or is the initial password.";
  if (opts.current && password === opts.current) return "Choose a password different from your current one.";
  return null;
}
