import { test, expect, type Page } from "@playwright/test";
import { lagAnnoteringsHtml } from "../../../packages/shared/src/annotering/annoterings-html";

/**
 * RETUR svart gjenåpning (Kenneth på telefon, test-OTA a34c1f3d, 2026-10-28): et lagret annotert
 * bilde åpnet seg som et helt svart lerret. Gjenåpningen sendte et 401-svar (`{"error":…}`) som
 * `data:image/jpeg` til WebView-en; Fabric fikk aldri et bilde og HTML-en sa ingenting.
 *
 * Her kjøres den ekte mobil-HTML-en med RN-broen simulert (`window.ReactNativeWebView`), slik at vi
 * ser nøyaktig hva appen får tilbake. Rød på develop a34c1f3d: ingen melding ved feil (svart, stille).
 */

// RN-broen simulert FØR HTML-ens eget skript kjører (stubben står først i <head>).
const BRO_STUB = `<script>window.__meldinger = []; window.ReactNativeWebView = { postMessage: function (m) { window.__meldinger.push(m); } };</script>`;

async function åpne(page: Page) {
  const html = lagAnnoteringsHtml({ anker: "topp" }).replace("<head>", `<head>${BRO_STUB}`);
  await page.route("http://annotering.local/", (r) => r.fulfill({ contentType: "text/html", body: html }));
  await page.goto("http://annotering.local/");
  await page.waitForFunction(() => (window as unknown as { __meldinger: string[] }).__meldinger.some((m) => m.includes('"klar"')));
}

const meldingstyper = (page: Page) =>
  page.evaluate(() => (window as unknown as { __meldinger: string[] }).__meldinger.map((m) => JSON.parse(m).type as string));

const send = (page: Page, bildeUrl: string, lag: unknown = null) =>
  page.evaluate(([b, l]) => window.postMessage(JSON.stringify({ type: "settBilde", bildeUrl: b, lag: l }), "*"), [bildeUrl, lag] as const);

const gyldigJpeg = (page: Page) =>
  page.evaluate(() => {
    const k = document.createElement("canvas");
    k.width = 800;
    k.height = 600;
    const g = k.getContext("2d")!;
    g.fillStyle = "#4a7";
    g.fillRect(0, 0, 800, 600);
    return k.toDataURL("image/jpeg", 0.8);
  });

test("401-svar sendt som bilde → HTML melder bildeFeil (ikke stille svart lerret)", async ({ page }) => {
  await åpne(page);
  const feilsvar = Buffer.from('{"error":"Ugyldig eller utløpt fil-signatur"}').toString("base64");
  await send(page, `data:image/jpeg;base64,${feilsvar}`);
  await expect.poll(() => meldingstyper(page), { timeout: 3000 }).toContain("bildeFeil");
  expect(await meldingstyper(page)).not.toContain("bildeLastet");
});

test("gyldig bilde → bildeLastet, og lerretet har bildets sideforhold", async ({ page }) => {
  await åpne(page);
  await send(page, await gyldigJpeg(page));
  await expect.poll(() => meldingstyper(page), { timeout: 3000 }).toContain("bildeLastet");
  const mål = await page.evaluate(() => {
    const c = document.getElementById("c") as HTMLCanvasElement;
    return { w: parseFloat(c.style.width), h: parseFloat(c.style.height) };
  });
  expect(mål.w / mål.h).toBeCloseTo(800 / 600, 2);
});

test("gjenåpning med lagret lag → bildeLastet etter at objektene er lagt på", async ({ page }) => {
  await åpne(page);
  const lag = {
    fabricVersion: "5.3.1",
    bredde: 390,
    hoyde: 292,
    objekter: [{ type: "rect", left: 10, top: 10, width: 50, height: 40, fill: "transparent", stroke: "#ef4444", strokeWidth: 3 }],
  };
  await send(page, await gyldigJpeg(page), lag);
  await expect.poll(() => meldingstyper(page), { timeout: 3000 }).toContain("bildeLastet");
});
