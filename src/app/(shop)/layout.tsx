import { ShopShell } from "@/components/shop/ShopShell";

/** Customer-facing shop: menu, ordering, tracking, rewards and account. */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <ShopShell>{children}</ShopShell>;
}
