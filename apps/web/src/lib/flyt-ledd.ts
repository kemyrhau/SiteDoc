/**
 * Delt kilde for flyt-ledd (2026-07-26).
 *
 * `byggLedd` + `finnAktivtIndex` lå tidligere duplisert i BÅDE `FlytIndikator.tsx`
 * og `DokumentHandlingsmeny.tsx` (fabel-flagg 1). Én kilde nå — begge importerer
 * herfra, ingen dobbel logikk. Ren utledning fra dokumentets FAKTISKE flyt:
 * antall ledd er dynamisk, aldri hardkodet.
 *
 * Sekvensering (interim, 2026-07-26): ledd sekvenseres på kanonisk ROLLE-RANG,
 * IKKE på `steg`. I dagens faste rolle-modell er `steg` ikke populert — alle
 * medlemmer bærer default `steg=1`, så steg-gruppering kollapset ALLE roller til
 * ett eneste ledd (én boks + variant-C overalt). Når posisjonsutredningen gir
 * distinkte `steg`, byttes sekvenseringen tilbake til `steg`.
 */

/**
 * Kanonisk rolle-rang: registrator → bestiller → utfører → godkjenner.
 * Speiler `ROLLE_PRIORITET` i `@sitedoc/shared` (utils/flytRolle.ts) — samme
 * rekkefølge, holdt lokalt for å unngå å eksponere shared-intern konstant.
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
 * Fallback KUN når recipient-identiteten ikke matcher et medlem (f.eks. en
 * faggruppe-flyt uten `projectMember`-rad). Grunnlag: statusmaskinen i
 * `isValidStatusTransition` (@sitedoc/shared). Erstatter det gamle «blindt siste
 * ledd»-fallbacket som ga variant-C (deaktivert Send) på HVERT dokument.
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

export interface FlytMedlem {
  id: string;
  rolle: string;
  steg: number;
  faggruppe: { id: string; name: string } | null;
  projectMember: { user: { id: string; name: string | null } } | null;
  group: { id: string; name: string } | null;
}

/** Ett medlem i et ledd — for medlems-hover (navn + rolle). */
export interface LeddMedlem {
  navn: string;
  rolle: string;
}

export interface Ledd {
  /** Kort visningsnavn (faggruppe, ellers gruppe, ellers person). */
  navn: string;
  /** Detaljert aktiv-visning: faggruppe · person/gruppe. */
  aktivNavn: string;
  /** Leddets rolle (rolle-gruppen bærer rollen) — brukes til rolle-etiketten. */
  rolle: string;
  /** Alle medlemmer i leddet (navn + rolle) for hover-listing. */
  medlemmer: LeddMedlem[];
  steg: number;
  gruppeIder: Set<string>;
  brukerIder: Set<string>;
  faggruppeIder: Set<string>;
}

/**
 * Grupper medlemmer per ROLLE og sekvensér på kanonisk rolle-rang.
 * (Interim — se fil-header: byttes til `steg`-gruppering når posisjonsutredningen
 * populerer distinkte `steg`.) Manglende roller utelates: en 2-rolle-flyt gir 2
 * ledd, en 4-rolle-flyt gir 4. Flere medlemmer i samme rolle → ett ledd (hover
 * ramser opp alle).
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
      const faggruppe = medl.find((m) => m.faggruppe);
      const gruppe = medl.find((m) => m.group);
      const person = medl.find((m) => m.projectMember?.user?.name);

      // Kort navn for inaktive bokser
      const navn = faggruppe
        ? faggruppe.faggruppe!.name
        : gruppe
          ? gruppe.group!.name
          : person?.projectMember?.user?.name ?? "?";

      // Detaljert navn for aktiv boks: faggruppe · person/gruppe
      let aktivNavn = navn;
      const personEllerGruppe = gruppe?.group?.name ?? person?.projectMember?.user?.name;
      const faggruppeNavn = faggruppe?.faggruppe?.name;
      if (faggruppeNavn && personEllerGruppe && personEllerGruppe !== faggruppeNavn) {
        aktivNavn = `${faggruppeNavn} · ${personEllerGruppe}`;
      }

      // Medlems-hover (Kenneth 2026-07-26): alle medlemmene i leddet, navn + rolle.
      const leddMedlemmer: LeddMedlem[] = medl.map((m) => ({
        navn: m.projectMember?.user?.name ?? m.group?.name ?? m.faggruppe?.name ?? "?",
        rolle: m.rolle,
      }));

      return {
        navn,
        aktivNavn,
        // Rolle-gruppen bærer rollen — alle medlemmene i leddet deler rolle.
        rolle,
        medlemmer: leddMedlemmer,
        // Beholdt for kompatibilitet; ledd-rekkefølgen styres nå av rolle-rang.
        steg: medl[0]?.steg ?? 0,
        gruppeIder: new Set(medl.filter((m) => m.group).map((m) => m.group!.id)),
        brukerIder: new Set(medl.filter((m) => m.projectMember).map((m) => m.projectMember!.user.id)),
        faggruppeIder: new Set(medl.filter((m) => m.faggruppe).map((m) => m.faggruppe!.id)),
      };
    });
}

/**
 * Finn aktiv boks (hvilket rolle-ledd som holder ballen nå). -1 = terminal
 * (lukket/godkjent). Rolle-bevisst: resolver primært på recipient-IDENTITET
 * (recipient settes serverside fra et medlems `projectMember`/`group`, så den
 * matcher nøyaktig ett rolle-ledd), deretter på forventet rolle for statusen.
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

  if (status === "draft" || status === "cancelled") {
    if (bestillerUserId) {
      const idx = ledd.findIndex((l) => l.brukerIder.has(bestillerUserId));
      if (idx !== -1) return idx;
    }
    // Kladd/tilbaketrukket ligger hos bestiller-ledden (ellers første ledd).
    return finnRolleIndex(ledd, forventetRolleKandidater(status)) ?? 0;
  }

  // 1) Recipient-identitet → rolle-ledden som faktisk holder dokumentet.
  if (recipientGroupId) {
    const idx = ledd.findIndex((l) => l.gruppeIder.has(recipientGroupId));
    if (idx !== -1) return idx;
  }
  if (recipientUserId) {
    const idx = ledd.findIndex((l) => l.brukerIder.has(recipientUserId));
    if (idx !== -1) return idx;
  }

  // 2) Fallback: forventet rolle for statusen (ikke blindt siste ledd).
  const idx = finnRolleIndex(ledd, forventetRolleKandidater(status));
  if (idx !== null) return idx;

  return ledd.length - 1;
}

/** Første ledd som matcher én av rolle-kandidatene (i preferanserekkefølge). */
function finnRolleIndex(ledd: Ledd[], kandidater: string[]): number | null {
  for (const rolle of kandidater) {
    const idx = ledd.findIndex((l) => l.rolle === rolle);
    if (idx !== -1) return idx;
  }
  return null;
}

/** Filtrer til aktiv boks + én nabo på hver side (kompakt/kollaps-modus). */
export function filtrerNaboer(
  ledd: Ledd[],
  aktivtIndex: number,
): Array<{ ledd: Ledd; originalIndex: number }> {
  // Hvis aktivtIndex er -1 (lukket/godkjent), vis de to siste
  if (aktivtIndex === -1) {
    return ledd.slice(-2).map((l, i) => ({ ledd: l, originalIndex: ledd.length - 2 + i }));
  }

  const resultat: Array<{ ledd: Ledd; originalIndex: number }> = [];
  const start = Math.max(0, aktivtIndex - 1);
  const slutt = Math.min(ledd.length - 1, aktivtIndex + 1);
  for (let i = start; i <= slutt; i++) {
    const l = ledd[i];
    if (l) resultat.push({ ledd: l, originalIndex: i });
  }
  return resultat;
}
