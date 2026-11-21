import type { Metadata } from "next";
import { q } from "@/server/db";
import { getSetting } from "@/server/settings";
import { UnsubscribeForm } from "./UnsubscribeForm";

export const metadata: Metadata = { title: "Email & SMS preferences", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [{ rows }, business] = await Promise.all([
    q<{ name: string; subscribed: boolean }>("select name, (marketing_consent and unsubscribed_at is null) as subscribed from customers where unsubscribe_token = $1", [token.slice(0, 80)]),
    getSetting("business"),
  ]);
  const c = rows[0];
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-fg">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 text-center">
        <p className="eyebrow">{business.name}</p>
        {!c ? (
          <>
            <h1 className="mt-2 text-[22px] font-bold">This link isn&apos;t valid</h1>
            <p className="mt-2 text-muted">It may be from a test message or an old link. If you keep getting messages you don&apos;t want, tell us at the café and we&apos;ll stop them.</p>
          </>
        ) : (
          <UnsubscribeForm token={token} name={c.name.split(/\s+/)[0]} subscribed={c.subscribed} />
        )}
      </div>
    </main>
  );
}
