"use client";

import { QrCode, ShoppingBag, Bike } from "lucide-react";
import { useApp } from "@/store/app";
import { useAppHydrated } from "@/lib/hooks";
import { EntryChooser } from "@/components/home/EntryChooser";
import { CinematicHero } from "@/components/home/CinematicHero";
import { CategoryRail, Favourites, LoyaltyTeaser, SignatureBuilders } from "@/components/home/HomeSections";
import { modeLabel } from "@/components/shell/ModePicker";

function greetingFor(h: number) {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const hydrated = useAppHydrated();
  const mode = useApp((s) => s.mode);
  const table = useApp((s) => s.table);
  const profile = useApp((s) => s.profile);

  if (!hydrated) return <div className="min-h-[70vh]" aria-busy="true" />;
  if (!mode) return <EntryChooser />;

  const Icon = mode === "dine-in" ? QrCode : mode === "takeaway" ? ShoppingBag : Bike;
  const name = profile?.name?.split(" ")[0];
  const hello = `${greetingFor(new Date().getHours())}${name ? `, ${name}` : ""}.`;

  return (
    <>
      <CinematicHero
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Icon size={14} /> NEELARYAN Café · {mode === "dine-in" && table ? `Table ${table}` : modeLabel(mode, table)}
          </span>
        }
        greeting={
          <>
            {hello} Wholesome oats bowls, thick shakes, chaat and café classics — made fresh, exactly how you like them.
          </>
        }
      />
      <CategoryRail />
      <SignatureBuilders />
      <Favourites />
      <LoyaltyTeaser />
    </>
  );
}
