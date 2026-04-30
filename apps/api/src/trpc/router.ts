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

});

export type AppRouter = typeof appRouter;
