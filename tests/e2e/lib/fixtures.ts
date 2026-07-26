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
