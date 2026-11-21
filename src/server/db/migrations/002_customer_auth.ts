/** Customer sign-in flow, consent trail, campaign channels and job bookkeeping. */
export const sql = /* sql */ `
-- OTP: a verified challenge yields a one-time sign-up token for new customers
alter table otp_challenges add column verified_at timestamptz;
alter table otp_challenges add column signup_token_hash text;
create unique index otp_challenges_signup_token_key on otp_challenges (signup_token_hash) where signup_token_hash is not null;

-- where a customer record came from, and an audit-friendly consent source
alter table customers add column source text not null default 'self' check (source in ('self','staff'));
alter table customers add column consent_source text not null default '';
alter table customers add column unsubscribed_at timestamptz;

-- campaigns choose their channel through the template; keep a free-text note
alter table campaigns add column notes text not null default '';

-- a worker claims a message ('sending') before calling the provider, so it is never sent twice
alter table notifications drop constraint notifications_status_check;
alter table notifications add constraint notifications_status_check check (status in ('queued','sending','sent','delivered','failed','skipped'));
alter table notifications add column attempts integer not null default 0;

-- last run of each background job (cron), shown on the notifications screen
create table job_runs (
  name text primary key,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_result jsonb not null default '{}'::jsonb,
  last_error text
);
`;
