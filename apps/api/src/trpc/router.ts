import { router } from "./trpc";
import { prosjektRouter } from "../routes/prosjekt";
import { entrepriseRouter } from "../routes/entreprise";
import { sjekklisteRouter } from "../routes/sjekkliste";
import { oppgaveRouter } from "../routes/oppgave";
import { malRouter } from "../routes/mal";
import { bygningRouter } from "../routes/bygning";
import { tegningRouter } from "../routes/tegning";
import { arbeidsforlopRouter } from "../routes/arbeidsforlop";

export const appRouter = router({
  prosjekt: prosjektRouter,
  entreprise: entrepriseRouter,
  sjekkliste: sjekklisteRouter,
  oppgave: oppgaveRouter,
  mal: malRouter,
  bygning: bygningRouter,
  tegning: tegningRouter,
  arbeidsforlop: arbeidsforlopRouter,
});

export type AppRouter = typeof appRouter;
