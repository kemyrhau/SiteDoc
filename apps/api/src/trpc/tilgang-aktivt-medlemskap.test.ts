import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * L2 — tilgang følger aktivt medlemskap (ordre 2026-11-05 (4), Kenneth B1–B10).
 *
 * Datalaget: tilgangsportene slår opp medlemmet med `aktivtProsjektmedlemWhere`, og
 * faggruppe-/gruppekoblingene med `aktivtMedlemWhere`. En avsluttet rad (periodeSlutt satt)
 * står igjen i tabellen, men skal ikke gi tilgang. Den falske prismaen under filtrerer KUN på
 * periodeSlutt når spørringen ber om det — fjernes filteret i porten, blir testene røde.
 *
 * Beslutningen (B4, innsendergrenen) dekkes i packages/shared/src/utils/tilgangsmatrise.test.ts;
 * her pinnes liste-speilet i `byggTilgangsFilter`.
 *
 * Kjør: cd apps/api && npx vitest run src/trpc/tilgang-aktivt-medlemskap.test.ts
 */

interface Rad { periodeSlutt: Date | null }
interface Medlem extends Rad {
  id: string;
  userId: string;
  projectId: string;
  role: string;
  erFirmaansvarlig: boolean;
  faggruppeKoblinger: Array<Rad & { faggruppeId: string }>;
  groupMemberships: Array<Rad & { groupId: string; group: { domains: string[]; groupFaggrupper: []; permissions: string[] } }>;
}

let medlemmer: Medlem[] = [];
const AVSLUTTET = new Date("2026-11-01");

/** Filtrerer på periodeSlutt bare når `where` ber om det — som Prisma. */
function aktiveHvisBedt<T extends Rad>(rader: T[], where: Record<string, unknown> | undefined): T[] {
  return where && "periodeSlutt" in where ? rader.filter((r) => r.periodeSlutt === null) : rader;
}

type Relasjon = { where?: Record<string, unknown> } | undefined;

vi.mock("@sitedoc/db", () => ({
  prisma: {
    user: { findUnique: () => Promise.resolve({ role: "user" }) },
    project: {
      findUnique: () => Promise.resolve({ primaryOrganizationId: null, status: "active", type: "kunde" }),
    },
    organizationMember: { findUnique: () => Promise.resolve(null), findMany: () => Promise.resolve([]) },
    projectMember: {
      findFirst: ({ where, include, select }: {
        where: Record<string, unknown>;
        include?: Record<string, Relasjon>;
        select?: Record<string, Relasjon>;
      }) => {
        const rel = include ?? select ?? {};
        const treff = aktiveHvisBedt(
          medlemmer.filter((m) => m.userId === where.userId && m.projectId === where.projectId),
          where,
        )[0];
        if (!treff) return Promise.resolve(null);
        return Promise.resolve({
          ...treff,
          faggruppeKoblinger: aktiveHvisBedt(treff.faggruppeKoblinger, rel.faggruppeKoblinger?.where),
          groupMemberships: aktiveHvisBedt(treff.groupMemberships, rel.groupMemberships?.where),
        });
      },
    },
    projectGroupMember: { findFirst: () => Promise.resolve(null) },
    dokumentflytMedlem: { findMany: () => Promise.resolve([]) },
  },
}));

import {
  verifiserProsjektmedlem,
  hentBrukerFaggruppeIder,
  byggTilgangsFilter,
  byggFlytBruker,
} from "./tilgangskontroll";

const U = "u-1";
const P = "p-1";

function medlem(over: Partial<Medlem> = {}): Medlem {
  return {
    id: "pm-1",
    userId: U,
    projectId: P,
    role: "member",
    erFirmaansvarlig: false,
    periodeSlutt: null,
    faggruppeKoblinger: [],
    groupMemberships: [],
    ...over,
  };
}

beforeEach(() => {
  medlemmer = [];
});

describe("L2 — prosjektmedlemskap med periodeSlutt gir ingen tilgang", () => {
  it("aktivt medlem → slipper gjennom", async () => {
    medlemmer = [medlem()];
    await expect(verifiserProsjektmedlem(U, P)).resolves.toBeUndefined();
  });

  it("🔴 avsluttet prosjektmedlem → FORBIDDEN (raden står, men er avsluttet)", async () => {
    medlemmer = [medlem({ periodeSlutt: AVSLUTTET })];
    await expect(verifiserProsjektmedlem(U, P)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("🔴 avsluttet prosjektmedlem ser ingen dokumentliste (byggTilgangsFilter kaster)", async () => {
    medlemmer = [medlem({ periodeSlutt: AVSLUTTET })];
    await expect(byggTilgangsFilter(U, P)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("L2 — avsluttede faggruppe-/gruppekoblinger teller ikke", () => {
  it("🔴 fjernet fra faggruppe → faggruppen er borte fra brukerens faggrupper", async () => {
    medlemmer = [medlem({
      faggruppeKoblinger: [
        { faggruppeId: "fg-aktiv", periodeSlutt: null },
        { faggruppeId: "fg-fjernet", periodeSlutt: AVSLUTTET },
      ],
    })];
    expect(await hentBrukerFaggruppeIder(U, P)).toEqual(["fg-aktiv"]);
  });

  it("🔴 fjernet fra gruppe → gruppen er borte fra flyt-brukeren (ruting/ball)", async () => {
    const gruppe = { domains: [], groupFaggrupper: [] as [], permissions: [] };
    medlemmer = [medlem({
      groupMemberships: [
        { groupId: "g-aktiv", periodeSlutt: null, group: gruppe },
        { groupId: "g-fjernet", periodeSlutt: AVSLUTTET, group: gruppe },
      ],
    })];
    expect((await byggFlytBruker(U, P)).gruppeIder).toEqual(["g-aktiv"]);
  });
});

describe("L2 B4 — liste-speilet av innsendergrenen (byggTilgangsFilter)", () => {
  it("🔴 innsender/mottaker gjelder bare dokumenter uten flyt (+ HMS-melder) — dokumenter med flyt krever flytmedlemskap", async () => {
    medlemmer = [medlem()];
    const filter = (await byggTilgangsFilter(U, P)) as { OR: Record<string, unknown>[] };
    expect(filter.OR).toContainEqual({
      bestillerUserId: U,
      OR: [{ dokumentflytId: null }, { template: { domain: "hms" } }],
    });
    expect(filter.OR).toContainEqual({ recipientUserId: U, dokumentflytId: null });
    // Ingen ubetinget innsender-/mottakergren igjen.
    expect(filter.OR).not.toContainEqual({ bestillerUserId: U });
    expect(filter.OR).not.toContainEqual({ recipientUserId: U });
  });
});
