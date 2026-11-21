import { api } from "@/server/http";
import { kitchenFeed } from "@/server/kitchen";

export const GET = api(() => kitchenFeed(), { permission: "kitchen.view" });
