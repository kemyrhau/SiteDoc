// ============================================================================
//  Prosjektnummer til visning (kort-id-spec § 12.3 E4, HM59).
//
//  Én regel for kolonnen «Prosjektnr» i attesteringen, oversiktsraden og
//  eksporten: firmaets interne nummer; mangler det, SD-nummeret; har prosjektet
//  slått av visning av SD-nummer, står feltet tomt.
// ============================================================================

export interface ProsjektnummerKilde {
  internalProjectNumber?: string | null;
  projectNumber?: string | null;
  /** `Project.visSiteDocNummer`. Utelatt = på (skjemaets standard). */
  visSiteDocNummer?: boolean | null;
}

export function visProsjektnummer(p: ProsjektnummerKilde | null | undefined): string {
  if (!p) return "";
  const intern = p.internalProjectNumber?.trim();
  if (intern) return intern;
  if (p.visSiteDocNummer === false) return "";
  return p.projectNumber?.trim() ?? "";
}
