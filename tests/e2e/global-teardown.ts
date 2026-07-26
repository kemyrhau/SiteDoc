/**
 * Global opprydding: soft-slett alle dokumenter denne kjøringen laget (tittel
 * bærer runId). Driver hvert dokument ned til draft og kaller sjekkliste.slett.
 * Best-effort — feiler aldri kjøringen; rester er runId-prefikset og isolert.
 */
import { readFile } from "node:fs/promises";
import { ApiKlient } from "./lib/api";
import { ryddDokument } from "./lib/flyt";
import { RUNTIME_FIL, type Runtime } from "./lib/miljo";

interface Dok {
  id: string;
  title: string | null;
  templateId: string;
}

export default async function globalTeardown() {
  let runtime: Runtime;
  try {
    runtime = JSON.parse(await readFile(RUNTIME_FIL, "utf8")) as Runtime;
  } catch {
    return; // ingen runtime → ingenting å rydde
  }

  const api = new ApiKlient(runtime.tokens.firma);
  let dokumenter: Dok[] = [];
  try {
    dokumenter = await api.query<Dok[]>("sjekkliste.hentForProsjekt", {
      projectId: runtime.projectId,
    });
  } catch {
    return;
  }

  // Rydd denne kjøringens dokumenter (runId-prefiks) OG evt. UI-opprettede uten
  // prefiks som bruker E2E-malen. Agentprosjektet er eksklusivt for e2e, så alle
  // dokumenter på E2E-malen er riggens egne — trygt å soft-slette.
  const våre = dokumenter.filter(
    (d) => d.title?.startsWith(runtime.runId) || d.templateId === runtime.templateId,
  );
  for (const d of våre) {
    await ryddDokument(api, d.id);
  }
  console.log(`[e2e] ryddet ${våre.length} dokument(er) for ${runtime.runId}`);
}
