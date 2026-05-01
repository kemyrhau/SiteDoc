import { router } from "../../trpc/trpc";
import { equipmentRouter } from "./equipment";
import { vegvesenKoRouter } from "./vegvesenKo";

export const maskinRouter = router({
  equipment: equipmentRouter,
  vegvesenKo: vegvesenKoRouter,
});
