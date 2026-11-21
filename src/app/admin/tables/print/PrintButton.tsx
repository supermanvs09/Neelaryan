"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/admin/ui";

export function PrintButton() {
  return (
    <Button icon={<Printer size={16} />} onClick={() => window.print()}>
      Print
    </Button>
  );
}
