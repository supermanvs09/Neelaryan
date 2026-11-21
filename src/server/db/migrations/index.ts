import { sql as init } from "./001_init";

/** Ordered list of schema migrations. Never edit an applied migration — add a new one. */
export const migrations: { version: string; sql: string }[] = [{ version: "001_init", sql: init }];
