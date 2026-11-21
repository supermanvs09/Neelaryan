import "server-only";
import { randomUUID } from "node:crypto";

/**
 * Menu photo storage.
 *  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set → Supabase Storage (public bucket,
 *    SUPABASE_STORAGE_BUCKET, default "menu-images"), served from Supabase's CDN.
 *  - otherwise → stored in the database and served by /api/images/[id] (development).
 * The service-role key is used only here, on the server, and never sent to browsers.
 */

const env = (k: string) => process.env[k]?.trim() || "";
export const supabaseStorageEnabled = () => Boolean(env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
const base = () => env("SUPABASE_URL").replace(/\/$/, "");
const bucket = () => env("SUPABASE_STORAGE_BUCKET") || "menu-images";
const headers = (extra: Record<string, string> = {}) => ({ authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, apikey: env("SUPABASE_SERVICE_ROLE_KEY"), ...extra });

export class StorageError extends Error {}

let bucketReady: Promise<void> | null = null;

/** Creates the public bucket the first time (no-op if it already exists). */
function ensureBucket() {
  bucketReady ??= (async () => {
    const r = await fetch(`${base()}/storage/v1/bucket`, {
      method: "POST",
      headers: headers({ "content-type": "application/json" }),
      body: JSON.stringify({ id: bucket(), name: bucket(), public: true, file_size_limit: 2_000_000, allowed_mime_types: ["image/webp", "image/jpeg", "image/png"] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok && r.status !== 409) {
      const j = (await r.json().catch(() => ({}))) as { message?: string; error?: string; statusCode?: string };
      // Supabase answers 400 with "already exists" for an existing bucket on some versions
      if (!/already exists/i.test(j.message ?? j.error ?? "")) throw new StorageError(`Supabase Storage: couldn't create bucket (${r.status} ${j.message ?? j.error ?? ""})`);
    }
  })();
  bucketReady.catch(() => (bucketReady = null));
  return bucketReady;
}

const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/** Uploads an image and returns its storage path inside the bucket. */
export async function uploadToStorage(buf: Buffer, contentType: string) {
  await ensureBucket();
  const path = `items/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${EXT[contentType] ?? "bin"}`;
  const r = await fetch(`${base()}/storage/v1/object/${bucket()}/${path}`, {
    method: "POST",
    headers: headers({ "content-type": contentType, "cache-control": "31536000", "x-upsert": "false" }),
    body: new Uint8Array(buf),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new StorageError(`Supabase Storage upload failed (${r.status} ${j.message ?? j.error ?? ""})`);
  }
  return path;
}

/** Public CDN URL of a stored object. */
export const publicUrl = (path: string) => `${base()}/storage/v1/object/public/${bucket()}/${path}`;
