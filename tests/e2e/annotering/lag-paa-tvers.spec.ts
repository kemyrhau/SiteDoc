import { test, expect, type Browser, type Page } from "@playwright/test";
import { lagAnnoteringsHtml } from "../../../packages/shared/src/annotering/annoterings-html";

/**
 * Redigerbar annotering på mobil (Kenneth 2026-10-28): et lag laget på mobil skal kunne åpnes på
 * web, og omvendt — samme datamodell (`AnnoteringsLag`), samme HTML, ulik flatestørrelse. Laget
 * lagres i display-piksler med `bredde`/`hoyde`, og må reskaleres til den andre flaten.
 *
 * Kjøres med den ekte delte HTML-en: mobil = anker «topp» i iPhone-skalering, web = standard
 * (senter) i en stor flate. Meldingene fanges med en simulert RN-bro (samme som gjenaapning.spec).
 */

const BRO_STUB = `<script>window.__meldinger = []; window.ReactNativeWebView = { postMessage: function (m) { window.__meldinger.push(m); } };</script>`;
const PATCH = `;(function(){var o=fabric.Canvas.prototype.initialize;fabric.Canvas.prototype.initialize=function(){var r=o.apply(this,arguments);window.__c=this;return r;};})();`;

interface Vindu {
  __meldinger: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __c: any;
}

type Flate = "mobil" | "web";

async function åpne(browser: Browser, flate: Flate): Promise<Page> {
  const kontekst =
    flate === "mobil"
      ? await browser.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, hasTouch: true })
      : await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await kontekst.newPage();
  const html = lagAnnoteringsHtml(flate === "mobil" ? { anker: "topp" } : {}).replace("<head>", `<head>${BRO_STUB}`);
  await page.route("**/fabric.min.js", async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: (await r.text()) + PATCH });
  });
  await page.route("http://annotering.local/", (r) => r.fulfill({ contentType: "text/html", body: html }));
  await page.goto("http://annotering.local/");
  await page.waitForFunction(() => !!(window as unknown as Vindu).__c);
  return page;
}

const send = (page: Page, melding: Record<string, unknown>) =>
  page.evaluate((m) => window.postMessage(JSON.stringify(m), "*"), melding);

const meldinger = (page: Page) =>
  page.evaluate(() => (window as unknown as Vindu).__meldinger.map((m) => JSON.parse(m) as Record<string, unknown>));

/** Samme originalfoto på begge flater (4:3). */
const original = (page: Page) =>
  page.evaluate(() => {
    const k = document.createElement("canvas");
    k.width = 1200;
    k.height = 900;
    const g = k.getContext("2d")!;
    g.fillStyle = "#888";
    g.fillRect(0, 0, 1200, 900);
    return k.toDataURL("image/jpeg", 0.8);
  });

async function lastOriginal(page: Page, lag: unknown) {
  await send(page, { type: "settBilde", bildeUrl: await original(page), lag });
  await expect.poll(async () => (await meldinger(page)).some((m) => m.type === "bildeLastet"), { timeout: 5000 }).toBe(true);
}

/** Tegn en sirkel ved et punkt gitt som andel av lerretet, og lagre. Returnerer laget. */
async function tegnOgLagre(page: Page, fx: number, fy: number) {
  await lastOriginal(page, null);
  await send(page, { type: "velgVerktoy", verktoy: "circle" });
  const boks = (await page.locator("#c").boundingBox())!;
  const x = boks.x + boks.width * fx;
  const y = boks.y + boks.height * fy;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + (boks.width * 0.15 * i) / 8, y + (boks.width * 0.15 * i) / 8);
  await page.mouse.up();
  expect(await page.evaluate(() => (window as unknown as Vindu).__c.getObjects().length)).toBe(1);
  await send(page, { type: "lagre" });
  await expect.poll(async () => (await meldinger(page)).find((m) => m.type === "ferdig"), { timeout: 5000 }).toBeTruthy();
  return (await meldinger(page)).find((m) => m.type === "ferdig")!.lag as { bredde: number; hoyde: number; objekter: unknown[] };
}

/** Objektets senter som andel av lerretet — uavhengig av flatestørrelsen. */
const relativtSenter = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as Vindu).__c;
    const p = c.getObjects()[0].getCenterPoint();
    return { x: p.x / c.getWidth(), y: p.y / c.getHeight(), type: c.getObjects()[0].type as string };
  });

/** Åpne laget på den andre flaten i Flytt, trykk på streken: objektet velges og kan flyttes. */
async function gjenåpneOgFlytt(page: Page, lag: unknown) {
  await lastOriginal(page, lag);
  await send(page, { type: "velgVerktoy", verktoy: "select" });
  const objekter = await page.evaluate(() => (window as unknown as Vindu).__c.getObjects().length);
  expect(objekter).toBe(1);
  const kant = await page.evaluate(() => {
    const c = (window as unknown as Vindu).__c;
    const b = c.getObjects()[0].getBoundingRect(true, true);
    const r = c.upperCanvasEl.getBoundingClientRect();
    return { x: r.left + b.left + 3, y: r.top + b.top + b.height / 2 };
  });
  const før = await page.evaluate(() => (window as unknown as Vindu).__c.getObjects()[0].getCenterPoint());
  await page.mouse.move(kant.x, kant.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(kant.x + (30 * i) / 8, kant.y + (20 * i) / 8);
  await page.mouse.up();
  const etter = await page.evaluate(() => (window as unknown as Vindu).__c.getObjects()[0].getCenterPoint());
  expect(await page.evaluate(() => (window as unknown as Vindu).__c.getObjects().length)).toBe(1);
  expect(etter.x - før.x).toBeCloseTo(30, 0);
  expect(etter.y - før.y).toBeCloseTo(20, 0);
}

for (const [fra, til] of [
  ["mobil", "web"],
  ["web", "mobil"],
] as const) {
  test(`lag laget på ${fra} åpnes på ${til}: samme objekt på samme sted, og det kan flyttes`, async ({ browser }) => {
    const a = await åpne(browser, fra);
    const lag = await tegnOgLagre(a, 0.3, 0.4);
    const iA = await relativtSenter(a);
    expect(lag.objekter).toHaveLength(1);

    const b = await åpne(browser, til);
    await lastOriginal(b, lag);
    const iB = await relativtSenter(b);
    expect(iB.type).toBe(iA.type);
    expect(iB.x).toBeCloseTo(iA.x, 2);
    expect(iB.y).toBeCloseTo(iA.y, 2);
    // Flyttet på en fersk side (ikke den som alt har laget lagt på).
    await gjenåpneOgFlytt(await åpne(browser, til), lag);
  });
}
