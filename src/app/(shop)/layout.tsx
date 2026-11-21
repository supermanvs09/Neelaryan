import { AppShell } from "@/components/shell/AppShell";
import { ProductSheet } from "@/components/menu/ProductSheet";

/** Customer-facing shop: menu, ordering, tracking, rewards. */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <ProductSheet />
    </>
  );
}
