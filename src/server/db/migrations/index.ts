import { sql as init } from "./001_init";
import { sql as customerAuth } from "./002_customer_auth";

/** Ordered list of schema migrations. Never edit an applied migration — add a new one. */
export const migrations: { version: string; sql: string }[] = [
  { version: "001_init", sql: init },
  { version: "002_customer_auth", sql: customerAuth },
];
