/**
 * Supabase hardening + Storage-backed images.
 *
 * Supabase publishes the `public` schema through its auto-generated REST API to the
 * `anon` and `authenticated` roles (anyone holding the project's public anon key).
 * This app talks to the database only from its own server, so every table gets
 * row-level security with no policies, and those roles lose all privileges on it.
 * The server connects as the table owner, which RLS does not restrict.
 * On plain Postgres / PGlite (no such roles) the role statements are skipped.
 */
export const sql = /* sql */ `
-- images may live in Supabase Storage instead of the database
alter table images add column storage_path text;
alter table images alter column data drop not null;
alter table images add constraint images_has_content check (data is not null or storage_path is not null);
`;

/** Idempotent; run after every migration so tables added later are locked down too. */
export const lockdownSql = /* sql */ `
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
    execute 'revoke all on all functions in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
    execute 'revoke all on all functions in schema public from authenticated';
  end if;
  begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
      execute 'alter default privileges in schema public revoke all on sequences from anon, authenticated';
      execute 'alter default privileges in schema public revoke all on functions from anon, authenticated';
    end if;
  exception when others then null; -- not permitted for this role: per-table revokes above still apply
  end;
end $$;
`;
