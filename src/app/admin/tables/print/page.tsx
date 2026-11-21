import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireUser } from "@/server/auth/current";
import { listTables, siteUrl, tableUrl } from "@/server/tables";
import { getSetting } from "@/server/settings";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Print table QR codes" };

/** A4 sheet of table cards (2 × 3 per page) ready to print, cut and place. */
export default async function PrintQrPage() {
  await requireUser("/admin/tables/print", "tables.view");
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const base = siteUrl(origin);
  const [tables, business] = await Promise.all([listTables(), getSetting("business")]);
  const cards = await Promise.all(
    tables.map(async (t) => ({
      ...t,
      svg: await QRCode.toString(tableUrl(base, t.qr_token), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#23324C", light: "#FFFFFF" } }),
    })),
  );
  return (
    <div className="bg-[#fff] text-[#23324C]">
      <style>{`@page{size:A4;margin:10mm}@media print{.no-print{display:none!important}header,aside{display:none!important}main{padding:0!important;max-width:none!important}body{background:#fff!important}}`}</style>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <p className="text-[14px] text-muted">
          {cards.length} tables · codes point to <b>{base}</b>. Set <code>NEXT_PUBLIC_SITE_URL</code> to your live domain before printing.
        </p>
        <PrintButton />
      </div>
      <div className="grid grid-cols-2 gap-[8mm]">
        {cards.map((t) => (
          <div key={t.id} className="flex break-inside-avoid flex-col items-center rounded-[4mm] border-2 border-[#B58A45] p-[6mm] text-center" style={{ height: "88mm" }}>
            <p className="text-[20px] font-bold leading-none">{business.name}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#7E5E28]">Scan to order</p>
            <div className="my-[3mm] h-[46mm] w-[46mm]" dangerouslySetInnerHTML={{ __html: t.svg }} />
            <p className="text-[12px]">Table</p>
            <p className="num text-[30px] font-bold leading-none">{t.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
