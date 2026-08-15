import { devLogin, ApiKlient } from "./lib/api";
async function main() {
  const admin = new ApiKlient((await devLogin("test-admin@sitedoc.test")).sessionToken);
  const arb = await devLogin("test-arbeider@sitedoc.test");
  const firma = await devLogin("test-firma@sitedoc.test");
  console.log(`test-arbeider userId=${arb.user.id}`);
  console.log(`test-firma userId=${firma.user.id}`);
  // Prosjekt-org
  const projectId = "f6dcb81f-802c-415b-a6c6-a8fdf7f9710f";
  const prosjekter = await admin.query<Array<{ id: string; name: string; primaryOrganizationId?: string | null; organizationId?: string | null }>>("prosjekt.hentAlle");
  const b12 = prosjekter.find((p) => p.id === projectId);
  console.log(`B12 org: primaryOrganizationId=${b12?.primaryOrganizationId ?? "?"} organizationId=${b12?.organizationId ?? "?"}`);
  console.log("B12 keys:", JSON.stringify(b12));
  // arbeiders prosjekter (for å se hans org-prosjekter)
  const arbApi = new ApiKlient(arb.sessionToken);
  const mine = await arbApi.query<Array<{ id: string; name: string; primaryOrganizationId?: string | null }>>("prosjekt.hentMine").catch((e) => { console.log("arb hentMine feil:", e.message); return []; });
  console.log(`test-arbeider hentMine (${mine.length}):`, mine.map((p) => p.name).join(" | "));
}
main().catch((e) => { console.error(e); process.exit(1); });
