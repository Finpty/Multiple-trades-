import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
await p.goto("http://localhost:3000/kabura/zz-test-blocks?service=zz-test-service-two", { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(1500);
const vals = await p.$$eval('select[name="service"]', (els) => els.map((s) => s.value.length));
console.log("service select value lengths (expect 36):", vals);
await p.click('form[data-form-slug="zz-test-form"] button[type=submit]');
console.log("validation:", await p.$eval('form[data-form-slug="zz-test-form"] .site-field-error', (e) => e.textContent));
// before/after slider moves
await p.$eval('.site-ba-range', (r) => { r.value = "80"; r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); });
console.log("slider clip:", await p.$eval('.site-ba-after', (e) => e.style.clipPath));
// calculator posts (API may not exist yet) and shows graceful error
await p.fill('#calc-zz_area', '12');
await p.click('text=Calculate estimate');
await p.waitForTimeout(2500);
console.log("calc state:", (await p.$eval('[aria-live="polite"]', (e) => e.textContent)).slice(0, 120));
console.log("calc error alert:", await p.$('.site-alert--error') ? 'shown' : 'none');
console.log("errors:", errors.filter((e) => !/favicon|404|net::ERR|Failed to load resource/i.test(e)).slice(0, 5));
await b.close();
