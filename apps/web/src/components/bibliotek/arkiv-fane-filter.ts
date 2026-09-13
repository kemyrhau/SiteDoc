/**
 * Typefilter for «Hent fra arkiv» — hvilke maler hører til flaten brukeren står på.
 *
 * SPEILER `faneWhere` (`apps/api/src/routes/firmamal.ts:64-77`) — den etablerte
 * L9-konvensjonen som firmaarkiv-fanen alt filtrerer server-side på. Samme spec, to akser
 * (`kategori` OG `domene` er uavhengige):
 *  - oppgave:    kategori = "oppgave"
 *  - hms:        domene = "hms"   (uansett kategori — HMS-avviksmaler er kategori="sjekkliste")
 *  - sjekkliste: kategori = "sjekkliste" OG domene ≠ "hms"
 *
 * Skilt ut i egen modul så negativkontrollen (ordre arkivmodal-typefilter, krav 2) kan
 * teste ren logikk uten å dra inn komponentens trpc/next-modulgraf.
 */

export type ArkivFane = "oppgave" | "sjekkliste" | "hms";

/**
 * Utelatt `fane` (prosjektsiden) = ingen filtrering (alle maler passerer).
 */
export function malHorerTilFane(
  fane: ArkivFane | undefined,
  mal: { kategori: string; domene: string },
): boolean {
  if (!fane) return true;
  switch (fane) {
    case "oppgave":
      return mal.kategori === "oppgave";
    case "hms":
      return mal.domene === "hms";
    case "sjekkliste":
      return mal.kategori === "sjekkliste" && mal.domene !== "hms";
  }
}
