# NEELARYAN Café — customer app (web)

*Crave the goodness.* Next.js + TypeScript + Tailwind + Motion.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Routes: `/` (splash → choose Dine in / Order online → home), `/menu`, `/build/[item]` (bowl & shake builders),
`/checkout`, `/orders`, `/orders/[id]` (confirmation + live tracking), `/rewards`, `/profile`, `/legal/*`, `/staff` (kitchen display).
Table QR codes open `/?table=07`.

## The 3D look — HTML/CSS, no WebGL at runtime

* **Layered cut-outs.** The bowl, oats bed, front rim and every ingredient are transparent WebP sprites
  (`public/sprites`, ~300 KB total) rendered once from one shared virtual camera (`src/lib/spriteCamera.ts`).
  `BowlScene` projects each piece onto the oats with the same camera maths, so pieces sit in true perspective and
  fall *into* the bowl behind its front rim (CSS keyframes with container-query units — GPU-composited).
* **CSS 3D stages.** The hero is a `preserve-3d` scene with layers at different `translateZ` depths, pointer/scroll
  parallax and blur on near/far layers for depth of field. Cards tilt (`Tilt`), loyalty stamps flip like coins,
  ice cubes in shakes are real 6-face CSS cubes.
* **Milkshake glass** (`GlassScene`): SVG/CSS glass with highlights, condensation and gold rim; milk pours, swirls
  into the flavour colour, toppings drop on the foam.
* Respects `prefers-reduced-motion` everywhere.

### Re-rendering / replacing imagery
Real product photography can replace any sprite file 1:1. To regenerate the renders:
`npm run dev`, then `scripts/sprites/render.js` (headless Chromium against the dev-only `/dev/sprites` page, which
uses the three.js scenes in `src/three/`), then `python3 scripts/sprites/process_sprites.py <renders> .`.
Fruit props (apple, kiwi, lime, pomegranate, jug) are Poly Haven CC0 scans (`public/models/CREDITS.md`).

## Data & business rules

* `src/data/menu.ts` — every name & price transcribed from the supplied menu PDF.
* `src/data/builders.ts` — schema-driven builders. **Add-on prices come from the supplied mockups**
  (ice-cream scoop ₹30 from the menu); honey ₹10, chocolate ₹15 and dry-fruit mix ₹20 were not shown and are
  placeholders — confirm with the owner. Removing a recipe ingredient never lowers the menu price.
  Nutrition is shown as an estimate.
* `src/data/config.ts` — GST 5 %, demo coupons (`NEEL20`, `GOODNESS10`), tables 01–16, loyalty (10 stamps).
* Loyalty stamps are derived from orders: one per completed **and** paid order, max one per day.

## Demo-only parts (until the Supabase backend)

* Orders live in `localStorage` and sync between tabs. Open `/staff` in another tab to run the kitchen; with no
  KDS open, a simulator advances orders so tracking can be seen end-to-end.
* Payment is simulated (Razorpay order creation + signature verification must be server-side).
* Staff sign-in, admin dashboard, inventory, RLS and notifications are not built yet.
