import { devLogin, ApiKlient } from "./lib/api";
type Medlem = { id: string; userId: string; user: { email: string | null; name: string | null }; role: string; faggruppeKoblinger?: Array<{ faggruppeId: string; faggruppe?: { name: string } }> };
async function main() {
  const { sessionToken } = await devLogin("test-admin@sitedoc.test");
  const api = new ApiKlient(sessionToken);
  const projectId = "f6dcb81f-802c-415b-a6c6-a8fdf7f9710f";
  const medlemmer = await api.query<Medlem[]>("medlem.hentForProsjekt", { projectId });
  console.log(`B12 medlemmer: ${medlemmer.length}`);
  for (const m of medlemmer) {
    const fag = (m.faggruppeKoblinger ?? []).map((k) => k.faggruppe?.name ?? k.faggruppeId.slice(0,6)).join(", ") || "—";
    console.log(`  ${m.user?.email ?? m.userId} | role=${m.role} | pmId=${m.id} | faggrupper: ${fag}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
