import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Ordre (8), Kontrollør-dom (30):
 * 1. `flytt` (sjekkliste og oppgave) er bundet til `input.projectId`: dokumentet og den nye flyten
 *    må høre til prosjektet, ellers NOT_FOUND — før rettighetssjekk og skriving.
 * 2. M1: HMS-løpet (Besvar/Returner/Gjenåpne/Lukk) ruter ballen og e-posten til melderen. Begge går
 *    gjennom M3-regelen — en avsluttet melder får verken ballen eller e-post. Omdirigeringen logges.
 */

const ruting = vi.hoisted(() => ({ mottaker: null as { recipientUserId: string | null; recipientGroupId: string | null } | null }));
const hentMottakerEposter = vi.hoisted(() => vi.fn());
const hentBrukerTillatelser = vi.hoisted(() => vi.fn());

vi.mock("../trpc/tilgangskontroll", async (importActual) => ({
  ...(await importActual<typeof import("../trpc/tilgangskontroll")>()),
  verifiserHmsHandling: vi.fn().mockResolvedValue(undefined),
  hentBrukerTillatelser,
}));
vi.mock("../services/flytFakta", async (importActual) => ({
  ...(await importActual<typeof import("../services/flytFakta")>()),
  hentFlytMedlemmer: vi.fn().mockResolvedValue([]),
  beregnRuting: vi.fn(() => ({
    status: "responded",
    aktivPosisjon: 1,
    retning: "tilbake",
    terminal: null,
    sendt: true,
    mottaker: ruting.mottaker,
  })),
}));
vi.mock("../services/epost", () => ({
  hentMottakerEposter,
  sendDokumentVarsling: vi.fn(),
}));

import { oppgaveRouter } from "./oppgave";
import { sjekklisteRouter } from "./sjekkliste";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";
const ANNET = "99999999-9999-4999-8999-999999999999"; // et annet prosjekt
const DOK = "22222222-2222-4222-8222-222222222222";
const AKTOR = "33333333-3333-4333-8333-333333333333";
const MELDER = "44444444-4444-4444-8444-444444444444"; // innsender/melder
const EX = "55555555-5555-4555-8555-555555555555"; // avsluttet prosjektmedlem
const FLYT = "77777777-7777-4777-8777-777777777777";

const TIL_INNSENDER = "Mottakeren er ikke lenger med i prosjektet — sendt til innsender";
const UTEN_MOTTAKER = "Mottakeren er ikke lenger med i prosjektet — dokumentet står uten personmottaker";

type Model = "checklist" | "task";

function lagVerden(
  model: Model,
  opts: { status?: string; aktive?: string[]; dokProsjekt?: string; flytProsjekt?: string } = {},
) {
  const aktive = new Set(opts.aktive ?? [AKTOR, MELDER]);
  const dokProsjekt = opts.dokProsjekt ?? PROSJEKT;
  const dokument = {
    id: DOK,
    status: opts.status ?? "received",
    title: "Dok",
    number: 1,
    bestillerUserId: MELDER,
    recipientUserId: AKTOR,
    recipientGroupId: null,
    dokumentflytId: FLYT,
    aktivPosisjon: 2,
    bestillerFaggruppe: model === "task" ? { projectId: dokProsjekt } : undefined,
    template: { projectId: dokProsjekt, domain: "hms", prefix: "RUH", project: { name: "Prosjekt" } },
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
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: FLYT,
        projectId: opts.flytProsjekt ?? PROSJEKT,
        name: "Flyt",
        faggruppeId: "fg-ny",
        faggruppe: { id: "fg-ny", name: "Ny" },
      }),
    },
    documentTransfer: { create: transfer },
  };
  prisma.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  const ctx = {
    userId: AKTOR,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const caller = model === "checklist" ? sjekklisteRouter.createCaller(ctx) : oppgaveRouter.createCaller(ctx);
  const lagret = () => (update.mock.calls.at(-1)?.[0] as { data: { recipientUserId?: string | null } }).data.recipientUserId;
  const kommentar = () => (transfer.mock.calls[0]?.[0] as { data: { comment?: string } }).data.comment;
  return { caller, update, transfer, lagret, kommentar };
}

function epostMottakere() {
  return hentMottakerEposter.mock.calls.map((c) => (c[1] as { recipientUserId?: string }).recipientUserId);
}

beforeEach(() => {
  vi.clearAllMocks();
  hentMottakerEposter.mockResolvedValue([]);
  hentBrukerTillatelser.mockResolvedValue(new Set(["create_checklists", "create_tasks"]));
  ruting.mottaker = null;
});

describe.each([["sjekkliste", "checklist"], ["oppgave", "task"]] as const)("ordre (8) %s.flytt — prosjektgrense", (_navn, model) => {
  const flytt = (v: ReturnType<typeof lagVerden>) =>
    v.caller.flytt({ id: DOK, projectId: PROSJEKT, nyDokumentflytId: FLYT, recipientUserId: MELDER });

  it("🔴 dokument fra et annet prosjekt → NOT_FOUND før rettighetssjekk, ingenting skrives", async () => {
    const v = lagVerden(model, { dokProsjekt: ANNET });
    await expect(flytt(v)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(hentBrukerTillatelser).not.toHaveBeenCalled();
    expect(v.update).not.toHaveBeenCalled();
    expect(v.transfer).not.toHaveBeenCalled();
  });

  it("🔴 ny flyt fra et annet prosjekt → NOT_FOUND før rettighetssjekk, ingenting skrives", async () => {
    const v = lagVerden(model, { flytProsjekt: ANNET });
    await expect(flytt(v)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(hentBrukerTillatelser).not.toHaveBeenCalled();
    expect(v.update).not.toHaveBeenCalled();
    expect(v.transfer).not.toHaveBeenCalled();
  });

  it("dokument og flyt i samme prosjekt → flyttes", async () => {
    const v = lagVerden(model);
    await expect(flytt(v)).resolves.toEqual({ success: true });
    expect(v.lagret()).toBe(MELDER);
  });
});

const HMS_RUTING = [
  ["sjekkliste.hmsBesvar", "checklist", "hmsBesvar", "sent", { begrunnelse: "Svar" }, "Svar"],
  ["sjekkliste.hmsGjenapne", "checklist", "hmsGjenapne", "closed", { kommentar: "Åpnes igjen" }, "Åpnes igjen"],
  ["oppgave.hmsBesvar", "task", "hmsBesvar", "sent", { begrunnelse: "Svar" }, "Svar"],
  ["oppgave.hmsReturner", "task", "hmsReturner", "received", { sporsmaal: "Hvor?" }, "Hvor?"],
  ["oppgave.hmsGjenapne", "task", "hmsGjenapne", "closed", { kommentar: "Åpnes igjen" }, "Åpnes igjen"],
] as const;

describe.each(HMS_RUTING)("dom (30) M1 %s — HMS-mottaker må være aktiv", (_navn, model, prosedyre, status, input, tekst) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kall = (v: ReturnType<typeof lagVerden>) => (v.caller as any)[prosedyre]({ id: DOK, ...input });

  it("🔴 rutet til avsluttet melder → ingen personmottaker, logget, ingen e-post til melderen", async () => {
    ruting.mottaker = { recipientUserId: MELDER, recipientGroupId: null };
    const v = lagVerden(model, { status, aktive: [AKTOR] });
    await kall(v);
    expect(v.lagret()).toBeNull();
    expect(v.kommentar()).toBe(`${tekst}\n${UTEN_MOTTAKER}`);
    expect(epostMottakere()).not.toContain(MELDER);
  });

  it("🔴 rutet til avsluttet Ledd 1-medlem, melder aktiv → melderen tar ballen, logget", async () => {
    ruting.mottaker = { recipientUserId: EX, recipientGroupId: null };
    const v = lagVerden(model, { status });
    await kall(v);
    expect(v.lagret()).toBe(MELDER);
    expect(v.kommentar()).toBe(`${tekst}\n${TIL_INNSENDER}`);
    expect(epostMottakere()).toEqual([MELDER]);
  });

  it("aktiv melder → uendret, ingen notat, e-post til melderen", async () => {
    ruting.mottaker = { recipientUserId: MELDER, recipientGroupId: null };
    const v = lagVerden(model, { status });
    await kall(v);
    expect(v.lagret()).toBe(MELDER);
    expect(v.kommentar()).toBe(tekst);
    expect(epostMottakere()).toEqual([MELDER]);
  });
});

describe.each([["sjekkliste", "checklist"], ["oppgave", "task"]] as const)("dom (30) M1 %s.hmsLukk — e-post til melderen", (_navn, model) => {
  it("🔴 avsluttet melder → ingen e-post til melderen", async () => {
    const v = lagVerden(model, { status: "responded", aktive: [AKTOR] });
    await v.caller.hmsLukk({ id: DOK });
    expect(epostMottakere()).not.toContain(MELDER);
  });

  it("aktiv melder → e-post til melderen", async () => {
    const v = lagVerden(model, { status: "responded" });
    await v.caller.hmsLukk({ id: DOK });
    expect(epostMottakere()).toEqual([MELDER]);
  });
});
