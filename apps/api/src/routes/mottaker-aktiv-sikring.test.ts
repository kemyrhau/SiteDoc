import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Ordre (7a): en personmottaker må være aktivt prosjektmedlem ved videresending, ruting
 * (f.eks. Besvar tilbake til bestiller), terminal-e-post og flytt — i sjekkliste OG oppgave.
 * Feiler sjekken, avvises ikke kallet (mobilens offline-kø kan bære en gammel medlemsliste):
 * M3-regelen gjelder — innsender tar ballen, ellers står dokumentet uten personmottaker.
 * Omdirigeringen logges i dokumenthistorikken, og e-posten går aldri til eks-medlemmet.
 */

const ruting = vi.hoisted(() => ({ mottaker: null as { recipientUserId: string | null; recipientGroupId: string | null } | null }));
const hentMottakerEposter = vi.hoisted(() => vi.fn());

vi.mock("../trpc/tilgangskontroll", async (importActual) => ({
  ...(await importActual<typeof import("../trpc/tilgangskontroll")>()),
  verifiserDokumentTilgang: vi.fn().mockResolvedValue(undefined),
  verifiserRetningsrett: vi.fn().mockResolvedValue(undefined),
  byggFlytBruker: vi.fn().mockResolvedValue(null),
  hentBrukerTillatelser: vi.fn().mockResolvedValue(new Set(["create_checklists", "create_tasks"])),
}));
vi.mock("../services/flytFakta", async (importActual) => ({
  ...(await importActual<typeof import("../services/flytFakta")>()),
  hentFlytMedlemmer: vi.fn().mockResolvedValue([]),
  hentPosisjonsLedd: vi.fn().mockResolvedValue([]),
  beregnSkyggeFakta: vi.fn().mockReturnValue({ aktivPosisjon: 1, retning: "paatvers" }),
  beregnRuting: vi.fn(() => ({
    status: "responded",
    aktivPosisjon: 1,
    retning: "tilbake",
    terminal: null,
    sendt: true,
    mottaker: ruting.mottaker,
  })),
}));
vi.mock("../services/transfer-snapshot", () => ({ byggTransferSnapshot: vi.fn().mockResolvedValue({}) }));
vi.mock("../services/epost", () => ({
  hentMottakerEposter,
  sendDokumentVarsling: vi.fn(),
}));

import { oppgaveRouter } from "./oppgave";
import { sjekklisteRouter } from "./sjekkliste";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";
const DOK = "22222222-2222-4222-8222-222222222222";
const AKTOR = "33333333-3333-4333-8333-333333333333";
const INNSENDER = "44444444-4444-4444-8444-444444444444";
const EX = "55555555-5555-4555-8555-555555555555"; // avsluttet prosjektmedlem
const AKTIV = "66666666-6666-4666-8666-666666666666";
const FLYT = "77777777-7777-4777-8777-777777777777";

const TIL_INNSENDER = "Mottakeren er ikke lenger med i prosjektet — sendt til innsender";
const UTEN_MOTTAKER = "Mottakeren er ikke lenger med i prosjektet — dokumentet står uten personmottaker";

type Model = "checklist" | "task";

function lagVerden(model: Model, opts: { status?: string; bestiller?: string; aktive?: string[] } = {}) {
  const aktive = new Set(opts.aktive ?? [AKTOR, INNSENDER, AKTIV]);
  const dokument = {
    id: DOK,
    status: opts.status ?? "received",
    title: "Dok",
    number: 1,
    data: {},
    bestillerUserId: opts.bestiller ?? INNSENDER,
    recipientUserId: AKTOR,
    recipientGroupId: null,
    dokumentflytId: FLYT,
    aktivPosisjon: 2,
    terminal: null,
    bestillerFaggruppeId: "fg-b",
    utforerFaggruppeId: "fg-u",
    bestillerFaggruppe: { projectId: PROSJEKT, project: { name: "Prosjekt" } },
    template: { projectId: PROSJEKT, domain: "bygg", prefix: "S", project: { name: "Prosjekt" }, objects: [] },
    utforerFaggruppe: { name: "Utfører" },
  };
  const update = vi.fn().mockResolvedValue(dokument);
  const transfer = vi.fn().mockResolvedValue({});
  const prisma: Record<string, unknown> = {
    [model]: { findUniqueOrThrow: vi.fn().mockResolvedValue(dokument), update },
    projectMember: {
      findFirst: vi.fn().mockResolvedValue({ role: "admin" }),
      findMany: vi.fn(({ where }: { where: { userId: { in: string[] } } }) =>
        Promise.resolve(where.userId.in.filter((id) => aktive.has(id)).map((userId) => ({ userId })))),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ name: "Aktør", role: "user" }) },
    dokumentflyt: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: FLYT, projectId: PROSJEKT, name: "Flyt", faggruppeId: "fg-ny", faggruppe: { id: "fg-ny", name: "Ny" } }),
    },
    dokumentflytMedlem: { findFirst: vi.fn().mockResolvedValue(null) },
    documentTransfer: { create: transfer },
  };
  prisma.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  const ctx = {
    userId: AKTOR,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const caller = model === "checklist" ? sjekklisteRouter.createCaller(ctx) : oppgaveRouter.createCaller(ctx);
  const lagret = () => (update.mock.calls.at(-1)?.[0] as { data: { recipientUserId?: string | null } }).data.recipientUserId;
  const historikk = () => (transfer.mock.calls[0]?.[0] as { data: { comment?: string; recipientUserId?: string | null } }).data;
  return { caller, lagret, historikk };
}

/** Alle personer e-postoppslaget ble bedt om (venter på void-varslingen). */
async function epostMottakere() {
  await new Promise((r) => setTimeout(r, 0));
  return hentMottakerEposter.mock.calls.map((c) => (c[1] as { recipientUserId?: string }).recipientUserId);
}

beforeEach(() => {
  vi.clearAllMocks();
  hentMottakerEposter.mockResolvedValue([]);
  ruting.mottaker = null;
});

describe.each([["sjekkliste", "checklist"], ["oppgave", "task"]] as const)("7a %s — mottaker må være aktivt prosjektmedlem", (_navn, model) => {
  it("🔴 videresending til avsluttet medlem → innsender, logget, e-post til innsender", async () => {
    const v = lagVerden(model);
    await v.caller.endreStatus({ id: DOK, nyStatus: "forwarded", recipientUserId: EX });
    expect(v.lagret()).toBe(INNSENDER);
    expect(v.historikk().recipientUserId).toBe(INNSENDER);
    expect(v.historikk().comment).toBe(`Videresendt\n${TIL_INNSENDER}`);
    expect(await epostMottakere()).toEqual([INNSENDER]);
  });

  it("🔴 videresending: innsender er selv avsluttet → ingen personmottaker, ingen e-post til eks-medlem", async () => {
    const v = lagVerden(model, { aktive: [AKTOR] });
    await v.caller.endreStatus({ id: DOK, nyStatus: "forwarded", recipientUserId: EX });
    expect(v.lagret()).toBeNull();
    expect(v.historikk().comment).toBe(`Videresendt\n${UTEN_MOTTAKER}`);
    expect(await epostMottakere()).not.toContain(EX);
  });

  it("videresending til aktivt medlem → uendret, ingen notat", async () => {
    const v = lagVerden(model);
    await v.caller.endreStatus({ id: DOK, nyStatus: "forwarded", recipientUserId: AKTIV });
    expect(v.lagret()).toBe(AKTIV);
    expect(v.historikk().comment).toBe("Videresendt");
    expect(await epostMottakere()).toEqual([AKTIV]);
  });

  it("🔴 Besvar rutet til avsluttet person → innsender, logget, e-post til innsender", async () => {
    ruting.mottaker = { recipientUserId: EX, recipientGroupId: null };
    const v = lagVerden(model);
    await v.caller.endreStatus({ id: DOK, nyStatus: "responded", kommentar: "Svar" });
    expect(v.lagret()).toBe(INNSENDER);
    expect(v.historikk().comment).toBe(`Svar\n${TIL_INNSENDER}`);
    expect(await epostMottakere()).toEqual([INNSENDER]);
  });

  it("🔴 Besvar rutet til avsluttet bestiller (innsender = samme person) → ingen personmottaker", async () => {
    ruting.mottaker = { recipientUserId: EX, recipientGroupId: null };
    const v = lagVerden(model, { bestiller: EX });
    await v.caller.endreStatus({ id: DOK, nyStatus: "responded", kommentar: "Svar" });
    expect(v.lagret()).toBeNull();
    expect(v.historikk().comment).toBe(`Svar\n${UTEN_MOTTAKER}`);
    expect(await epostMottakere()).not.toContain(EX);
  });

  it("🔴 terminal (approved) med avsluttet e-postmottaker → e-post til innsender, aldri til eks-medlemmet", async () => {
    const v = lagVerden(model);
    await v.caller.endreStatus({ id: DOK, nyStatus: "approved", recipientUserId: EX });
    expect(await epostMottakere()).toEqual([INNSENDER]);
  });

  it("🔴 terminal (approved): innsender også avsluttet → ingen personmottaker for e-posten", async () => {
    const v = lagVerden(model, { aktive: [AKTOR] });
    await v.caller.endreStatus({ id: DOK, nyStatus: "approved", recipientUserId: EX });
    expect(await epostMottakere()).toEqual([undefined]);
  });

  it("🔴 flytt med avsluttet mottaker → innsender, logget", async () => {
    const v = lagVerden(model);
    await v.caller.flytt({ id: DOK, projectId: PROSJEKT, nyDokumentflytId: FLYT, recipientUserId: EX });
    expect(v.lagret()).toBe(INNSENDER);
    expect(v.historikk().recipientUserId).toBe(INNSENDER);
    expect(v.historikk().comment).toContain(`\n${TIL_INNSENDER}`);
  });

  it("🔴 flytt: innsender er samme person som eks-mottakeren → ingen personmottaker", async () => {
    const v = lagVerden(model, { bestiller: EX });
    await v.caller.flytt({ id: DOK, projectId: PROSJEKT, nyDokumentflytId: FLYT, recipientUserId: EX });
    expect(v.lagret()).toBeNull();
    expect(v.historikk().comment).toContain(`\n${UTEN_MOTTAKER}`);
  });

  it("flytt med aktivt medlem → uendret, ingen notat", async () => {
    const v = lagVerden(model);
    await v.caller.flytt({ id: DOK, projectId: PROSJEKT, nyDokumentflytId: FLYT, recipientUserId: AKTIV });
    expect(v.lagret()).toBe(AKTIV);
    expect(v.historikk().comment).not.toContain("ikke lenger med i prosjektet");
  });
});
