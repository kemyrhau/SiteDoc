import { router } from "../../trpc/trpc";
import { onboardingRouter } from "./onboarding";
import { lonnsartRouter } from "./lonnsart";
import { aktivitetRouter } from "./aktivitet";
import { tilleggRouter } from "./tillegg";
import { dagsseddelRouter } from "./dagsseddel";
import { rapportRouter } from "./rapport";

export const timerRouter = router({
  onboarding: onboardingRouter,
  lonnsart: lonnsartRouter,
  aktivitet: aktivitetRouter,
  tillegg: tilleggRouter,
  dagsseddel: dagsseddelRouter,
  rapport: rapportRouter,
});
