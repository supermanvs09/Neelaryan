"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MenuGate } from "@/components/shop/ItemCard";
import { Builder } from "@/components/shop/Builder";
import { itemBySlug, isBuilder } from "@/lib/shop/menu";
import { useShop, useShopHydrated } from "@/lib/shop/store";

function Inner() {
  const { slug } = useParams<{ slug: string }>();
  const editKey = useSearchParams().get("edit");
  const hydrated = useShopHydrated();
  const cart = useShop((s) => s.cart);
  return (
    <MenuGate>
      {(menu) => {
        const item = itemBySlug(menu, slug);
        if (!item || !isBuilder(item))
          return (
            <div className="mx-auto max-w-md py-24 text-center">
              <p className="text-[20px] font-bold">This item isn&apos;t on the menu any more</p>
              <Link href="/menu" className="mt-5 inline-flex min-h-[48px] items-center rounded-lg bg-primary px-6 font-semibold text-primary-fg">
                Back to the menu
              </Link>
            </div>
          );
        if (editKey && !hydrated) return null;
        const edit = editKey ? cart.find((l) => l.key === editKey) ?? null : null;
        return <Builder key={`${item.id}:${edit?.key ?? ""}`} menu={menu} item={item} edit={edit} />;
      }}
    </MenuGate>
  );
}

export default function BuildPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
