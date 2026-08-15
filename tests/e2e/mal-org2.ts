import { devLogin, ApiKlient } from "./lib/api";
async function main() {
  const arb = await devLogin("test-arbeider@sitedoc.test");
  const arbApi = new ApiKlient(arb.sessionToken);
  const mine = await arbApi.query<Array<{ id: string; name: string; primaryOrganizationId?: string | null }>>("prosjekt.hentMine");
  for (const p of mine) console.log(`arbeider-prosjekt: ${p.name} org=${p.primaryOrganizationId}`);
  const firma = await devLogin("test-firma@sitedoc.test");
  const firmaApi = new ApiKlient(firma.sessionToken);
  const fmine = await firmaApi.query<Array<{ id: string; name: string; primaryOrganizationId?: string | null }>>("prosjekt.hentMine").catch((e)=>{console.log("firma hentMine feil", e.message);return[];});
  for (const p of fmine) console.log(`firma-prosjekt: ${p.name} org=${p.primaryOrganizationId}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
