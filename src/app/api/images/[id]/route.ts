import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/server/db";
import { publicUrl } from "@/server/storage";

/** Public image delivery. Images are immutable (a new upload gets a new id), so cache forever. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return new NextResponse("Not found", { status: 404 });
  const { rows } = await q<{ content_type: string; data: Buffer | Uint8Array | null; storage_path: string | null }>("select content_type, data, storage_path from images where id = $1", [id.data]);
  if (!rows[0]) return new NextResponse("Not found", { status: 404 });
  // stored in Supabase Storage → served from its CDN
  if (rows[0].storage_path) return NextResponse.redirect(publicUrl(rows[0].storage_path), { status: 308, headers: { "cache-control": "public, max-age=31536000, immutable" } });
  if (!rows[0].data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(rows[0].data), {
    headers: {
      "content-type": rows[0].content_type,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
