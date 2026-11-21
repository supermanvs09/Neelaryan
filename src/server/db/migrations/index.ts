import { sql as init } from "./001_init";
import { sql as customerAuth } from "./002_customer_auth";
import { sql as supabase, lockdownSql } from "./003_supabase";
import { sql as service } from "./004_service";

export { lockdownSql };

/** Ordered list of schema migrations. Never edit an applied migration — add a new one. */
export const migrations: { version: string; sql: string }[] = [
  { version: "001_init", sql: init },
  { version: "002_customer_auth", sql: customerAuth },
  { version: "003_supabase", sql: supabase },
  { version: "004_service", sql: service },
];
