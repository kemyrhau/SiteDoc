import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Prosjektkort L2 — firmaets timeføringsmodus caches i organization_setting_local
 * (samme cache som arbeidstid-defaults). Testes mot EKTE SQLite (sql.js) så
 * migreringen (ALTER timer_registreringsmodus) er med i testen.
 *
 *  - aldri hentet → dagskort (default)
 *  - hentet «prosjektkort» → prosjektkort
 *  - offline (henting feiler) → siste cachede verdi beholdes
 *  - ukjent/manglende serververdi (eldre server) → dagskort
 */

const holder = vi.hoisted(() => ({
  raw: null as unknown as {
    run: (sql: string, params?: unknown[]) => void;
    prepare: (sql: string) => {
      step(): boolean;
      getAsObject(): Record<string, unknown>;
      bind(p: unknown[]): void;
      free(): void;
    };
    getRowsModified(): number;
  },
  shim: null as unknown,
  drizzle: null as unknown,
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => holder.shim }));
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));

import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import {
  refreshOrganizationSettingKatalog,
  lesTimerModusLokalt,
} from "./organizationSettingKatalog";

const ORG = "org-1";

type Klient = Parameters<typeof refreshOrganizationSettingKatalog>[0];
function klientSom(svar: () => Promise<unknown>): Klient {
  return {
    organisasjon: { hentArbeidstidDefaults: { query: svar } },
  } as unknown as Klient;
}

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const initSqlJs = require("sql.js");
  const distDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({ locateFile: (f: string) => path.join(distDir, f) });
  const raw = new SQL.Database();
  holder.raw = raw;
  holder.shim = {
    execSync: (sql: string) => raw.run(sql),
    getAllSync: (sql: string, ...params: unknown[]) => {
      const stmt = raw.prepare(sql);
      if (params.length) stmt.bind(params.flat());
      const rader: Record<string, unknown>[] = [];
      while (stmt.step()) rader.push(stmt.getAsObject());
      stmt.free();
      return rader;
    },
    runSync: (sql: string, ...params: unknown[]) => {
      raw.run(sql, params.length ? (params.flat() as unknown[]) : undefined);
      return { changes: raw.getRowsModified(), lastInsertRowId: 0 };
    },
  };
  kjorMigreringer();
  holder.drizzle = drizzle(raw, { schema });
});

beforeEach(() => {
  holder.raw.run("DELETE FROM organization_setting_local;");
});

describe("lesTimerModusLokalt (prosjektkort L2)", () => {
  it("aldri hentet → dagskort", () => {
    expect(lesTimerModusLokalt(ORG)).toBe("dagskort");
  });

  it("hentet prosjektkort → prosjektkort", async () => {
    const r = await refreshOrganizationSettingKatalog(
      klientSom(async () => ({ timerRegistreringsmodus: "prosjektkort" })),
      ORG,
    );
    expect(r.ok).toBe(true);
    expect(lesTimerModusLokalt(ORG)).toBe("prosjektkort");
  });

  it("offline (henting feiler) → siste cachede verdi gjelder", async () => {
    await refreshOrganizationSettingKatalog(
      klientSom(async () => ({ timerRegistreringsmodus: "prosjektkort" })),
      ORG,
    );
    const r = await refreshOrganizationSettingKatalog(
      klientSom(async () => {
        throw new Error("nettverk");
      }),
      ORG,
    );
    expect(r.ok).toBe(false);
    expect(lesTimerModusLokalt(ORG)).toBe("prosjektkort");
  });

  it("serveren sender ikke feltet (eldre server) → dagskort", async () => {
    await refreshOrganizationSettingKatalog(klientSom(async () => ({})), ORG);
    expect(lesTimerModusLokalt(ORG)).toBe("dagskort");
  });

  it("modus er firma-isolert", async () => {
    await refreshOrganizationSettingKatalog(
      klientSom(async () => ({ timerRegistreringsmodus: "prosjektkort" })),
      ORG,
    );
    expect(lesTimerModusLokalt("org-2")).toBe("dagskort");
  });
});
