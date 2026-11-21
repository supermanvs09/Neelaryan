import type { Metadata } from "next";
import { KitchenScreen } from "@/components/kitchen/KitchenScreen";

export const metadata: Metadata = { title: "Kitchen", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <KitchenScreen k={key} />;
}
