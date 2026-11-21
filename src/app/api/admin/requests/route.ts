import { api } from "@/server/http";
import { q } from "@/server/db";

/** Open table requests (water, bill…) plus the last few handled ones. */
export const GET = api(
  async () => {
    const { rows } = await q(
      `select r.id, r.kind, r.created_at, r.resolved_at, t.label as table_label, u.name as resolved_by
         from service_requests r join dining_tables t on t.id = r.table_id left join users u on u.id = r.resolved_by
        where r.resolved_at is null or r.resolved_at > now() - interval '15 minutes'
        order by r.resolved_at is not null, r.created_at
        limit 60`,
    );
    return { requests: rows };
  },
  { permission: ["orders.view", "kitchen.view"] },
);
