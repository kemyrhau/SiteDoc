import { test, expect, type Page, type CDPSession } from "@playwright/test";
import { lagAnnoteringsHtml } from "../../../packages/shared/src/annotering/annoterings-html";

/**
 * RETUR velg-alle (Kenneth på telefon, test-OTA `ed22365d`, 2026-10-28): et trykk på kanten av en
 * sirkel tegnet en NY sirkel, og bare tekst kunne flyttes.
 *
 * Målt med ekte touch (CDP `Input.dispatchTouchEvent`) i iPhone 13-skalering (390 × 664, DPR 3):
 * hendelsene fyrer og pekeren er 1:1 i CSS-px — skaleringen er ikke årsaken. Årsaken er at
 * trykk-vs-dra-terskelen (10 px største avstand) er musens terskel: en fingertupp som vingler
 * ≥ 10 px i løpet av trykket ble et DRA → ny sirkel i stedet for valg. Tekst slapp unna fordi
 * tekst-trykket måler start→slipp (mindre enn toppavstanden) og treffer på rammeboksen.
 *
 * Rød på `6afa50d8`: vingle 10–20 px tegner ny form. Grønn etter fiksen (touch-terskel 22 px).
 */

const PATCH = `;(function(){var o=fabric.Canvas.prototype.initialize;fabric.Canvas.prototype.initialize=function(){var r=o.apply(this,arguments);window.__c=this;return r;};})();`;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __c: any;
  }
}

let cdp: CDPSession;

async function åpne(page: Page) {
  await page.route("**/fabric.min.js", async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: (await r.text()) + PATCH });
  });
  await page.setContent(lagAnnoteringsHtml({ anker: "topp" }));
  await page.waitForFunction(() => !!window.__c);
  const bilde = await page.evaluate(() => {
    const k = document.createElement("canvas");
    k.width = 1200;
    k.height = 1600;
    const g = k.getContext("2d")!;
    g.fillStyle = "#888";
    g.fillRect(0, 0, 1200, 1600);
    return k.toDataURL();
  });
  await page.evaluate((b) => window.postMessage(JSON.stringify({ type: "settBilde", bildeUrl: b, lag: null }), "*"), bilde);
  await page.waitForFunction(() => !!window.__c.backgroundImage);
  cdp = await page.context().newCDPSession(page);
}

const touch = (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) =>
  cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" ? [] : [{ x, y, radiusX: 10, radiusY: 10, force: 1 }],
  });

async function dra(page: Page, x1: number, y1: number, x2: number, y2: number) {
  await touch("touchStart", x1, y1);
  for (let i = 1; i <= 8; i++) await touch("touchMove", x1 + ((x2 - x1) * i) / 8, y1 + ((y2 - y1) * i) / 8);
  await touch("touchEnd");
  await page.waitForTimeout(60);
}

/** Et fingertrykk som vingler `v` px ut (toppavstand) og slippes `v/2` fra start. */
async function vingleTrykk(page: Page, x: number, y: number, v: number) {
  await touch("touchStart", x, y);
  if (v > 0) {
    await touch("touchMove", x + v * 0.6, y + v * 0.8);
    await touch("touchMove", x + v * 0.3, y + v * 0.4);
  }
  await touch("touchEnd");
  await page.waitForTimeout(60);
}

const verktoy = async (page: Page, v: string) => {
  await page.evaluate((v) => window.postMessage(JSON.stringify({ type: "velgVerktoy", verktoy: v }), "*"), v);
  await page.waitForTimeout(50);
};

const tilstand = (page: Page) =>
  page.evaluate(() => {
    const os = window.__c.getObjects();
    return { antall: os.length as number, aktivErForm0: window.__c.getActiveObject() === os[0] };
  });

/** Øverste punkt på formens strek, litt til venstre for midten (unngår mt-håndtaket). */
const kantpunkt = (page: Page) =>
  page.evaluate(() => {
    const o = window.__c.getObjects()[0];
    const b = o.getBoundingRect(true, true);
    return { x: b.left + b.width / 2, y: b.top + 2 };
  });

for (const [verktøyId, navn] of [
  ["circle", "sirkel"],
  ["rect", "firkant"],
] as const) {
  test.describe(`${navn}: trykk på kanten med finger (touch, iPhone-skalering)`, () => {
    for (const vingle of [0, 6, 12, 18]) {
      test(`vingle ${vingle} px → formen velges, ingen ny form`, async ({ page }) => {
        await åpne(page);
        await verktoy(page, verktøyId);
        await dra(page, 100, 200, 180, 260);
        expect((await tilstand(page)).antall).toBe(1);
        const k = await kantpunkt(page);
        await vingleTrykk(page, k.x, k.y, vingle);
        expect(await tilstand(page)).toEqual({ antall: 1, aktivErForm0: true });
      });
    }
  });
}

test("valgt sirkel flyttes med finger-dra fra streken", async ({ page }) => {
  await åpne(page);
  await verktoy(page, "circle");
  await dra(page, 100, 200, 180, 260);
  // Venstre kant av sirkelen (ikke et håndtak midt på en side): x = venstre, y = 30 px ned.
  const p = await page.evaluate(() => {
    const b = window.__c.getObjects()[0].getBoundingRect(true, true);
    return { x: b.left + 4, y: b.top + b.height / 2 - 30 };
  });
  await vingleTrykk(page, p.x, p.y, 12);
  expect((await tilstand(page)).aktivErForm0).toBe(true);
  const før = await page.evaluate(() => window.__c.getObjects()[0].getCenterPoint());
  await dra(page, p.x, p.y, p.x + 40, p.y + 30);
  const etter = await page.evaluate(() => window.__c.getObjects()[0].getCenterPoint());
  expect((await tilstand(page)).antall).toBe(1);
  expect(etter.x - før.x).toBeCloseTo(40, 0);
  expect(etter.y - før.y).toBeCloseTo(30, 0);
});

test("vinglete trykk på tomt område tegner ingen mini-form (fjerner valget)", async ({ page }) => {
  await åpne(page);
  await verktoy(page, "circle");
  await dra(page, 100, 200, 180, 260);
  await vingleTrykk(page, 300, 450, 12);
  expect((await tilstand(page)).antall).toBe(1);
});

test("et ekte dra (40 px) med finger tegner fortsatt ny sirkel — også fra en annen forms strek", async ({ page }) => {
  await åpne(page);
  await verktoy(page, "circle");
  await dra(page, 100, 200, 180, 260);
  const k = await kantpunkt(page);
  await dra(page, k.x, k.y, k.x + 40, k.y + 40);
  expect((await tilstand(page)).antall).toBe(2);
});

test("pil: vinglete fingertrykk på streken velger pila", async ({ page }) => {
  await åpne(page);
  await verktoy(page, "arrow");
  await dra(page, 100, 200, 220, 260);
  await vingleTrykk(page, 160, 230, 12);
  expect(await tilstand(page)).toEqual({ antall: 1, aktivErForm0: true });
});

test("frihånd: vinglete fingertrykk på en sirkels kant velger den og etterlater ingen strek", async ({ page }) => {
  await åpne(page);
  await verktoy(page, "circle");
  await dra(page, 100, 200, 180, 260);
  const k = await kantpunkt(page);
  await verktoy(page, "draw");
  await vingleTrykk(page, k.x, k.y, 12);
  expect(await tilstand(page)).toEqual({ antall: 1, aktivErForm0: true });
});
