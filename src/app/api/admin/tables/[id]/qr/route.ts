import { z } from "zod";
import QRCode from "qrcode";
import { api, notFound } from "@/server/http";
import { q } from "@/server/db";
import { siteUrl, tableUrl } from "@/server/tables";

/** QR image for a table: ?format=svg (default) or png, &download=1 for a file. */
export const GET = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const format = ctx.req.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
    const { rows } = await q<{ label: string; qr_token: string }>("select label, qr_token from dining_tables where id = $1", [id]);
    if (!rows[0]) throw notFound("Table");
    const url = tableUrl(siteUrl(ctx.req.nextUrl.origin), rows[0].qr_token);
    const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#0B2A55", light: "#FFFFFF" } };
    const disposition = ctx.req.nextUrl.searchParams.get("download") === "1" ? `attachment; filename="table-${rows[0].label.replace(/\W+/g, "-")}-qr.${format}"` : "inline";
    if (format === "png") {
      const buf = await QRCode.toBuffer(url, { ...opts, width: 1024 });
      return new Response(new Uint8Array(buf), { headers: { "content-type": "image/png", "content-disposition": disposition, "cache-control": "no-store" } });
    }
    const svg = await QRCode.toString(url, { ...opts, type: "svg" });
    return new Response(svg, { headers: { "content-type": "image/svg+xml", "content-disposition": disposition, "cache-control": "no-store" } });
  },
  { permission: "tables.view" },
);
