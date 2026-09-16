/**
 * Delte Playwright-fixtures: runtime-data (fra global-setup) + API-klienter
 * per rolle. storageState-stier eksporteres for `test.use({ storageState })`.
 */
import { test as base } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ApiKlient } from "./api";
import { AUTH_DIR, RUNTIME_FIL, type Runtime } from "./miljo";

export const authSti = {
  firma: resolve(AUTH_DIR, "firma.json"),
  arbeider: resolve(AUTH_DIR, "arbeider.json"),
  admin: resolve(AUTH_DIR, "admin.json"),
} as const;

function lesRuntime(): Runtime {
  return JSON.parse(readFileSync(RUNTIME_FIL, "utf8")) as Runtime;
}

interface Fixtures {
  rt: Runtime;
  apiFirma: ApiKlient;
  apiArbeider: ApiKlient;
}

export const test = base.extend<Fixtures>({
  rt: async ({}, bruk) => {
    await bruk(lesRuntime());
  },
  apiFirma: async ({ rt }, bruk) => {
    await bruk(new ApiKlient(rt.tokens.firma));
  },
  apiArbeider: async ({ rt }, bruk) => {
    await bruk(new ApiKlient(rt.tokens.arbeider));
  },
});

export const expect = test.expect;

/** URL til sjekkliste-detaljsiden. */
export function detaljUrl(rt: Runtime, id: string): string {
  return `/dashbord/${rt.projectId}/sjekklister/${id}`;
}

/** URL til sjekkliste-lista. */
export function listeUrl(rt: Runtime): string {
  return `/dashbord/${rt.projectId}/sjekklister`;
}

/**
 * Klikk en flyt-handling (`handling-<nyStatus>`) i DokumentHandlingsmeny.
 *
 * Robust mot to trekk i dagens UI som gjorde de gamle spec-ene røde (aldri validert
 * fordi e2e aldri kjørte i CI):
 *  1) Handlingen kan være PRIMÆR (synlig knapp) ELLER ligge i «Flere handlinger»-
 *     nedtrekket (`handling-split-nedtrekk`, skjult til åpnet) — vi åpner nedtrekket
 *     hvis handlingen ikke alt er synlig.
 *  2) Den sticky skjerm-headeren (z-10) dekker knappen etter Playwrights auto-scroll,
 *     så vi kaller `el.click()` direkte på DOM-noden (knappen er «visible/enabled/stable»
 *     — kun pointer-interception feiler). `force:true` ville truffet overlayet, ikke knappen.
 */
export async function klikkFlythandling(
  page: import("@playwright/test").Page,
  nyStatus: string,
): Promise<void> {
  const mål = () => page.locator(`[data-testid="handling-${nyStatus}"]:visible`).first();
  if (!(await mål().count())) {
    // Handlingen ligger i nedtrekket — åpne det først.
    await page.locator('[data-testid="handling-split-nedtrekk"]:visible').first().evaluate((el) => (el as HTMLElement).click());
    await mål().waitFor({ state: "visible", timeout: 5000 });
  }
  await mål().evaluate((el) => (el as HTMLElement).click());
}
