// Renders sprite cut-outs from the dev-only /dev/sprites page (needs `npm run dev` on :3100).
// usage: node scripts/sprites/render.js '[{"q":"mode=piece&id=kiwi&k=0&v=0","out":"/tmp/sprites/pieces/kiwi-0-0.png"}]'
// Output folders expected by process_sprites.py: <root>/bowl, <root>/pieces, <root>/props
const { chromium } = require('playwright');
(async () => {
  const jobs = JSON.parse(process.argv[2]);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const j of jobs) {
    const size = j.size ?? 512;
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto('http://localhost:3100/dev/sprites?' + j.q, { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForTimeout(j.wait ?? 2500);
    await page.locator('#stage').screenshot({ path: j.out, omitBackground: true, timeout: 120000 });
    console.log('ok', j.out);
    await page.close();
  }
  await browser.close();
})();
