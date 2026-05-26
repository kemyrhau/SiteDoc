import { router } from "./trpc";
import { prosjektRouter } from "../routes/prosjekt";
import { faggruppeRouter } from "../routes/faggruppe";
import { sjekklisteRouter } from "../routes/sjekkliste";
import { oppgaveRouter } from "../routes/oppgave";
import { malRouter } from "../routes/mal";
import { byggeplassRouter } from "../routes/byggeplass";
import { tegningRouter } from "../routes/tegning";
import { dokumentflytRouter } from "../routes/dokumentflyt";
import { mappeRouter } from "../routes/mappe";
import { medlemRouter } from "../routes/medlem";
import { mobilAuthRouter } from "../routes/mobilAuth";
import { gruppeRouter } from "../routes/gruppe";
import { invitasjonRouter } from "../routes/invitasjon";
import { bildeRouter } from "../routes/bilde";
import { vaerRouter } from "../routes/vaer";
import { modulRouter } from "../routes/modul";
import { hmsRouter } from "../routes/hms";
import { organisasjonRouter } from "../routes/organisasjon";
import { adminRouter } from "../routes/admin";
import { punktskyRouter } from "../routes/punktsky";
import { mengdeRouter } from "../routes/mengde";
import { ftdSokRouter } from "../routes/ftdSok";
import { kontraktRouter } from "../routes/kontrakt";
import { aiSokRouter } from "../routes/aiSok";
import { brukerRouter } from "../routes/bruker";
import { psiRouter } from "../routes/psi";
import { bibliotekRouter } from "../routes/bibliotek";
import { omradeRouter } from "../routes/omrade";
import { kontrollplanRouter } from "../routes/kontrollplan";
import { maskinRouter } from "../routes/maskin";
import { avdelingRouter } from "../routes/avdeling";
import { kompetansetypeRouter } from "../routes/kompetansetype";
import { kompetanseRouter } from "../routes/kompetanse";
import { timerRouter } from "../routes/timer";
import { eksternKostObjektRouter } from "../routes/eksternKostObjekt";
import { vareKategoriRouter } from "../routes/vareKategori";
import { vareRouter } from "../routes/vare";
import { vareforbrukRouter } from "../routes/vareforbruk";
import { vareImportRouter } from "../routes/vareImport";
import { firmaIntegrasjonRouter } from "../routes/firma-integrasjon";
import { firmaRouter } from "../routes/firma";


export const appRouter = router({
  prosjekt: prosjektRouter,
  faggruppe: faggruppeRouter,
  entreprise: faggruppeRouter, // bakoverkompatibel alias (mobil)
  sjekkliste: sjekklisteRouter,
  oppgave: oppgaveRouter,
  mal: malRouter,
  bygning: byggeplassRouter, // bakoverkompatibel nøkkel (1 uke)
  tegning: tegningRouter,
  dokumentflyt: dokumentflytRouter,
  mappe: mappeRouter,
  medlem: medlemRouter,
  mobilAuth: mobilAuthRouter,
  gruppe: gruppeRouter,
  invitasjon: invitasjonRouter,
  bilde: bildeRouter,
  vaer: vaerRouter,
  modul: modulRouter,
  hms: hmsRouter,
  organisasjon: organisasjonRouter,
  admin: adminRouter,
  punktsky: punktskyRouter,
  mengde: mengdeRouter,
  ftdSok: ftdSokRouter,
  kontrakt: kontraktRouter,
  aiSok: aiSokRouter,
  bruker: brukerRouter,
  psi: psiRouter,
  bibliotek: bibliotekRouter,
  omrade: omradeRouter,
  kontrollplan: kontrollplanRouter,
  maskin: maskinRouter,
  avdeling: avdelingRouter,
  kompetansetype: kompetansetypeRouter,
  kompetanse: kompetanseRouter,
  timer: timerRouter,
  eksternKostObjekt: eksternKostObjektRouter,
  vareKategori: vareKategoriRouter,
  vare: vareRouter,
  vareforbruk: vareforbrukRouter,
  vareImport: vareImportRouter,
  firmaIntegrasjon: firmaIntegrasjonRouter,
  firma: firmaRouter,
});

export type AppRouter = typeof appRouter;
