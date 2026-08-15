/**
 * L1.6-skjermbilde-oppsett i Agent-testprosjektet (dev-login-orgen).
 * Reversibelt: dedikert faggruppe + byggeplass + ett punkt. Rydding: l16-cleanup.ts.
 */
import { writeFileSync } from "node:fs";
import { devLogin, ApiKlient } from "./lib/api";
import { slåOppFlyt } from "./lib/flyt";

async function main() {
  const firmaLogin = await devLogin("test-firma@sitedoc.test");
  const arbLogin = await devLogin("test-arbeider@sitedoc.test");
  const api = new ApiKlient(firmaLogin.sessionToken);

  const flyt = await slåOppFlyt(api); // projectId, dokumentflytId (E2E Flyt), templateId, bestiller/utforer
  console.log("Agent projectId:", flyt.projectId);
  console.log("E2E Flyt:", flyt.dokumentflytId, "mal:", flyt.templateId);

  // projectMemberId for firma + arbeider (for faggruppe-toggle senere)
  type Medlem = { id: string; userId: string; user: { email: string | null } };
  const medlemmer = await api.query<Medlem[]>("medlem.hentForProsjekt", { projectId: flyt.projectId });
  const firmaPm = medlemmer.find((m) => m.userId === firmaLogin.user.id);
  const arbPm = medlemmer.find((m) => m.userId === arbLogin.user.id);
  if (!arbPm) throw new Error("test-arbeider er ikke medlem av agentprosjektet");

  // 1) Dedikert faggruppe L16-TEST (ingen medlemmer → test-arbeider utenfor)
  const fag = await api.mutation<{ id: string; name: string }>("faggruppe.opprett", {
    projectId: flyt.projectId,
    name: "L16-TEST kontrollutfører",
    color: "#f59e0b",
    memberIds: [],
  });
  console.log("Faggruppe L16-TEST:", fag.id);

  // 2) Byggeplass
  const bygg = await api.mutation<{ id: string; name: string }>("bygning.opprett", {
    projectId: flyt.projectId,
    name: "L1.6 Skjermbilder",
  });
  console.log("Byggeplass:", bygg.id);

  // 3) Kontrollplan
  const plan = await api.mutation<{ id: string }>("kontrollplan.opprettEllerHent", {
    projectId: flyt.projectId,
    byggeplassId: bygg.id,
  });
  console.log("Kontrollplan:", plan.id);

  // 4) Ett punkt: mal=E2E, faggruppe=L16-TEST → auto-binder E2E Flyt (entydig)
  const opprettet = await api.mutation<{ punkter: Array<{ id: string; dokumentflytId: string | null }> }>(
    "kontrollplan.opprettPunkter",
    {
      kontrollplanId: plan.id,
      sjekklisteMalId: flyt.templateId,
      faggruppeId: fag.id,
      punkter: [{ importNavn: "L1.6 kontrollpunkt" }],
    },
  );
  const punkt = opprettet.punkter[0];
  console.log("Punkt:", punkt.id, "auto-flyt:", punkt.dokumentflytId ?? "—");

  // 5) Tøm flyten → flytless startpunkt for scenario (iii). Settes igjen i UI (scenario i).
  await api.mutation("kontrollplan.settPunktFlyt", { punktId: punkt.id, dokumentflytId: null });
  console.log("Flyt tømt (flytless for scenario iii)");

  const state = {
    projectId: flyt.projectId,
    byggeplassId: bygg.id,
    kontrollplanId: plan.id,
    punktId: punkt.id,
    faggruppeId: fag.id,
    e2eFlytId: flyt.dokumentflytId,
    templateId: flyt.templateId,
    firmaPmId: firmaPm?.id ?? null,
    arbPmId: arbPm.id,
    arbUserId: arbLogin.user.id,
  };
  writeFileSync(new URL("./l16-state.json", import.meta.url), JSON.stringify(state, null, 2));
  console.log("\nStatus skrevet til l16-state.json:\n", JSON.stringify(state, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
