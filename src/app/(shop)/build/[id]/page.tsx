"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MENU_BY_ID } from "@/data/menu";
import { builderKindFor } from "@/data/builders";
import { Builder } from "@/components/builder/Builder";

function BuildInner() {
  const { id } = useParams<{ id: string }>();
  const edit = useSearchParams().get("edit");
  const item = MENU_BY_ID[id];
  const kind = item ? builderKindFor(item) : null;
  if (!item || !kind) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="font-display text-[30px] font-semibold text-navy-900">This item can&apos;t be customised</p>
        <Link href="/menu" className="btn-primary mt-6">
          Back to the menu
        </Link>
      </div>
    );
  }
  return <Builder key={`${item.id}:${edit ?? ""}`} item={item} kind={kind} editKey={edit} />;
}

export default function BuildPage() {
  return (
    <Suspense>
      <BuildInner />
    </Suspense>
  );
}
