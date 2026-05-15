import { router } from "../../trpc/trpc";
import { kalenderRouter } from "./kalender";

export const firmaRouter = router({
  kalender: kalenderRouter,
});
