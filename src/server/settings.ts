import "server-only";
import { q, type Queryable } from "./db";
import { DEFAULT_SETTINGS } from "./db/seed";

export interface BusinessSettings {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  timezone: string;
}
export interface TaxSettings {
  gst_percent: number;
  service_charge_percent: number;
}
export interface OrderingSettings {
  accepting_orders: boolean;
  takeaway_enabled: boolean;
  closed_message: string;
  /** guests may order takeaway for a pickup time later today */
  preorders_enabled: boolean;
  /** show "ready in about N min" before ordering */
  show_wait_time: boolean;
}
export interface PaymentSettings {
  cash_enabled: boolean;
  upi_enabled: boolean;
  upi_id: string;
  upi_payee_name: string;
}
export interface KitchenSettings {
  /** secret-link kitchen screen (no login) */
  link_enabled: boolean;
  link_token: string;
}
export interface LoyaltySettings {
  enabled: boolean;
  points_per_100: number;
  min_order_amount: number;
  point_value: number;
  min_redeem_points: number;
  max_redeem_percent: number;
  expiry_months: number;
  welcome_bonus: number;
  promo_multiplier: number;
  promo_from: string | null;
  promo_to: string | null;
}
export interface NotificationSettings {
  birthday_enabled: boolean;
  birthday_template_ids: string[];
  send_hour: number;
}

export interface SettingsMap {
  business: BusinessSettings;
  tax: TaxSettings;
  ordering: OrderingSettings;
  loyalty: LoyaltySettings;
  notifications: NotificationSettings;
  payments: PaymentSettings;
  kitchen: KitchenSettings;
}

export type SettingKey = keyof SettingsMap;

/** Reads a settings document merged over defaults (so new fields always exist). */
export async function getSetting<K extends SettingKey>(key: K, db: Queryable | null = null): Promise<SettingsMap[K]> {
  const run = db ? db.query.bind(db) : q;
  const { rows } = await run<{ value: SettingsMap[K] }>("select value from settings where key = $1", [key]);
  return { ...(DEFAULT_SETTINGS[key] as SettingsMap[K]), ...(rows[0]?.value ?? {}) };
}

export async function setSetting<K extends SettingKey>(db: Queryable, key: K, value: SettingsMap[K]) {
  await db.query(
    `insert into settings (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}
