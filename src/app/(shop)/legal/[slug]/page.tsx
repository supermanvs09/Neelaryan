import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

/**
 * Policy & info pages. Final wording comes from the café owner; until then
 * these pages state what's known and what still needs to be provided.
 */
const PAGES: Record<string, { title: string; body: { h?: string; p: string }[] }> = {
  terms: {
    title: "Terms, privacy & refunds",
    body: [
      { h: "Ordering", p: "Prices shown are in Indian Rupees and include the item price; GST is added at checkout. Availability may change during the day." },
      { h: "Payments & refunds", p: "Online payments are processed by Razorpay. If a payment fails, your cart is kept so you can retry. If money is deducted but your order is not confirmed, the café reconciles the payment and refunds it to the original payment method. Approved refunds (full or partial) go back to the original payment method." },
      { h: "Cancellations", p: "Orders can be cancelled before the kitchen accepts them. Once preparation begins, please speak to our team." },
      { h: "Privacy", p: "We use your name and mobile number to manage your order and rewards. Promotional messages are optional and you can turn them off any time in your profile." },
      { p: "The café's complete, legally reviewed terms and privacy policy will be published here before launch." },
    ],
  },
  support: {
    title: "Help & support",
    body: [
      { h: "At the café", p: "If you're dining in, any of our team can help with your order — just share your order number." },
      { h: "Order issues", p: "Open your order from Orders to see live status, payment status and your receipt." },
      { p: "Phone and email support details will be added by NEELARYAN Café before launch." },
    ],
  },
  about: {
    title: "About NEELARYAN",
    body: [
      { p: "NEELARYAN is a modern Indian café — wholesome oats bowls, thick shakes, crunchy chaat, café classics and refreshing coolers. Crave the goodness." },
      { p: "Branch locations and opening hours will be listed here." },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: PAGES[slug]?.title ?? "Information" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  return (
    <article className="mx-auto max-w-[720px] pb-12">
      <Link href="/profile" className="text-[14px] font-semibold text-gold-700 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-3 font-display text-[42px] font-semibold leading-tight text-navy-900">{page.title}</h1>
      <div className="mt-6 space-y-5 text-[15.5px] leading-relaxed text-ink-soft">
        {page.body.map((b, i) => (
          <section key={i}>
            {b.h && <h2 className="mb-1 text-[17px] font-bold text-navy-900">{b.h}</h2>}
            <p>{b.p}</p>
          </section>
        ))}
      </div>
      <nav className="mt-10 flex flex-wrap gap-3 text-[14px]" aria-label="More information">
        {Object.entries(PAGES).filter(([s]) => s !== slug).map(([s, p]) => (
          <Link key={s} href={`/legal/${s}`} className="chip border-sand-400 bg-white/70 text-navy-800 hover:border-gold-500">
            {p.title}
          </Link>
        ))}
      </nav>
    </article>
  );
}
