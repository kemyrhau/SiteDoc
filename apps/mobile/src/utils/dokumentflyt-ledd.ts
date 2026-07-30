/**
 * Delt helper for å bygge "ledd"-rader fra DokumentflytMedlem.
 * Brukes av Flytlinje (kompakt visuell visning i header + flyt-sheet) og
 * DokumentHandlingslinje (retningsnavn på primærhandling).
 *
 * Sekvensering (interim, portet fra `apps/web/src/lib/flyt-ledd.ts` 2026-07-30):
 * ledd sekvenseres på kanonisk ROLLE-RANG, IKKE på `steg`. I dagens faste rolle-
 * modell er `steg` ikke populert — alle medlemmer bærer default `steg=1`, så
 * steg-gruppering kollapset ALLE roller til ett eneste ledd (én chip overalt).
 * Når posisjonsutredningen gir distinkte `steg`, byttes sekvenseringen tilbake til `steg`.
 *
 * Denne mobil-kopien skal være atferds-identisk med web-`flyt-ledd.ts` (de er
 * separate kopier — hold dem i sync). Mobil-Ledd bærer i tillegg `farge` + full
 * `medlemmer`-liste som flytlinjen/flyt-sheeten trenger.
 */

export interface FlytMedlem {
  id?: string;
  rolle: string;
  steg: number;
  erHovedansvarlig?: boolean;
  faggruppe: { id: string; name: string; color?: string | null } | null;
  projectMember: { id?: string; user: { id: string; name: string | null } } | null;
  group: { id: string; name: string } | null;
}

export interface Ledd {
  steg: number;
  /** Leddets rolle (rolle-gruppen bærer rollen) — brukes til aktiv-ledd-utledning. */
  rolle: string;
  navn: string;
  aktivNavn: string;
  farge: string | null;
  gruppeIder: Set<string>;
  brukerIder: Set<string>;
  faggruppeIder: Set<string>;
  medlemmer: FlytMedlem[];
}

/**
 * Kanonisk rolle-rang: registrator → bestiller → utfører → godkjenner.
 * Ukjente roller får rang 99 (sorteres sist, stabilt på innsettingsrekkefølge).
 */
const ROLLE_RANG: Record<string, number> = {
  registrator: 1,
  bestiller: 2,
  utforer: 3,
  godkjenner: 4,
};

const rolleRang = (rolle: string): number => ROLLE_RANG[rolle] ?? 99;

/**
 * Hvilke roller kan holde ballen for en gitt status — i preferanserekkefølge.
 * Fallback KUN når recipient-identiteten ikke matcher et medlem. Grunnlag:
 * statusmaskinen i `isValidStatusTransition` (@sitedoc/shared).
 */
function forventetRolleKandidater(status: string): string[] {
  switch (status) {
    case "draft":
    case "cancelled":
      return ["bestiller", "registrator"];
    case "sent":
    case "received":
    case "in_progress":
      return ["utforer"];
    case "responded":
      return ["godkjenner", "bestiller", "registrator"];
    default:
      return [];
  }
}

/**
 * Grupper medlemmer per ROLLE og sekvensér på kanonisk rolle-rang (se fil-header).
 * Manglende roller utelates: en 2-rolle-flyt gir 2 ledd, en 4-rolle-flyt gir 4.
 * Flere medlemmer i samme rolle → ett ledd.
 */
export function byggLedd(medlemmer: FlytMedlem[]): Ledd[] {
  const rolleMap = new Map<string, FlytMedlem[]>();
  for (const m of medlemmer) {
    const liste = rolleMap.get(m.rolle) ?? [];
    liste.push(m);
    rolleMap.set(m.rolle, liste);
  }

  return [...rolleMap.entries()]
    .sort(([a], [b]) => rolleRang(a) - rolleRang(b))
    .map(([rolle, medl]) => {
      const faggruppeM = medl.find((m) => m.faggruppe);
      const gruppe = medl.find((m) => m.group);
      const person = medl.find((m) => m.projectMember?.user?.name);

      const navn = faggruppeM
        ? faggruppeM.faggruppe!.name
        : gruppe
          ? gruppe.group!.name
          : person?.projectMember?.user?.name ?? "?";

      let aktivNavn = navn;
      const personEllerGruppe = gruppe?.group?.name ?? person?.projectMember?.user?.name;
      const faggruppeNavn = faggruppeM?.faggruppe?.name;
      if (faggruppeNavn && personEllerGruppe && personEllerGruppe !== faggruppeNavn) {
        aktivNavn = `${faggruppeNavn} · ${personEllerGruppe}`;
      }

      return {
        // Beholdt for kompatibilitet; ledd-rekkefølgen styres nå av rolle-rang.
        steg: medl[0]?.steg ?? 0,
        // Rolle-gruppen bærer rollen — alle medlemmene i leddet deler rolle.
        rolle,
        navn,
        aktivNavn,
        farge: faggruppeM?.faggruppe?.color ?? null,
        gruppeIder: new Set(medl.filter((m) => m.group).map((m) => m.group!.id)),
        brukerIder: new Set(medl.filter((m) => m.projectMember).map((m) => m.projectMember!.user.id)),
        faggruppeIder: new Set(medl.filter((m) => m.faggruppe).map((m) => m.faggruppe!.id)),
        medlemmer: medl,
      };
    });
}

/**
 * Finn aktiv boks (hvilket rolle-ledd som holder ballen nå). -1 = terminal
 * (lukket/godkjent). Rolle-bevisst: resolver primært på recipient-IDENTITET,
 * deretter på forventet rolle for statusen.
 */
export function finnAktivtIndex(
  ledd: Ledd[],
  status: string,
  recipientUserId?: string | null,
  recipientGroupId?: string | null,
  bestillerUserId?: string,
): number {
  if (ledd.length === 0) return -1;
  if (status === "closed" || status === "approved") return -1;

  const kandidatRoller = forventetRolleKandidater(status);

  if (status === "draft" || status === "cancelled") {
    if (bestillerUserId) {
      const idx = ledd.findIndex((l) => l.brukerIder.has(bestillerUserId));
      if (idx !== -1) return idx;
    }
    // Kladd/tilbaketrukket ligger hos bestiller-ledden (ellers første ledd).
    return finnRolleIndex(ledd, kandidatRoller) ?? 0;
  }

  // 1) Recipient-identitet → rolle-ledden som faktisk holder dokumentet.
  // Når SAMME part fyller flere rolle-ledd (utfører=godkjenner), foretrekkes leddet
  // som er konsistent med forventet rolle for statusen; ved bare ett treff identisk med før.
  if (recipientGroupId) {
    const idx = velgLeddMedRolle(ledd, (l) => l.gruppeIder.has(recipientGroupId), kandidatRoller);
    if (idx !== -1) return idx;
  }
  if (recipientUserId) {
    const idx = velgLeddMedRolle(ledd, (l) => l.brukerIder.has(recipientUserId), kandidatRoller);
    if (idx !== -1) return idx;
  }

  // 2) Fallback: forventet rolle for statusen (ikke blindt siste ledd).
  const idx = finnRolleIndex(ledd, kandidatRoller);
  if (idx !== null) return idx;

  return ledd.length - 1;
}

/**
 * Indeksen til leddet som matcher recipient-predikatet. Ved treff på FLERE ledd
 * foretrekkes det som matcher en forventet rolle for statusen; ellers første treff.
 * -1 = ingen treff.
 */
function velgLeddMedRolle(
  ledd: Ledd[],
  match: (l: Ledd) => boolean,
  kandidatRoller: string[],
): number {
  const treff = ledd.flatMap((l, i) => (match(l) ? [i] : []));
  if (treff.length <= 1) return treff[0] ?? -1;
  for (const rolle of kandidatRoller) {
    const idx = treff.find((i) => ledd[i]!.rolle === rolle);
    if (idx !== undefined) return idx;
  }
  return treff[0]!;
}

/** Første ledd som matcher én av rolle-kandidatene (i preferanserekkefølge). */
function finnRolleIndex(ledd: Ledd[], kandidater: string[]): number | null {
  for (const rolle of kandidater) {
    const idx = ledd.findIndex((l) => l.rolle === rolle);
    if (idx !== -1) return idx;
  }
  return null;
}

export function forkort(tekst: string, maks: number): string {
  return tekst.length > maks ? tekst.slice(0, maks - 1) + "…" : tekst;
}
