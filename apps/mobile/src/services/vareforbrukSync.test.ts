import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * Prosjektkort L3 (2026-11-06) — vareforbruk ført fra kortet på mobil.
 *
 * EKTE SQLite (sql.js) + ekte migreringer, som `timerSync.test.ts`. tRPC-
 * klienten er en stubb med et server-lager som oppfører seg som
 * `vareforbruk.opprett` (idempotent på klient-id).
 *
 * Gate-krav (DoD):
 *  - idempotent synk: tapt svar + ny sending gir én linje på server;
 *  - `dagsseddelId` riktig etter sedel-synk (inkl. omnøkling ved dato_kollisjon);
 *  - linjen venter mens sedelen er pending; uten timerrad sendes den uten kobling;
 *  - permanent avvisning → `avvist` med feilmelding; nettfeil → forblir pending;
 *  - ingen dobbelttelling i sammenslåingen med server-svaret;
 *  - knappen skjult uten Varelager (katalog FORBIDDEN → tom prosjektliste).
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
  secure: new Map<string, string>(),
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => holder.shim }));
vi.mock("../db/database", () => ({
  erDatabaseTilgjengelig: () => true,
  hentDatabase: () => holder.drizzle,
}));
vi.mock("../lib/i18n", () => ({ default: { t: (k: string) => k } }));
vi.mock("./auth", () => ({
  lagreVerdi: async (k: string, v: string) => {
    holder.secure.set(k, v);
  },
  hentVerdi: async (k: string) => holder.secure.get(k) ?? null,
}));

import { drizzle } from "drizzle-orm/sql-js";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { kjorMigreringer } from "../db/migreringer";
import { syncTimer } from "./timerSync";
import {
  syncVareforbruk,
  lagreLokalVarelinje,
  hentLokaleVarelinjer,
  planleggVaresending,
  vareModalEtterLagre,
  hentLokaleVarelinjerForDag,
} from "./vareforbrukSync";
import {
  refreshVareKatalog,
  hentVarelagerProsjekterLokalt,
  hentVarerLokalt,
} from "./vareKatalog";
import { slaaSammenVarelinjer, visVareforbrukKnapp } from "@sitedoc/shared";

const { dagsseddelLocal, sheetTimerLocal, vareforbrukLocal } = schema;

type Db = ReturnType<typeof drizzle<typeof schema>>;
function db(): Db {
  return holder.drizzle as Db;
}

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const initSqlJs = require("sql.js");
  const distDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({ locateFile: (f: string) => path.join(distDir, f) });
  const raw = new SQL.Database();
  holder.raw = raw;
  holder.shim = {
    execSync: (sql: string) => {
      raw.run(sql);
    },
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
  holder.raw.run(
    "DELETE FROM dagsseddel_local; DELETE FROM sheet_timer_local; DELETE FROM vareforbruk_local; DELETE FROM vare_local;",
  );
  holder.secure.clear();
});

function seedSedel(id: string, syncStatus: "pending" | "synced" | "conflict" | "avvist") {
  db()
    .insert(dagsseddelLocal)
    .values({
      id,
      userId: "u1",
      organizationId: "o1",
      projectId: "p1",
      aktivitetId: "a1",
      dato: "2026-11-06",
      status: "draft",
      syncStatus,
      sistEndretLokalt: 1000,
      sistSynkronisert: 1000,
    })
    .run();
}

function seedTimerRad(id: string, sheetId: string, projectId: string | null = "p1") {
  db()
    .insert(sheetTimerLocal)
    .values({
      id,
      dagsseddelId: sheetId,
      projectId,
      lonnsartId: "l1",
      aktivitetId: "a1",
      timer: 4,
      sistEndretLokalt: 1000,
    })
    .run();
}

function nyLinje(id: string, sheetId: string, projectId = "p1") {
  lagreLokalVarelinje({
    id,
    userId: "u1",
    organizationId: "o1",
    sheetId,
    projectId,
    dato: "2026-11-06",
    vareId: "v1",
    vareNavn: "Grus",
    enhet: "m3",
    antall: 2.5,
    byggeplassId: null,
  });
}

function linje(id: string) {
  return db().select().from(vareforbrukLocal).where(eq(vareforbrukLocal.id, id)).all()[0]!;
}

/** Server-stubb som `vareforbruk.opprett`: idempotent på klient-id. */
function lagServer(opts: { feilFoersteSvar?: boolean; feil?: unknown } = {}) {
  const rader = new Map<string, Record<string, unknown>>();
  let kall = 0;
  const klient = {
    vareforbruk: {
      opprett: {
        mutate: async (input: Record<string, unknown>) => {
          kall++;
          if (opts.feil) throw opts.feil;
          if (!rader.has(input.id as string)) rader.set(input.id as string, input);
          // Svaret går tapt etter at serveren har skrevet raden.
          if (opts.feilFoersteSvar && kall === 1) throw new Error("Network request failed");
          return rader.get(input.id as string);
        },
      },
    },
  } as unknown as Parameters<typeof syncVareforbruk>[0];
  return { rader, klient, kall: () => kall };
}

describe("vareforbruk fra kortet — synk", () => {
  it("venter mens sedelen er pending (koblingen ville blitt avvist)", async () => {
    seedSedel("s1", "pending");
    seedTimerRad("t1", "s1");
    nyLinje("l1", "s1");
    const server = lagServer();
    const res = await syncVareforbruk(server.klient, "u1");
    expect(res.venter).toBe(1);
    expect(server.kall()).toBe(0);
    expect(linje("l1").syncStatus).toBe("pending");
  });

  it("sendes med dagsseddelId = sedel-id når sedelen er synket og har timerrad for prosjektet", async () => {
    seedSedel("s1", "synced");
    seedTimerRad("t1", "s1");
    nyLinje("l1", "s1");
    const server = lagServer();
    await syncVareforbruk(server.klient, "u1");
    expect(server.rader.get("l1")).toMatchObject({
      id: "l1",
      projectId: "p1",
      dato: "2026-11-06",
      vareId: "v1",
      antall: 2.5,
      dagsseddelId: "s1",
    });
    expect(linje("l1").syncStatus).toBe("synced");
  });

  it("timerrad med projectId null arver sedelens prosjekt (legacy) → koblet", () => {
    const plan = planleggVaresending(
      { id: "l1", sheetId: "s1", projectId: "p1", dato: "2026-11-06", vareId: "v1", antall: 1, byggeplassId: null, externalCostObjectId: null },
      { id: "s1", projectId: "p1", syncStatus: "synced" },
      [{ projectId: null }],
    );
    expect(plan).toMatchObject({ handling: "send", input: { dagsseddelId: "s1" } });
  });

  it("kort uten timerrad for prosjektet → sendes uten kobling (som på web)", async () => {
    seedSedel("s1", "synced");
    seedTimerRad("t1", "s1", "p-annet");
    nyLinje("l1", "s1");
    const server = lagServer();
    await syncVareforbruk(server.klient, "u1");
    expect(server.rader.get("l1")).not.toHaveProperty("dagsseddelId");
    expect(linje("l1").syncStatus).toBe("synced");
  });

  it("idempotent: tapt svar → ny sending med samme id → én linje på server", async () => {
    seedSedel("s1", "synced");
    seedTimerRad("t1", "s1");
    nyLinje("l1", "s1");
    const server = lagServer({ feilFoersteSvar: true });
    await syncVareforbruk(server.klient, "u1");
    expect(linje("l1").syncStatus).toBe("pending"); // nettfeil → prøv igjen
    await syncVareforbruk(server.klient, "u1");
    expect(server.kall()).toBe(2);
    expect(server.rader.size).toBe(1);
    expect(linje("l1").syncStatus).toBe("synced");
  });

  it("permanent avvisning (BAD_REQUEST) → avvist med feilmelding, sendes ikke igjen", async () => {
    seedSedel("s1", "synced");
    seedTimerRad("t1", "s1");
    nyLinje("l1", "s1");
    const feil = Object.assign(new Error("Varen er inaktiv"), { data: { code: "BAD_REQUEST" } });
    const server = lagServer({ feil });
    await syncVareforbruk(server.klient, "u1");
    expect(linje("l1")).toMatchObject({ syncStatus: "avvist", feilmelding: "Varen er inaktiv" });
    await syncVareforbruk(server.klient, "u1");
    expect(server.kall()).toBe(1);
  });

  it("sedelen sendt før køen nådde fram (ORDRE 33, FORBIDDEN) → avvist med i18n-nøkkel, sendes ikke igjen", async () => {
    seedSedel("s1", "synced");
    seedTimerRad("t1", "s1");
    nyLinje("l1", "s1");
    const feil = Object.assign(new Error("vareforbruk.feil.sedelSendt"), { data: { code: "FORBIDDEN" } });
    const server = lagServer({ feil });
    await syncVareforbruk(server.klient, "u1");
    expect(linje("l1")).toMatchObject({ syncStatus: "avvist", feilmelding: "vareforbruk.feil.sedelSendt" });
    await syncVareforbruk(server.klient, "u1");
    expect(server.kall()).toBe(1);
  });

  it("Varelager slått av (PRECONDITION_FAILED) → avvist, sendes ikke igjen (16d)", async () => {
    seedSedel("s1", "synced");
    seedTimerRad("t1", "s1");
    nyLinje("l1", "s1");
    const feil = Object.assign(new Error("Varelager er ikke aktivt"), { data: { code: "PRECONDITION_FAILED" } });
    const server = lagServer({ feil });
    await syncVareforbruk(server.klient, "u1");
    expect(linje("l1")).toMatchObject({ syncStatus: "avvist", feilmelding: "Varelager er ikke aktivt" });
    await syncVareforbruk(server.klient, "u1");
    expect(server.kall()).toBe(1);
  });

  it("dato_kollisjon: forsoning nøkler om sheet_id → linjen kobles til server-sedelen", async () => {
    seedSedel("local-s", "pending");
    seedTimerRad("t1", "local-s");
    nyLinje("l1", "local-s");
    const timerKlient = {
      timer: {
        dagsseddel: {
          syncBatch: {
            mutate: async () => ({
              resultater: [
                {
                  clientUuid: "local-s",
                  resultat: "conflict",
                  aarsak: "dato_kollisjon",
                  serverData: {
                    id: "server-s",
                    clientUuid: "server-s",
                    status: "draft",
                    lederKommentar: null,
                    attestertVed: null,
                    updatedAt: "2026-11-06T12:00:00.000Z",
                  },
                },
              ],
            }),
          },
          hentEndringerSiden: {
            query: async () => ({
              serverTid: "2027-01-01T00:00:00.000Z",
              sedler: [],
              levendeSedler: [],
              slettevindu: { fraDato: "2027-01-01", tilDato: null },
            }),
          },
          hentMedId: { query: async () => ({ timer: [] }) },
        },
      },
    } as unknown as Parameters<typeof syncTimer>[0];
    await syncTimer(timerKlient, "u1");
    expect(linje("l1").sheetId).toBe("server-s");

    // Neste tick: sedelen er synket → linjen sendes koblet til server-sedelen.
    db().update(dagsseddelLocal).set({ syncStatus: "synced" }).where(eq(dagsseddelLocal.id, "server-s")).run();
    const server = lagServer();
    await syncVareforbruk(server.klient, "u1");
    expect(server.rader.get("l1")).toMatchObject({ dagsseddelId: "server-s" });
  });

  it("andre brukeres linjer sendes ikke", async () => {
    seedSedel("s1", "synced");
    seedTimerRad("t1", "s1");
    nyLinje("l1", "s1");
    const server = lagServer();
    await syncVareforbruk(server.klient, "u2");
    expect(server.kall()).toBe(0);
  });
});

describe("vareforbruk fra kortet — visning", () => {
  it("ingen dobbelttelling: synket lokal linje + samme server-rad telles én gang", async () => {
    seedSedel("s1", "synced");
    seedTimerRad("t1", "s1");
    nyLinje("l1", "s1");
    nyLinje("l2", "s1");
    const server = [{ id: "l1", projectId: "p1", antall: 2.5, vare: { navn: "Grus", enhet: "m3" } }];
    const samlet = slaaSammenVarelinjer(server, hentLokaleVarelinjer("s1", "p1"));
    expect(samlet.map((v) => v.id)).toEqual(["l1", "l2"]);
  });

  it("lokale linjer filtreres på kortets prosjekt", () => {
    seedSedel("s1", "synced");
    nyLinje("l1", "s1", "p1");
    nyLinje("l2", "s1", "p2");
    expect(hentLokaleVarelinjer("s1", "p1").map((v) => v.id)).toEqual(["l1"]);
    expect(hentLokaleVarelinjer("s1").map((v) => v.id).sort()).toEqual(["l1", "l2"]);
  });
});

describe("vare-katalog-cache", () => {
  function katalogKlient(svar: () => Promise<unknown>) {
    return {
      vareforbruk: { katalogForFirma: { query: svar } },
    } as unknown as Parameters<typeof refreshVareKatalog>[0];
  }

  it("lagrer varer pr. firma og prosjektene med Varelager → knappen vises", async () => {
    await refreshVareKatalog(
      katalogKlient(async () => ({
        varer: [
          { id: "v2", navn: "Pukk", enhet: "tonn", varenummer: null },
          { id: "v1", navn: "Grus", enhet: "m3", varenummer: "G1" },
        ],
        prosjektIderMedVarelager: ["p1"],
      })),
      "o1",
    );
    expect(hentVarerLokalt("o1").map((v) => v.navn)).toEqual(["Grus", "Pukk"]);
    const ider = await hentVarelagerProsjekterLokalt("o1");
    expect(visVareforbrukKnapp({ prosjektIderMedVarelager: ider, projectId: "p1", erRedigerbar: true })).toBe(true);
    expect(visVareforbrukKnapp({ prosjektIderMedVarelager: ider, projectId: "p2", erRedigerbar: true })).toBe(false);
  });

  it("Varelager av (FORBIDDEN) → tom katalog og knappen skjult", async () => {
    await refreshVareKatalog(
      katalogKlient(async () => ({
        varer: [{ id: "v1", navn: "Grus", enhet: "m3", varenummer: null }],
        prosjektIderMedVarelager: ["p1"],
      })),
      "o1",
    );
    await refreshVareKatalog(
      katalogKlient(async () => {
        throw Object.assign(new Error("av"), { data: { code: "FORBIDDEN" } });
      }),
      "o1",
    );
    expect(hentVarerLokalt("o1")).toHaveLength(0);
    const ider = await hentVarelagerProsjekterLokalt("o1");
    expect(visVareforbrukKnapp({ prosjektIderMedVarelager: ider, projectId: "p1", erRedigerbar: true })).toBe(false);
  });

  it("nettfeil kaster før sletting → eksisterende cache bevares", async () => {
    await refreshVareKatalog(
      katalogKlient(async () => ({
        varer: [{ id: "v1", navn: "Grus", enhet: "m3", varenummer: null }],
        prosjektIderMedVarelager: ["p1"],
      })),
      "o1",
    );
    await expect(
      refreshVareKatalog(
        katalogKlient(async () => {
          throw new Error("Network request failed");
        }),
        "o1",
      ),
    ).rejects.toThrow();
    expect(hentVarerLokalt("o1")).toHaveLength(1);
    expect(await hentVarelagerProsjekterLokalt("o1")).toEqual(["p1"]);
  });

  it("låst kort (sendt) viser ikke knappen selv med Varelager på", () => {
    expect(visVareforbrukKnapp({ prosjektIderMedVarelager: ["p1"], projectId: "p1", erRedigerbar: false })).toBe(false);
  });
});

describe("ORDRE 34 pkt 2 — vare-dialogen blir stående i Bekreft dag", () => {
  it("🔴 forblirApen → nullstill (dialogen lukkes ikke); standard → lukk", () => {
    expect(vareModalEtterLagre(true)).toBe("nullstill");
    expect(vareModalEtterLagre(false)).toBe("lukk");
  });

  it("«Ført i dag» leser brukerens linjer for prosjekt + dato, ikke andres", () => {
    nyLinje("l1", "s1");
    nyLinje("l2", "s1", "p2");
    expect(hentLokaleVarelinjerForDag("u1", "p1", "2026-11-06")).toEqual([
      { navn: "Grus", antall: 2.5, enhet: "m3" },
    ]);
    expect(hentLokaleVarelinjerForDag("u2", "p1", "2026-11-06")).toEqual([]);
    expect(hentLokaleVarelinjerForDag("u1", "p1", "2026-11-07")).toEqual([]);
  });

  it("🔴 ORDRE 35 C3: avvist linje vises ikke i «Ført i dag»; pending og synced gjør", () => {
    nyLinje("l1", "s1");
    nyLinje("l2", "s1");
    nyLinje("l3", "s1");
    db().update(vareforbrukLocal).set({ syncStatus: "avvist" }).where(eq(vareforbrukLocal.id, "l2")).run();
    db().update(vareforbrukLocal).set({ syncStatus: "synced" }).where(eq(vareforbrukLocal.id, "l3")).run();
    expect(hentLokaleVarelinjerForDag("u1", "p1", "2026-11-06")).toHaveLength(2);
  });
});

describe("Radform (2026-11-12) — varelinjen husker timerraden", () => {
  function linjeFraRad(id: string, sheetId: string, sheetTimerId: string | null, projectId = "p1") {
    lagreLokalVarelinje({
      id,
      userId: "u1",
      organizationId: "o1",
      sheetId,
      projectId,
      dato: "2026-11-06",
      vareId: "v1",
      vareNavn: "Grus",
      enhet: "m3",
      antall: 2.5,
      byggeplassId: null,
      sheetTimerId,
    });
  }

  it("ny vare fra en rad lagres lokalt med sheet_timer_id og leses tilbake", () => {
    seedSedel("s1", "pending");
    seedTimerRad("t1", "s1");
    linjeFraRad("l1", "s1", "t1");
    expect(linje("l1").sheetTimerId).toBe("t1");
    expect(hentLokaleVarelinjer("s1")[0]?.sheetTimerId).toBe("t1");
  });

  it("gammel linje uten kobling har sheetTimerId null (→ «Uten rad»)", () => {
    seedSedel("s1", "pending");
    nyLinje("l1", "s1");
    expect(hentLokaleVarelinjer("s1")[0]?.sheetTimerId).toBeNull();
  });

  it("synk sender sheetTimerId sammen med dagsseddelId når raden står på sedelen", async () => {
    seedSedel("s1", "synced");
    seedTimerRad("t1", "s1");
    linjeFraRad("l1", "s1", "t1");
    const server = lagServer();
    await syncVareforbruk(server.klient, "u1");
    expect(server.rader.get("l1")).toMatchObject({ dagsseddelId: "s1", sheetTimerId: "t1" });
  });

  it("negativkontroll: linje uten kobling sendes uten sheetTimerId", async () => {
    seedSedel("s1", "synced");
    seedTimerRad("t1", "s1");
    nyLinje("l1", "s1");
    const server = lagServer();
    await syncVareforbruk(server.klient, "u1");
    expect(server.rader.get("l1")).toMatchObject({ dagsseddelId: "s1" });
    expect(server.rader.get("l1")).not.toHaveProperty("sheetTimerId");
  });

  it("raden slettet eller flyttet til annet prosjekt → sendes ukoblet, ikke avvist", async () => {
    seedSedel("s1", "synced");
    seedTimerRad("t1", "s1", "p-annet");
    seedTimerRad("t2", "s1");
    linjeFraRad("l1", "s1", "t1"); // t1 tilhører nå et annet prosjekt
    linjeFraRad("l2", "s1", "t-borte"); // raden finnes ikke lenger
    const server = lagServer();
    await syncVareforbruk(server.klient, "u1");
    expect(server.rader.get("l1")).not.toHaveProperty("sheetTimerId");
    expect(server.rader.get("l2")).not.toHaveProperty("sheetTimerId");
    expect(linje("l1").syncStatus).toBe("synced");
  });

  it("uten dagsseddelId sendes aldri sheetTimerId (sedel avvist → som på web)", () => {
    const plan = planleggVaresending(
      { id: "l1", sheetId: "s1", projectId: "p1", dato: "2026-11-06", vareId: "v1", antall: 1, byggeplassId: null, externalCostObjectId: null, sheetTimerId: "t1" },
      { id: "s1", projectId: "p1", syncStatus: "avvist" },
      [{ id: "t1", projectId: "p1" }],
    );
    expect(plan.handling).toBe("send");
    if (plan.handling === "send") expect(plan.input).not.toHaveProperty("sheetTimerId");
  });

  it("server → mobil: sheetTimerId fra hentMineForDato beholdes ved sammenslåing", () => {
    const flett = slaaSammenVarelinjer(
      [{ id: "srv1", projectId: "p1", antall: 1, vare: { navn: "Grus", enhet: "m3" }, sheetTimerId: "t9" }],
      [],
    );
    expect(flett[0]).toMatchObject({ sheetTimerId: "t9" });
  });
});
