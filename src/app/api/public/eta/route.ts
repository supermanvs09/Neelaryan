import { api } from "@/server/http";
import { getSetting } from "@/server/settings";
import { kitchenEta } from "@/server/service";

/** "Ready in about N min" — from recent kitchen times and the current queue. */
export const GET = api(
  async () => {
    if (!(await getSetting("ordering")).show_wait_time) return { minutes: null };
    return kitchenEta();
  },
  { auth: "public" },
);
