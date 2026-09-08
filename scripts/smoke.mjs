// Logged-in smoke check: node scripts/smoke.mjs /super-admin/industries /admin ...
// Logs in as the seeded owner and reports HTTP status, <h1>, and error markers per URL.
import { chromium } from "@playwright/test";
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const urls = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`); });
await page.goto(`${base}/login`);
await page.fill('input[name="email"]', process.env.SEED_OWNER_EMAIL ?? "owner@tradeone.local");
await page.fill('input[name="password"]', process.env.SEED_OWNER_PASSWORD ?? "tradeone-owner");
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120000 }), page.click('button[type="submit"]')]);
console.log(`logged in → ${page.url()}`);
for (const u of urls) {
  errors.length = 0;
  const res = (await page.goto(`${base}${u}`, { waitUntil: "load", timeout: 120000 }).catch((e) => ({ status: () => `ERR ${e.message.slice(0, 80)}` }))) ?? { status: () => "nav" };
  const h1 = await page.locator("h1").first().textContent().catch(() => "");
  const body = await page.innerText("body").catch(() => "");
  const bad = /Application error|Unhandled Runtime Error|This page could not be found|Internal Server Error/.test(body ?? "");
  console.log(`${String(res.status()).padEnd(4)} ${u}  h1="${(h1 ?? "").trim().slice(0, 60)}" ${bad ? "❌ ERROR PAGE" : "ok"}${errors.length ? `  ${errors.slice(0, 2).join(" | ")}` : ""}`);
  if (process.env.SMOKE_SHOT) await page.screenshot({ path: `${process.env.SMOKE_SHOT}/${u.replace(/[^a-z0-9]+/gi, "_")}.png`, fullPage: true });
}
await browser.close();
