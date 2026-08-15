import { devLogin, ApiKlient } from "./lib/api";
async function main(){
  const firma = await devLogin("test-firma@sitedoc.test");
  const api = new ApiKlient(firma.sessionToken);
  const proj = (await api.query<Array<{id:string;projectNumber:string|null;name:string}>>("prosjekt.hentMine")).find(p=>p.projectNumber==="AGENT-TEST-0001");
  console.log("agent projectId", proj?.id);
  const bygg = await api.query<Array<{id:string;name:string}>>("byggeplass.hentForProsjekt",{projectId:proj!.id}).catch(e=>{console.log("bygg feil",e.message);return[]});
  console.log("byggeplasser:", JSON.stringify(bygg));
}
main().catch(e=>{console.error(e);process.exit(1);});
