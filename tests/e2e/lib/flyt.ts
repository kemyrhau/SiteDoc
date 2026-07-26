/**
 * Oppslag mot det seedede Agent-testprosjektet + livssyklus-helpere for
 * dokumenter (opprett / driv status / rydd). All setup går via tRPC-API-et
 * (rask, deterministisk, isolert) — den ASSERTERTE handlingen gjøres i UI av
 * testene.
 *
 * Navnene her MÅ matche packages/db/scripts/seed-e2e-flyt.ts.
 */
import { ApiKlient } from "./api";
import type { Runtime } from "./miljo";
import { AGENT_PROSJEKT_NUMMER } from "./miljo";

export const E2E_FLYT_NAVN = "E2E Flyt";
export const E2E_MAL_NAVN = "E2E Sjekklistemal";

interface Prosjekt {
  id: string;
  projectNumber: string | null;
  name: string;
}

interface FlytMedlem {
  rolle: string;
  faggruppe: { id: string; name: string } | null;
}
interface Flyt {
  id: string;
  name: string;
  faggruppeId: string | null;
  medlemmer: FlytMedlem[];
  maler: Array<{ templateId: string; template: { id: string; name: string } }>;
}

/**
 * Slå opp prosjekt-, flyt-, faggruppe- og mal-IDer for det seedede
 * agentprosjektet. Kaster en tydelig «kjør seed»-feil hvis noe mangler.
 */
export async function slåOppFlyt(api: ApiKlient): Promise<Omit<Runtime, "runId" | "tokens">> {
  const prosjekter = await api.query<Prosjekt[]>("prosjekt.hentMine");
  const prosjekt = prosjekter.find((p) => p.projectNumber === AGENT_PROSJEKT_NUMMER);
  if (!prosjekt) {
    throw new Error(
      `Fant ikke agentprosjektet (${AGENT_PROSJEKT_NUMMER}). ` +
        "Kjør seed-testbrukere.ts + seed-e2e-flyt.ts mot sitedoc_test.",
    );
  }

  const flyter = await api.query<Flyt[]>("dokumentflyt.hentForProsjekt", { projectId: prosjekt.id });
  const flyt =
    flyter.find((f) => f.name === E2E_FLYT_NAVN) ??
    flyter.find((f) => f.maler.some((m) => m.template.name === E2E_MAL_NAVN));
  if (!flyt) {
    throw new Error(
      `Fant ikke «${E2E_FLYT_NAVN}» i agentprosjektet. Kjør seed-e2e-flyt.ts mot sitedoc_test.`,
    );
  }

  if (!flyt.faggruppeId) throw new Error("E2E-flyten mangler bestiller-faggruppe (faggruppeId).");
  const utforer = flyt.medlemmer.find((m) => m.rolle === "utforer");
  if (!utforer?.faggruppe?.id) throw new Error("E2E-flyten mangler utfører-medlem med faggruppe.");
  const mal = flyt.maler.find((m) => m.template.name === E2E_MAL_NAVN) ?? flyt.maler[0];
  if (!mal) throw new Error("E2E-flyten mangler koblet mal.");

  const roller = new Set(flyt.medlemmer.map((m) => m.rolle));

  return {
    projectId: prosjekt.id,
    dokumentflytId: flyt.id,
    bestillerFaggruppeId: flyt.faggruppeId,
    utforerFaggruppeId: utforer.faggruppe.id,
    templateId: mal.template.id,
    antallLedd: roller.size,
  };
}

/** Opprett en sjekkliste (draft) via API. Tittel bærer runId → rydd-signatur. */
export async function opprettSjekkliste(
  api: ApiKlient,
  rt: Runtime,
  navn: string,
): Promise<string> {
  const res = await api.mutation<{ id: string }>("sjekkliste.opprett", {
    templateId: rt.templateId,
    bestillerFaggruppeId: rt.bestillerFaggruppeId,
    utforerFaggruppeId: rt.utforerFaggruppeId,
    dokumentflytId: rt.dokumentflytId,
    title: `${rt.runId} ${navn}`,
  });
  return res.id;
}

/** Sett status via API (admin-token). `sent` kollapser server-side til `received`. */
export async function settStatus(api: ApiKlient, id: string, nyStatus: string): Promise<void> {
  await api.mutation("sjekkliste.endreStatus", { id, nyStatus });
}

interface DokDetalj {
  id: string;
  status: string;
  title: string | null;
}

async function hentStatus(api: ApiKlient, id: string): Promise<string> {
  const d = await api.query<DokDetalj>("sjekkliste.hentMedId", { id });
  return d.status;
}

// Legal neste-status på vei mot en slettbar tilstand (draft/cancelled).
// Speiler statusHandlinger.ts — kun lovlige overganger (isValidStatusTransition).
const MOT_DRAFT: Record<string, string> = {
  received: "draft", // trekk tilbake
  in_progress: "closed", // lukk → (deretter closed→draft)
  responded: "approved", // godkjenn → (deretter approved→draft)
  approved: "draft", // gjenåpne
  closed: "draft", // gjenåpne
  dismissed: "draft", // gjenåpne
  sent: "draft", // (transient; behandles som received)
};

/**
 * Rydd ett dokument: driv det (som admin) ned til draft/cancelled og soft-slett.
 * Best-effort — kaster aldri (rydding skal aldri velte en kjøring).
 */
export async function ryddDokument(api: ApiKlient, id: string): Promise<void> {
  try {
    for (let i = 0; i < 6; i++) {
      const status = await hentStatus(api, id);
      if (status === "draft" || status === "cancelled") break;
      const neste = MOT_DRAFT[status];
      if (!neste) break;
      await settStatus(api, id, neste);
    }
    await api.mutation("sjekkliste.slett", { id }).catch(() => {});
  } catch {
    // Rester er runId-prefikset og prosjekt-isolert → ufarlig.
  }
}
