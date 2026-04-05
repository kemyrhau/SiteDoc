import { router } from "./trpc";
import { prosjektRouter } from "../routes/prosjekt";
import { entrepriseRouter } from "../routes/entreprise";
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

export const appRouter = router({
  prosjekt: prosjektRouter,
  entreprise: entrepriseRouter,
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
});

export type AppRouter = typeof appRouter;
