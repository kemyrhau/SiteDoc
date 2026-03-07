import { router } from "./trpc";
import { prosjektRouter } from "../routes/prosjekt";
import { entrepriseRouter } from "../routes/entreprise";
import { sjekklisteRouter } from "../routes/sjekkliste";
import { oppgaveRouter } from "../routes/oppgave";
import { malRouter } from "../routes/mal";
import { bygningRouter } from "../routes/bygning";
import { tegningRouter } from "../routes/tegning";
import { arbeidsforlopRouter } from "../routes/arbeidsforlop";
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

export const appRouter = router({
  prosjekt: prosjektRouter,
  entreprise: entrepriseRouter,
  sjekkliste: sjekklisteRouter,
  oppgave: oppgaveRouter,
  mal: malRouter,
  bygning: bygningRouter,
  tegning: tegningRouter,
  arbeidsforlop: arbeidsforlopRouter,
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
});

export type AppRouter = typeof appRouter;
