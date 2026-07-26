/**
 * Global opprydding: soft-slett alle dokumenter på E2E-malen (denne kjøringens
 * + evt. UI-opprettede uten runId-prefiks). Driver hvert dokument ned til draft
 * og kaller sjekkliste.slett. Best-effort — feiler aldri kjøringen.
 * Agentprosjektet er eksklusivt for e2e; ALDRI mot prod.
 */
import { readFile } from "node:fs/promises";
import { ApiKlient } from "./lib/api";
import { ryddProsjektMal } from "./lib/flyt";
import { RUNTIME_FIL, type Runtime } from "./lib/miljo";

export default async function globalTeardown() {
  let runtime: Runtime;
  try {
    runtime = JSON.parse(await readFile(RUNTIME_FIL, "utf8")) as Runtime;
  } catch {
    return; // ingen runtime → ingenting å rydde
  }

  const api = new ApiKlient(runtime.tokens.firma);
  const antall = await ryddProsjektMal(api, runtime.projectId, runtime.templateId);
  console.log(`[e2e] ryddet ${antall} dokument(er) for ${runtime.runId}`);
}
