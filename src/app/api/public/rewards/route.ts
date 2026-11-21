import { api } from "@/server/http";
import { getSetting } from "@/server/settings";
import { publicRewards } from "@/server/customers/account";

/** Reward catalogue (visible to everyone, redeemable when signed in). */
export const GET = api(
  async () => {
    const loyalty = await getSetting("loyalty");
    if (!loyalty.enabled) return { enabled: false, rewards: [] };
    return { enabled: true, rewards: await publicRewards(), points_per_100: loyalty.points_per_100, min_order_amount: loyalty.min_order_amount };
  },
  { auth: "public" },
);
