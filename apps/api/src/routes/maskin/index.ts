import { router } from "../../trpc/trpc";
import { equipmentRouter } from "./equipment";

export const maskinRouter = router({
  equipment: equipmentRouter,
});
