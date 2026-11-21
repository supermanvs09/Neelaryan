"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { Spinner, toast } from "@/components/shop/ui";
import { useShop } from "@/lib/shop/store";

/**
 * Landing page for a table's QR code: resolves the code to the table, remembers it,
 * and opens the menu. Retired or unknown codes get a clear message.
 */
export default function TableEntry() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(`/api/public/tables/${encodeURIComponent(token)}`, { cache: "no-store" });
        const j = await r.json();
        if (cancel) return;
        if (!r.ok) return setError(r.status === 404 ? "This table's QR code isn't active any more." : j.error ?? "Something went wrong.");
        const apply = () => {
          useShop.getState().setTable({ token: j.table.token, label: j.table.label, name: j.table.name });
          toast(`Welcome! You're at Table ${j.table.label}`);
          router.replace("/menu");
        };
        if (useShop.persist.hasHydrated()) apply();
        else {
          const off = useShop.persist.onFinishHydration(() => {
            off();
            apply();
          });
          useShop.persist.rehydrate();
        }
      } catch {
        if (!cancel) setError("You seem to be offline. Check your connection and scan again.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [token, router]);

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      {error ? (
        <>
          <QrCode size={30} className="mx-auto text-muted" aria-hidden />
          <p className="mt-3 text-[20px] font-bold">{error}</p>
          <p className="mt-1 text-muted">Please ask our team for help, or order takeaway from the menu.</p>
          <Link href="/menu" className="mt-5 inline-flex min-h-[48px] items-center rounded-full bg-primary px-6 font-semibold text-primary-fg">
            See the menu
          </Link>
        </>
      ) : (
        <div className="grid place-items-center gap-3 text-muted">
          <Spinner />
          <p>Finding your table…</p>
        </div>
      )}
    </div>
  );
}
