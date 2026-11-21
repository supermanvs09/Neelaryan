/**
 * Guest service features: UPI payments with "I've paid" claims, pre-orders, time-based
 * offers, table service requests, order feedback, push subscriptions, ready-made items
 * sold from stock, and daily cash closing.
 */
export const sql = /* sql */ `
-- how the guest will pay; UPI payments are claimed by the guest and confirmed by staff
alter table orders add column payment_method text not null default 'cash' check (payment_method in ('cash','upi','counter'));
alter table orders add column upi_claimed_at timestamptz;
alter table orders add column upi_reference text check (upi_reference is null or char_length(upi_reference) <= 40);

-- pre-orders: picked up later today; the kitchen sees them 15 minutes before
alter table orders add column scheduled_for timestamptz;
create index orders_scheduled_idx on orders (scheduled_for) where scheduled_for is not null;

-- offers: percentage off chosen menu items, on chosen days and hours (café time)
create table offers (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 40),
  percent_off integer not null check (percent_off between 1 and 90),
  menu_item_ids uuid[] not null default '{}',            -- empty = whole menu
  days smallint[] not null default '{}' check (days <@ array[1,2,3,4,5,6,7]::smallint[]), -- ISO weekdays, empty = every day
  starts_at time not null default '00:00',
  ends_at time not null default '24:00',
  valid_from date,
  valid_to date,
  is_active boolean not null default true,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_window check (ends_at > starts_at),
  constraint offers_dates check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

-- per-unit discount taken off the base (size) price; add-ons are never discounted
alter table order_items add column discount numeric(10,2) not null default 0 check (discount >= 0);
alter table order_items add column offer_id uuid references offers(id) on delete set null;
alter table order_items add column offer_title text;

-- "ready-made" menu items (samosas, sandwiches made in batches) sell from an inventory item:
-- one unit per portion; the item shows as sold out when that stock runs out
alter table menu_items add column stock_item_id uuid references inventory_items(id) on delete set null;

-- rating after the order is served or completed (1 per order, editable for 3 days)
create table order_feedback (
  order_id uuid primary key references orders(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "call staff" from the table
create table service_requests (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references dining_tables(id) on delete cascade,
  kind text not null check (kind in ('water','cutlery','clean','bill','help')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references users(id) on delete set null
);
create index service_requests_open_idx on service_requests (created_at) where resolved_at is null;

-- web push subscriptions: a staff device, or a guest waiting for one order
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  lang text not null default 'en' check (lang in ('en','hi','te')),
  user_id uuid references users(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint push_owner check ((user_id is null) <> (order_id is null))
);
create unique index push_staff_key on push_subscriptions (endpoint) where user_id is not null;
create unique index push_order_key on push_subscriptions (endpoint, order_id) where order_id is not null;

-- end-of-day cash count
create table day_closings (
  day date primary key,
  opening_float numeric(12,2) not null check (opening_float >= 0),
  cash_received numeric(12,2) not null,
  cash_paid_out numeric(12,2) not null check (cash_paid_out >= 0),
  expected_cash numeric(12,2) not null,
  counted_cash numeric(12,2) not null check (counted_cash >= 0),
  difference numeric(12,2) not null,
  upi_received numeric(12,2) not null,
  card_received numeric(12,2) not null,
  note text not null default '',
  closed_by uuid references users(id) on delete set null,
  closed_at timestamptz not null default now()
);
`;
