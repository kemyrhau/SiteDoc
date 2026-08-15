/**
 * Engangs-måling (L1.6-gate): finn kontrollplan(er) på test som har punkter med
 * både sjekklisteMalId og faggruppeId satt — kandidat for skjermbilde-scenarioene.
 * Kjør: pnpm --filter e2e exec tsx mal-kontrollplan.ts  (fra tests/e2e)
 */
import { devLogin, ApiKlient } from "./lib/api";

type Prosjekt = { id: string; name: string; number?: string };
type StatusRad = { id: string; name: string; kontrollplan: { id: string; status: string; _count: { punkter: number } } | null };
type Punkt = { id: string; sjekklisteMalId: string | null; faggruppeId: string | null; dokumentflytId: string | null; sjekklisteId: string | null; navn?: string };
type Plan = { id: string; punkter: Punkt[] } | null;

async function main() {
  const { sessionToken } = await devLogin("test-admin@sitedoc.test");
  const api = new ApiKlient(sessionToken);

  const prosjekter = await api.query<Prosjekt[]>("prosjekt.hentAlle").catch(async () =>
    api.query<Prosjekt[]>("prosjekt.hentMine"),
  );
  console.log(`Prosjekter: ${prosjekter.length}`);

  for (const p of prosjekter) {
    let status: StatusRad[];
    try {
      status = await api.query<StatusRad[]>("kontrollplan.hentStatusForProsjekt", { projectId: p.id });
    } catch (e) {
      continue; // ikke medlem / ingen tilgang
    }
    for (const b of status) {
      if (!b.kontrollplan || b.kontrollplan._count.punkter === 0) continue;
      let plan: Plan;
      try {
        plan = await api.query<Plan>("kontrollplan.hentForByggeplass", { byggeplassId: b.id });
      } catch {
        continue;
      }
      if (!plan) continue;
      const medMalOgFag = plan.punkter.filter((pk) => pk.sjekklisteMalId && pk.faggruppeId);
      if (medMalOgFag.length === 0) continue;
      const medFlyt = medMalOgFag.filter((pk) => pk.dokumentflytId);
      const koblet = medMalOgFag.filter((pk) => pk.sjekklisteId);
      console.log(
        `\n★ ${p.name} (${p.number ?? p.id.slice(0, 8)}) · byggeplass "${b.name}" · plan ${plan.id.slice(0, 8)}`,
      );
      console.log(
        `   punkter m/mal+faggruppe: ${medMalOgFag.length} · m/dokumentflyt: ${medFlyt.length} · koblet(sjekkliste): ${koblet.length}`,
      );
      for (const pk of medMalOgFag.slice(0, 8)) {
        console.log(
          `   - ${pk.navn ?? pk.id.slice(0, 8)} | mal=${pk.sjekklisteMalId?.slice(0, 6)} fag=${pk.faggruppeId?.slice(0, 6)} flyt=${pk.dokumentflytId?.slice(0, 6) ?? "—"} sjekk=${pk.sjekklisteId ? "ja" : "nei"}`,
        );
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
