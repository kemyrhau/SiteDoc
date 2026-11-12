import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * PDF-1T (Kontrollør-gate PDF-1, mutantene G1/G3): `arkiv.rendr` skal gi tjenesten en
 * `oppgaveTilgang` som bruker samme dokumenttilgang som lesing av oppgaven.
 *  - G1: ruten sender `oppgaveTilgang` videre til `rendrArkivPdf`.
 *  - G3: FORBIDDEN fra `verifiserDokumentTilgang` → oppgaven utelates (false), ikke tatt med.
 *  - Annen feil (f.eks. DB-feil) kastes videre — skal ikke tolkes som «ingen tilgang».
 */

const { verifiser, rendr } = vi.hoisted(() => ({ verifiser: vi.fn(), rendr: vi.fn() }));
vi.mock("../trpc/tilgangskontroll", () => ({ verifiserDokumentTilgang: verifiser }));
vi.mock("../services/arkiv/render", () => ({
  rendrArkivPdf: rendr,
  genererArkivStempel: () => "generert",
}));

import { arkivRouter } from "./arkiv";

const SJEKKLISTE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

type OppgaveTilgang = (o: {
  id: string; projectId: string; bestillerFaggruppeId: string | null; utforerFaggruppeId: string | null;
  domain: string | null; hmsSynlighet: unknown;
}) => Promise<boolean>;

const OPPGAVE = {
  id: "oppg-1", projectId: PROSJEKT, bestillerFaggruppeId: "fg-b", utforerFaggruppeId: "fg-u",
  domain: "bygg", hmsSynlighet: null,
};

function lagCtx() {
  return {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      checklist: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: SJEKKLISTE, bestillerFaggruppeId: "fg-b", utforerFaggruppeId: "fg-u",
          template: { projectId: PROSJEKT, domain: "bygg", hmsSynlighet: null },
        }),
      },
      project: { findUnique: vi.fn().mockResolvedValue({ primaryOrganizationId: "org-1" }) },
      activity: { create: vi.fn().mockResolvedValue({}) },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/** Kjører ruten og returnerer `oppgaveTilgang` slik tjenesten fikk den. */
async function hentOppgaveTilgang(): Promise<OppgaveTilgang | undefined> {
  await arkivRouter.createCaller(lagCtx()).rendr({ dokumenter: [{ id: SJEKKLISTE, type: "sjekkliste" }] });
  expect(rendr).toHaveBeenCalledTimes(1);
  return rendr.mock.calls[0]![2].oppgaveTilgang;
}

describe("arkiv.rendr — oppgaveTilgang (PDF-1T)", () => {
  beforeEach(() => {
    verifiser.mockReset().mockResolvedValue(undefined);
    rendr.mockReset().mockResolvedValue({
      pdf: Buffer.from("pdf"), filnavn: "x.pdf", komplett: true, renderTimeout: false,
      dokumenter: [{ id: SJEKKLISTE, type: "sjekkliste", manglendeVedlegg: [] }],
    });
  });

  it("G1: ruten sender oppgaveTilgang til tjenesten, og den sjekker oppgaven som «task»", async () => {
    const tilgang = await hentOppgaveTilgang();
    expect(typeof tilgang).toBe("function");
    verifiser.mockClear();
    await expect(tilgang!(OPPGAVE)).resolves.toBe(true);
    expect(verifiser).toHaveBeenCalledWith("user-1", PROSJEKT, "fg-b", "fg-u", "bygg", "oppg-1", "task", null);
  });

  it("G3: FORBIDDEN → oppgaven utelates (false)", async () => {
    const tilgang = await hentOppgaveTilgang();
    verifiser.mockRejectedValueOnce(new TRPCError({ code: "FORBIDDEN", message: "nei" }));
    await expect(tilgang!(OPPGAVE)).resolves.toBe(false);
  });

  it("annen feil kastes videre (ikke tolket som manglende tilgang)", async () => {
    const tilgang = await hentOppgaveTilgang();
    verifiser.mockRejectedValueOnce(new Error("db nede"));
    await expect(tilgang!(OPPGAVE)).rejects.toThrow("db nede");
    verifiser.mockRejectedValueOnce(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "x" }));
    await expect(tilgang!(OPPGAVE)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
