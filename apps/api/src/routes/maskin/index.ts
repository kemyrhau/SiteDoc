import { router } from "../../trpc/trpc";
import { equipmentRouter } from "./equipment";
import { vegvesenKoRouter } from "./vegvesenKo";
import { ansvarligRouter } from "./ansvarlig";
import { importRouter } from "./import";

export const maskinRouter = router({
  equipment: equipmentRouter,
  vegvesenKo: vegvesenKoRouter,
  ansvarlig: ansvarligRouter,
  import: importRouter,
});
