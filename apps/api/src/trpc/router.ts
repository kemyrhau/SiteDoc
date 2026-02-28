import { router } from "./trpc";
import { prosjektRouter } from "../routes/prosjekt";
import { entrepriseRouter } from "../routes/entreprise";
import { sjekklisteRouter } from "../routes/sjekkliste";
import { oppgaveRouter } from "../routes/oppgave";
import { malRouter } from "../routes/mal";

export const appRouter = router({
  prosjekt: prosjektRouter,
  entreprise: entrepriseRouter,
  sjekkliste: sjekklisteRouter,
  oppgave: oppgaveRouter,
  mal: malRouter,
});

export type AppRouter = typeof appRouter;
