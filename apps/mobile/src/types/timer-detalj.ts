import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetTilleggLocal,
  sheetMachineLocal,
  sheetUtleggLocal,
  expenseCategoryLocal,
  lonnsartLocal,
  tilleggLocal,
  aktivitetLocal,
  externalCostObjectLocal,
  equipmentLocal,
  prosjektLocal,
} from "../db/schema";

export type Sedel = typeof dagsseddelLocal.$inferSelect;
export type TimerRad = typeof sheetTimerLocal.$inferSelect;
export type TilleggRad = typeof sheetTilleggLocal.$inferSelect;
export type MaskinRad = typeof sheetMachineLocal.$inferSelect;
export type UtleggRad = typeof sheetUtleggLocal.$inferSelect;
export type Utleggskategori = typeof expenseCategoryLocal.$inferSelect;
export type Lonnsart = typeof lonnsartLocal.$inferSelect;
export type Tillegg = typeof tilleggLocal.$inferSelect;
export type Aktivitet = typeof aktivitetLocal.$inferSelect;
export type Underprosjekt = typeof externalCostObjectLocal.$inferSelect;
export type Equipment = typeof equipmentLocal.$inferSelect;
export type Prosjekt = typeof prosjektLocal.$inferSelect;
