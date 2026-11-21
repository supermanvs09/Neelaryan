/**
 * 001 — Neelaryan core schema.
 *
 * Conventions
 *  - Money is numeric(12,2) in rupees; unit costs keep more precision (per base unit).
 *  - Inventory quantities are stored in a base unit (g, ml, pcs, packet).
 *  - Nothing financial is hard-deleted: records are voided/deactivated so reports stay true.
 *  - audit_logs is append-only (enforced by trigger).
 */
export const sql = /* sql */ `
-- ── Access control ─────────────────────────────────────────────────────────
create table roles (
  key text primary key,
  name text not null,
  description text not null default '',
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  name text not null,
  email text,
  phone text,
  role_key text not null references roles(key),
  password_hash text not null,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_username_key on users (lower(username));

create table sessions (
  id text primary key,                    -- sha256 of the cookie token
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  ip text,
  user_agent text
);
create index sessions_user_idx on sessions (user_id);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create table audit_logs (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid references users(id) on delete set null,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  ip text
);
create index audit_logs_at_idx on audit_logs (at desc);
create index audit_logs_entity_idx on audit_logs (entity, entity_id);

create function audit_logs_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end $$;
create trigger audit_logs_no_update before update or delete on audit_logs
  for each row execute function audit_logs_append_only();

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── Tables & QR ────────────────────────────────────────────────────────────
create table dining_tables (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  name text not null default '',
  seats integer not null default 4 check (seats between 1 and 50),
  area text not null default '',
  qr_token text not null unique,
  is_active boolean not null default true,
  sort integer not null default 0,
  qr_generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index dining_tables_label_key on dining_tables (lower(label));

-- ── Media ──────────────────────────────────────────────────────────────────
create table images (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('image/webp','image/jpeg','image/png')),
  data bytea not null,
  bytes integer not null check (bytes <= 2000000),
  width integer,
  height integer,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── Menu ───────────────────────────────────────────────────────────────────
create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  art_kind text not null default 'coffee',
  sort integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references menu_categories(id),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  cost_price numeric(12,4) check (cost_price is null or cost_price >= 0),
  diet text not null default 'veg' check (diet in ('veg','egg','nonveg')),
  tags text[] not null default '{}',
  image_id uuid references images(id) on delete set null,
  art_kind text not null default 'coffee',
  tint text[] not null default '{}',
  visual text not null default 'art' check (visual in ('art','bowl','glass')),
  status text not null default 'available' check (status in ('available','sold_out','hidden')),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_items_category_idx on menu_items (category_id, sort);

create table item_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references menu_items(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  cost_price numeric(12,4),
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort integer not null default 0
);
create index item_variants_item_idx on item_variants (item_id);

create table modifier_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  selection text not null check (selection in ('single','multi')),
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer check (max_select is null or max_select >= 1),
  sort integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table modifiers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references modifier_groups(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  cost_price numeric(12,4),
  visual_key text,
  sort integer not null default 0,
  is_active boolean not null default true
);
create index modifiers_group_idx on modifiers (group_id, sort);

create table item_modifier_groups (
  item_id uuid not null references menu_items(id) on delete cascade,
  group_id uuid not null references modifier_groups(id) on delete cascade,
  sort integer not null default 0,
  primary key (item_id, group_id)
);

-- modifiers included in an item's recipe ("Included" in the customiser, never priced)
create table item_default_modifiers (
  item_id uuid not null references menu_items(id) on delete cascade,
  modifier_id uuid not null references modifiers(id) on delete cascade,
  primary key (item_id, modifier_id)
);

-- ── Inventory ──────────────────────────────────────────────────────────────
create table inventory_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort integer not null default 0
);
create unique index inventory_categories_name_key on inventory_categories (lower(name));

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  gstin text not null default '',
  address text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index suppliers_name_key on suppliers (lower(name));

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  category_id uuid references inventory_categories(id) on delete set null,
  base_unit text not null check (base_unit in ('g','ml','pcs','packet')),
  display_unit text not null,
  stock_qty numeric(14,3) not null default 0,
  min_qty numeric(14,3) not null default 0 check (min_qty >= 0),
  avg_cost numeric(14,6),                       -- per base unit, weighted average
  track_expiry boolean not null default false,
  is_sellable boolean not null default false,   -- sold directly (retail / wholesale)
  sell_unit_name text not null default '',
  sell_unit_qty numeric(14,3) check (sell_unit_qty is null or sell_unit_qty > 0), -- base units per selling unit
  retail_price numeric(10,2) check (retail_price is null or retail_price >= 0),
  wholesale_price numeric(10,2) check (wholesale_price is null or wholesale_price >= 0),
  default_supplier_id uuid references suppliers(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index inventory_items_name_key on inventory_items (lower(name)) where is_active;
create unique index inventory_items_sku_key on inventory_items (lower(sku)) where sku is not null and sku <> '';

create table purchases (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1) unique,
  supplier_id uuid references suppliers(id) on delete set null,
  invoice_no text not null default '',
  purchased_on date not null,
  status text not null default 'received' check (status in ('received','cancelled')),
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  payment_status text not null default 'paid' check (payment_status in ('paid','partial','unpaid')),
  notes text not null default '',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index purchases_date_idx on purchases (purchased_on desc);

create table purchase_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  item_id uuid not null references inventory_items(id),
  qty numeric(14,3) not null check (qty > 0),
  unit_cost numeric(14,6) not null check (unit_cost >= 0),
  line_total numeric(12,2) not null,
  expiry_date date
);

create table inventory_batches (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  purchase_line_id uuid references purchase_lines(id) on delete set null,
  qty_received numeric(14,3) not null,
  qty_remaining numeric(14,3) not null,
  unit_cost numeric(14,6),
  expiry_date date,
  received_at timestamptz not null default now()
);
create index inventory_batches_item_idx on inventory_batches (item_id, expiry_date);

create table recipe_lines (
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  qty numeric(14,3) not null check (qty > 0),
  primary key (menu_item_id, inventory_item_id)
);

create table modifier_recipe_lines (
  modifier_id uuid not null references modifiers(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  qty numeric(14,3) not null check (qty > 0),
  primary key (modifier_id, inventory_item_id)
);

-- ── Customers & loyalty ────────────────────────────────────────────────────
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  dob date,
  phone_verified_at timestamptz,
  email_verified_at timestamptz,
  marketing_consent boolean not null default false,
  consent_at timestamptz,
  points_balance integer not null default 0,
  lifetime_points integer not null default 0,
  total_spent numeric(12,2) not null default 0,
  visits integer not null default 0,
  last_order_at timestamptz,
  notes text not null default '',
  is_active boolean not null default true,
  unsubscribe_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_phone_key on customers (phone) where phone is not null;
create unique index customers_email_key on customers (lower(email)) where email is not null;

create table customer_sessions (
  id text primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table otp_challenges (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('sms','email')),
  destination text not null,
  purpose text not null check (purpose in ('register','login')),
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  provider text not null,
  ip text,
  created_at timestamptz not null default now()
);
create index otp_challenges_dest_idx on otp_challenges (destination, created_at desc);

create table rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  points_cost integer not null check (points_cost > 0),
  kind text not null check (kind in ('free_item','discount_amount','discount_percent','gift')),
  menu_item_id uuid references menu_items(id) on delete set null,
  value numeric(10,2),
  min_order numeric(10,2) not null default 0,
  valid_from date,
  valid_to date,
  quantity_total integer check (quantity_total is null or quantity_total >= 0),
  quantity_redeemed integer not null default 0,
  redemption_valid_days integer not null default 30 check (redemption_valid_days between 1 and 365),
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  reward_id uuid not null references rewards(id),
  customer_id uuid not null references customers(id),
  points integer not null,
  status text not null default 'issued' check (status in ('issued','used','expired','cancelled')),
  order_id uuid,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index redemptions_customer_idx on redemptions (customer_id, created_at desc);

-- ── Orders ─────────────────────────────────────────────────────────────────
create table orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001) unique,
  type text not null check (type in ('dine_in','takeaway')),
  channel text not null check (channel in ('qr','web','pos')),
  price_tier text not null default 'retail' check (price_tier in ('retail','wholesale')),
  table_id uuid references dining_tables(id),
  customer_id uuid references customers(id),
  customer_name text not null default '',
  customer_phone text not null default '',
  status text not null default 'new'
    check (status in ('new','accepted','preparing','ready','served','completed','cancelled','rejected')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid','refunded')),
  subtotal numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  service_charge numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null check (total >= 0),
  amount_paid numeric(12,2) not null default 0,
  points_used integer not null default 0,
  redemption_id uuid references redemptions(id),
  notes text not null default '',
  idempotency_key text not null unique,
  access_hash text,
  stock_deducted boolean not null default false,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  constraint orders_table_for_dine_in check (type <> 'dine_in' or table_id is not null or channel = 'pos'),
  constraint orders_completed_requires_paid check (status <> 'completed' or payment_status in ('paid','refunded'))
);
create index orders_created_idx on orders (created_at desc);
create index orders_open_idx on orders (status) where status in ('new','accepted','preparing','ready','served');
create index orders_table_idx on orders (table_id) where status in ('new','accepted','preparing','ready','served');
create index orders_customer_idx on orders (customer_id, created_at desc);
create index orders_updated_idx on orders (updated_at);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  variant_id uuid references item_variants(id) on delete set null,
  name text not null,
  variant_name text not null default '',
  modifiers jsonb not null default '[]'::jsonb,
  qty integer not null check (qty between 1 and 999),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null,
  unit_cost numeric(14,4),
  notes text not null default '',
  constraint order_items_kind check (not (menu_item_id is not null and inventory_item_id is not null))
);
create index order_items_order_idx on order_items (order_id);

create table order_events (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  status text not null,
  note text not null default '',
  user_id uuid references users(id) on delete set null,
  at timestamptz not null default now()
);
create index order_events_order_idx on order_events (order_id, at);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  kind text not null default 'payment' check (kind in ('payment','refund')),
  method text not null check (method in ('cash','upi','card','other')),
  amount numeric(12,2) not null check (amount > 0),
  reference text not null default '',
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index payments_order_idx on payments (order_id);
create index payments_created_idx on payments (created_at desc);

alter table redemptions add constraint redemptions_order_fk foreign key (order_id) references orders(id);

create table point_transactions (
  id bigserial primary key,
  customer_id uuid not null references customers(id),
  kind text not null check (kind in ('earn','promo','adjust','redeem','expire','reverse','restore')),
  points integer not null,
  remaining integer not null default 0,         -- unspent part of a positive lot (FIFO)
  order_id uuid references orders(id),
  redemption_id uuid references redemptions(id),
  expires_at timestamptz,
  note text not null default '',
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index point_transactions_customer_idx on point_transactions (customer_id, created_at desc);
-- one earn per order, ever: duplicate allocation is impossible
create unique index point_transactions_earn_once on point_transactions (order_id) where kind = 'earn';
create index point_transactions_lots_idx on point_transactions (customer_id, expires_at) where remaining > 0;

-- ── Stock movements (after orders/purchases exist) ─────────────────────────
create table stock_movements (
  id bigserial primary key,
  item_id uuid not null references inventory_items(id),
  kind text not null check (kind in ('opening','purchase','sale','sale_return','wastage','adjustment','count','purchase_cancel')),
  qty numeric(14,3) not null,                  -- signed, base units
  unit_cost numeric(14,6),
  value numeric(14,2),                         -- signed qty × unit cost
  order_id uuid references orders(id),
  purchase_id uuid references purchases(id),
  reason text not null default '',
  note text not null default '',
  user_id uuid references users(id),
  created_at timestamptz not null default now()
);
create index stock_movements_item_idx on stock_movements (item_id, created_at desc);
create index stock_movements_created_idx on stock_movements (created_at desc);
create index stock_movements_order_idx on stock_movements (order_id);

-- ── Finance ────────────────────────────────────────────────────────────────
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  sort integer not null default 0
);
create unique index expense_categories_name_key on expense_categories (lower(name));

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references expense_categories(id),
  amount numeric(12,2) not null check (amount > 0),
  spent_on date not null,
  vendor text not null default '',
  payment_method text not null default 'cash' check (payment_method in ('cash','upi','card','bank','other')),
  notes text not null default '',
  is_void boolean not null default false,
  void_reason text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index expenses_date_idx on expenses (spent_on desc);

-- ── Notifications ──────────────────────────────────────────────────────────
create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('email','sms','whatsapp')),
  kind text not null default 'custom' check (kind in ('birthday','promotion','transactional','custom')),
  subject text not null default '',
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id uuid not null references notification_templates(id),
  audience jsonb not null default '{"segment":"all"}'::jsonb,
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','failed','cancelled')),
  stats jsonb not null default '{}'::jsonb,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table notifications (
  id bigserial primary key,
  campaign_id uuid references campaigns(id) on delete set null,
  template_id uuid references notification_templates(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  kind text not null default 'custom',
  channel text not null,
  destination text not null,
  subject text not null default '',
  body text not null,
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed','skipped')),
  provider text not null default '',
  provider_message_id text,
  error text,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz
);
create index notifications_created_idx on notifications (created_at desc);
create index notifications_provider_idx on notifications (provider_message_id);
`;
