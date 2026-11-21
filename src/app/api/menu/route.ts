import { NextResponse } from "next/server";
import { loadMenu, publicMenuPayload } from "@/server/menu";
import { getSetting } from "@/server/settings";
import { errorResponse } from "@/server/http";
import { pushPublicKey } from "@/server/push";

/** Public menu (no costs). Any change in the admin is visible here immediately. */
export async function GET() {
  try {
    const [menu, ordering, tax, loyalty, business, payments] = await Promise.all([
      loadMenu("public"),
      getSetting("ordering"),
      getSetting("tax"),
      getSetting("loyalty"),
      getSetting("business"),
      getSetting("payments"),
    ]);
    return NextResponse.json(
      {
        ...publicMenuPayload(menu),
        ordering,
        payments: {
          cash: payments.cash_enabled,
          upi: payments.upi_enabled && !!payments.upi_id,
          upi_id: payments.upi_enabled ? payments.upi_id : null,
          upi_payee_name: payments.upi_payee_name,
        },
        push_key: pushPublicKey(),
        tax,
        business: { name: business.name, tagline: business.tagline },
        loyalty: {
          enabled: loyalty.enabled,
          points_per_100: loyalty.points_per_100,
          min_order_amount: loyalty.min_order_amount,
          point_value: loyalty.point_value,
          min_redeem_points: loyalty.min_redeem_points,
          max_redeem_percent: loyalty.max_redeem_percent,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
