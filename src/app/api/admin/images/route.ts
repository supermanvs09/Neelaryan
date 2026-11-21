import { api, bad } from "@/server/http";
import { q } from "@/server/db";
import { rateLimit } from "@/server/ratelimit";
import { StorageError, supabaseStorageEnabled, uploadToStorage } from "@/server/storage";
import { ApiError } from "@/server/http";

const TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);
const MAX = 1_500_000;

/** Signature check so a renamed file can't pass as an image. */
function sniff(buf: Buffer) {
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

/**
 * Food photo upload. The browser resizes to ≤1200px WebP before sending. With Supabase
 * configured the file goes to Supabase Storage; otherwise it is kept in the database.
 */
export const POST = api(
  async (ctx) => {
    await rateLimit(`upload:${ctx.user!.id}`, 60, 3600);
    const form = await ctx.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw bad("Choose an image to upload.");
    if (file.size > MAX) throw bad("That image is too large (max 1.5 MB after resizing).");
    const buf = Buffer.from(await file.arrayBuffer());
    const type = sniff(buf);
    if (!type || !TYPES.has(type)) throw bad("Upload a JPG, PNG or WebP image.");
    const width = Number(form?.get("width")) || null;
    const height = Number(form?.get("height")) || null;
    let storagePath: string | null = null;
    if (supabaseStorageEnabled()) {
      try {
        storagePath = await uploadToStorage(buf, type);
      } catch (e) {
        if (e instanceof StorageError) throw new ApiError(502, "The photo couldn't be saved to storage. Please try again.", "STORAGE");
        throw e;
      }
    }
    const { rows } = await q<{ id: string }>("insert into images (content_type, data, storage_path, bytes, width, height, created_by) values ($1,$2,$3,$4,$5,$6,$7) returning id", [
      type,
      storagePath ? null : buf,
      storagePath,
      buf.length,
      width,
      height,
      ctx.user!.id,
    ]);
    return { id: rows[0].id, url: `/api/images/${rows[0].id}` };
  },
  { permission: "menu.manage" },
);
