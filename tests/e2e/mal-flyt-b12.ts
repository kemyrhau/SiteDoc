import { devLogin, ApiKlient } from "./lib/api";

type Prosjekt = { id: string; name: string };
type Flyt = { id: string; name: string; faggruppe: { id: string; name: string } | null; maler: Array<{ template: { id: string; name: string } }> };
type Punkt = { id: string; sjekklisteMalId: string | null; faggruppeId: string | null };
type Plan = { id: string; punkter: Punkt[] } | null;
type StatusRad = { id: string; name: string; kontrollplan: { id: string } | null };

async function main() {
  const { sessionToken } = await devLogin("test-admin@sitedoc.test");
  const api = new ApiKlient(sessionToken);
  const prosjekter = await api.query<Prosjekt[]>("prosjekt.hentAlle");
  const b12 = prosjekter.find((p) => p.name.includes("B12"));
  if (!b12) return console.log("Fant ikke B12");
  console.log(`B12 projectId = ${b12.id}`);

  const flyter = await api.query<Flyt[]>("dokumentflyt.hentForProsjekt", { projectId: b12.id });
  console.log(`\nFlyter i B12: ${flyter.length}`);
  for (const f of flyter) {
    console.log(`  · ${f.name} | eier-faggruppe=${f.faggruppe ? f.faggruppe.name + " (" + f.faggruppe.id.slice(0,6) + ")" : "MANGLER"} | maler=[${f.maler.map((m) => m.template.name).join(", ")}]`);
  }

  const status = await api.query<StatusRad[]>("kontrollplan.hentStatusForProsjekt", { projectId: b12.id });
  for (const b of status) {
    if (!b.kontrollplan) continue;
    const plan = await api.query<Plan>("kontrollplan.hentForByggeplass", { byggeplassId: b.id });
    if (!plan) continue;
    console.log(`\nByggeplass "${b.name}" — punkter m/mal+faggruppe og kandidatflyter:`);
    for (const pk of plan.punkter.filter((p) => p.sjekklisteMalId && p.faggruppeId)) {
      const kand = flyter.filter((f) => f.faggruppe != null && f.maler.some((m) => m.template.id === pk.sjekklisteMalId));
      console.log(`  - punkt ${pk.id} mal=${pk.sjekklisteMalId!.slice(0,6)} fag=${pk.faggruppeId!.slice(0,6)} → kandidatflyter: ${kand.length ? kand.map((f) => f.name).join(", ") : "INGEN"}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
