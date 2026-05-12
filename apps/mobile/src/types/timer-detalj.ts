import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetTilleggLocal,
  sheetMachineLocal,
  lonnsartLocal,
  tilleggLocal,
  aktivitetLocal,
  externalCostObjectLocal,
  equipmentLocal,
} from "../db/schema";

export type Sedel = typeof dagsseddelLocal.$inferSelect;
export type TimerRad = typeof sheetTimerLocal.$inferSelect;
export type TilleggRad = typeof sheetTilleggLocal.$inferSelect;
export type MaskinRad = typeof sheetMachineLocal.$inferSelect;
export type Lonnsart = typeof lonnsartLocal.$inferSelect;
export type Tillegg = typeof tilleggLocal.$inferSelect;
export type Aktivitet = typeof aktivitetLocal.$inferSelect;
export type Underprosjekt = typeof externalCostObjectLocal.$inferSelect;
export type Equipment = typeof equipmentLocal.$inferSelect;
