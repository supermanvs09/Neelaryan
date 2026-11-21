# NEELARYAN Café — restaurant platform

*Crave the goodness.* One web app for the whole café:

* **Customers** order from their phone. They scan the table QR code or choose takeaway, build bowls and shakes, track the order live, and join rewards with their mobile number.
* **Staff** use the console at `/admin`, which covers orders, the counter (POS), kitchen, tables & QR codes, menu, inventory, purchases, finance & P&L, reports, customers, loyalty, campaigns, staff & permissions, the audit log and settings.

Next.js 15 (App Router; route handlers are the backend) · TypeScript · PostgreSQL · Tailwind · Zod.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # optional for local dev
npm run dev                    # http://localhost:3000
```

**Database setup:**

* **No `DATABASE_URL`:** development uses an embedded Postgres (PGlite) in `.data/pglite`. Delete that folder to start fresh.
* **With a `DATABASE_URL`:** the app uses that Postgres.

Either way, migrations and the seed (menu, tables 01–16, roles, message templates, first admin) run automatically on first start.

**First sign-in:**

1. Open `/login` and sign in with `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD` (default `admin` / `welcome@2026`).
2. You must choose a new password before anything else works.
3. Create the rest of the staff under **Staff & permissions**. Each new account gets a one-time password that they must change.

```bash
npm test            # integration tests (PGlite in memory, or TEST_DATABASE_URL=postgres://… for real Postgres)
npm run typecheck
npm run lint
npm run build && npm start
```

## Environment variables

Every variable is documented in [`.env.example`](.env.example).

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | **Required in production.** Postgres connection string. |
| `NEXT_PUBLIC_SITE_URL` | Public site address. QR codes and unsubscribe links use it, so set it before printing QR codes. |
| `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD` | First Super Admin, created once. A password change is forced on first sign-in. |
| `CRON_SECRET` | Enables `/api/cron`, which runs due campaigns, birthday messages, points expiry and the send queue. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` or `TWILIO_MESSAGING_SERVICE_SID` | SMS: sign-in codes, offers, birthday wishes. |
| `TWILIO_WHATSAPP_FROM` | WhatsApp campaigns. Needs Meta-approved templates. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email campaigns and birthday emails. |
| `DEFAULT_COUNTRY_CODE` | Prefix for 10-digit mobiles (default `+91`). |
| `TWILIO_STATUS_CALLBACK=off` | Skip delivery-status callbacks. They need a public https URL. |
| `PGLITE_DIR`, `ALLOW_EMBEDDED_DB` | Local / embedded database only. |

### What happens when a provider isn't configured

Nothing pretends to work:

* **In production**, an unconfigured channel is refused outright:
  * Sign-in codes return a clear "SMS isn't set up" error.
  * Campaigns on that channel can't be sent.
  * The console shows each channel as **Not set up**.
* **In development**, messages are written to the server log and the sign-in screen shows the code with a "Development mode" notice. This path doesn't exist in production. Such messages are recorded as **Not sent (test mode)**, never as sent.
* A message is marked **sent** only when the provider accepted it.
* It's marked **delivered** only when Twilio's signed status webhook (`/api/webhooks/twilio`) confirms delivery.

Configure Twilio's status callback URL as `https://<your-site>/api/webhooks/twilio`. Requests are verified with `TWILIO_AUTH_TOKEN`.

### Scheduler

`vercel.json` calls `/api/cron` every 15 minutes. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set. Elsewhere, call it from any scheduler:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-site>/api/cron
```

Staff can also press **Run jobs now** under Notifications.

## Roles & permissions

Permissions are checked by the server on every API route and page. Hiding a menu item is never the security boundary. Route-level tests in `tests/server/permissions.test.ts` prove it.

| Role | Can do |
|---|---|
| Super Admin | Everything, including staff accounts, role permissions and business settings. There's always at least one active Super Admin. |
| Manager | Everything except staff and business settings. Managers can pause online ordering. |
| Staff | Orders, counter, billing, tables, kitchen, menu (view) and customers (view). |
| Kitchen Staff | Kitchen workspace only. They can move orders forward: accept → preparing → ready. |

* Role permissions are editable and apply on the next request.
* Deactivating someone or changing their role signs them out immediately.
* Accounts lock for 15 minutes after 5 failed sign-ins.

## How the main flows work

**QR ordering**

* Each table has a random QR token (`/t/<token>`). Staff can download it (PNG/SVG), print a sheet of all codes (`/admin/tables/print`), or regenerate it, which retires the old printed code immediately.
* Dine-in orders are only possible through a table's code, so they always reach the right table.

**Placing an order**

* The server prices every line from the database. The browser sends `expected_total`. If prices changed meanwhile, the order is refused with the new total, so nobody pays a surprise amount.
* An idempotency key means a double-tap or retry never creates two orders.
* The device keeps an access token for tracking. Only its hash is stored.
* Customers can cancel until the café confirms.

**Order life cycle:** new → accepted → preparing → ready → served (dine-in) → completed.

* Completion requires full payment.
* "Settle table" collects every open bill on a table and releases it.
* Refunds need the refund permission and a reason.

**Stock**

* Ingredients are deducted when an order is **accepted**, using each dish's recipe and the recipes of chosen add-ons. They're returned if the order is cancelled.
* Packaged products sold directly (retail/wholesale) can't be oversold. Low ingredient stock never blocks a sale.
* Purchases update a weighted average cost, and expiry is tracked per batch (first-expiring used first).
* Each sold line keeps the unit cost at the time of sale.

**Profit & loss**

* **Revenue:** completed orders, before GST, split retail / wholesale.
* Refunds are deducted on the day they happen.
* **COGS:** the cost snapshots on sold lines.
* Then wastage, stock-count differences and expenses.
* Purchases reach profit only through COGS and wastage.
* The P&L warns when sold items have no cost (no recipe and no cost price), because profit would be overstated.

**Loyalty**

* Points are earned only on completed, **paid** orders, once per order (enforced by a unique index).
* Points are returned if an order is cancelled and taken back if a completed order is refunded.
* Points are spent oldest-first and expire per lot.
* Rewards issue single-use codes (`NR-XXXXXX`).
* Every rule (earn rate, minimum bill, point value, redemption limits, expiry, welcome bonus, bonus-points promotions) is set under **Loyalty & rewards**.

**Customer sign-in**

* One-time codes are 6 digits, stored hashed, valid for 10 minutes and single-use.
* Each code allows 5 guesses.
* Requests are limited to 3 codes per number per 10 minutes and 10 per IP per hour.
* After ordering, guests can join in one step, and the order they just placed is linked to the new account.

**Campaigns**

* Campaigns and birthday messages go only to customers who opted in.
* Each campaign goes to a customer at most once, and each birthday message at most once a year.
* Every promotional message carries a one-click unsubscribe link (`/unsubscribe/<token>`).

**Audit log:** every change to money, stock, menu, customers, staff and settings is recorded with who, when and what changed. The table rejects edits and deletes at the database level.

## Project layout

```
src/app/(shop)/            customer pages: home, menu, build/[slug], checkout, orders, rewards, account, t/[token]
src/app/admin/             staff console pages
src/app/api/public/        customer APIs (menu, orders, quote, OTP sign-in, account, rewards, unsubscribe)
src/app/api/admin/         console APIs (each declares its permission)
src/app/api/cron, webhooks scheduler and Twilio status callback
src/server/                business logic: orders, inventory, loyalty, finance, messaging, auth, db (+ migrations, seed)
src/lib/pricing.ts         shared pricing rules (browser shows the same prices the server charges)
src/components/shop/       customer UI     src/components/admin/   console UI
tests/server/              integration tests (engine, finance, customers & notifications, permissions)
```

Database migrations live in `src/server/db/migrations`. Never edit one that's been applied; add a new one.

## Design

The palette is Champagne `#DBC7AC`, Ivory `#F4EEE2`, French Blue `#7A94AC`, Gold `#B58A45` and Navy `#23324C`, applied as CSS variables with light and dark themes (`src/app/globals.css`).

* The theme follows the device or the person's choice, and the choice is saved.
* Interactive blue is a deeper French Blue, for text contrast.
* Chart colours are checked for colour-blind separation in both themes.

The bowl and shake builders draw the dish from the ingredients actually chosen, using layered cut-out sprites and CSS. They don't use WebGL at runtime.

### Re-rendering imagery

To regenerate the bowl and ingredient sprites:

1. Run `npm run dev`.
2. Run `scripts/sprites/render.js`. It uses headless Chromium against the dev-only `/dev/sprites` page, which renders the three.js scenes in `src/three/`.
3. Run `python3 scripts/sprites/process_sprites.py <renders> .`

Real product photos can also be uploaded per item in **Menu** and replace the illustration.

## Before going live — checklist

- [ ] `DATABASE_URL` points at a managed Postgres with backups.
- [ ] `NEXT_PUBLIC_SITE_URL` is set, **then** print the table QR codes.
- [ ] Sign in as admin, change the password, and create staff accounts.
- [ ] Business details, GSTIN, GST rate and service charge are filled in under **Settings**.
- [ ] Twilio (SMS) is configured, otherwise customers can't sign in with a code. Optionally configure WhatsApp and Resend email.
- [ ] `CRON_SECRET` is set and the scheduler is running.
- [ ] Recipes are added for dishes (Menu → item → Recipe) so stock and profit are accurate.
- [ ] Builder add-on prices are confirmed with the owner. Honey ₹10, chocolate ₹15 and dry-fruit mix ₹20 came from mockups.
- [ ] The terms & privacy text at `/legal/terms` is replaced with the café's reviewed policy.
- [ ] Online payment is not built in: customers pay at the table or counter, and staff record payments. Adding a gateway (e.g. Razorpay) needs server-side order creation and signature verification.
