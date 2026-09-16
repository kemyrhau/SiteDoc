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

/* ------------------------------------------------------------------ */
/*  Søk + kollaps (ordre arkivmodal-sok-kollaps, fabels punkt E)       */
/* ------------------------------------------------------------------ */

/** En søkbar rad: `sok` er ferdig normalisert (lowercase navn [+ referanse]). */
export type SokbarRad = { id: string; sok: string };
export type SokbarGruppe<R extends SokbarRad> = { key: string; tittel: string; rader: R[] };
export type FoldetGruppe<R extends SokbarRad> = {
  key: string;
  tittel: string;
  rader: R[];
  apen: boolean;
};

/**
 * Filtrerer grupper på søk og avgjør hvilke som er utfoldet.
 *
 * 🔴 Krav 1: et treff i en SAMMENSLÅTT gruppe MÅ folde gruppen ut, ellers skjuler
 * søket sitt eget treff. Under søk er derfor alle grupper med treff åpne, og kollaps-
 * settet (økt-tilstanden) styrer bare når det IKKE søkes. Tomme grupper faller bort
 * under søk. Den ene linjen `apen = harSok ? true : …` er negativkontrollens mål:
 * fjernes `harSok ? true`, blir treff i sammenslåtte grupper usynlige (test rød).
 */
export function filtrerOgFold<R extends SokbarRad>(
  grupper: SokbarGruppe<R>[],
  sok: string,
  utfoldede: Set<string>,
): { synlige: FoldetGruppe<R>[]; antall: number; harSok: boolean } {
  const q = sok.trim().toLowerCase();
  const harSok = q.length > 0;
  const synlige = grupper
    .map((g) => {
      const rader = harSok ? g.rader.filter((r) => r.sok.includes(q)) : g.rader;
      const apen = harSok ? true : utfoldede.has(g.key);
      return { key: g.key, tittel: g.tittel, rader, apen };
    })
    .filter((g) => g.rader.length > 0);
  const antall = synlige.reduce((n, g) => n + g.rader.length, 0);
  return { synlige, antall, harSok };
}

/* ---- Gruppering: kollaps på STANDARD, kapittel som underetikett ---- */
/*
 * Kollapsnivået er STANDARDEN (`NS3420-K`, `NS3420-F`) — «kollaps kun etter én bokstav»
 * (Kenneth 16.09, ordre PR 2 Del C). Kapitlene (`KA`, `KB`) er statiske underetiketter
 * INNE i den utfoldede standarden, samme form som trestrukturen til venstre i
 * `SitedocArkivFane`. Tidligere kollapset modalen på standard+kapittel kombinert
 * (`NS3420-K · KA …`, «to bokstaver») — det er nettopp det Kenneth ba oss forlate.
 *
 * Rekkefølge (begge faner): kapitler i serverens `sortering`, malene innenfor et kapittel
 * i REFERANSE-rekkefølge (numerisk `localeCompare`, så `KC3.1` < `KC10`). Rører ikke
 * serverens `orderBy` — den strammes i en egen runde.
 */

/** Underkapittel-etiketten en rad bærer, så render kan skyte inn underoverskrifter.
 *  🔴 Kenneths ord: kodens `standard` = Kenneths «kapittel», kodens `kapittel` =
 *  Kenneths «underkapittel». Modellnavnene døpes ikke om; vokabularet gjelder flatene. */
export type MedKapittel = { kapittelKode: string | null; kapittelNavn: string | null };

/**
 * Terskel for underkapittel-overskrift (Kenneth 16.09): 3+ maler i SAMME underkapittel →
 * kollapsbar underkapittel-overskrift. Under 3 → malene står løst rett under kapittelet
 * (ingen overskrift). Kollaps kun på kapittel (standarden) ellers.
 */
export const UNDERKAPITTEL_TERSKEL = 3;

/**
 * En blokk i en utfoldet standard: enten løse maler (underkapittel < terskel, ingen
 * overskrift) eller et underkapittel med egen kollapsbar overskrift (>= terskel).
 */
export type MalBlokk<R> =
  | { type: "lose"; maler: R[] }
  | { type: "underkapittel"; key: string; kode: string; navn: string; maler: R[] };

/**
 * Deler en standards (allerede sorterte) maler i blokker. Malene er sortert kapittel-for-
 * kapittel (server-`sortering`) og på referanse innen kapitlet, så hvert underkapittel er én
 * sammenhengende sekvens. Et underkapittel med >= terskel maler får egen overskrift;
 * ellers slås malene inn i den løse blokken slik at referanserekkefølgen bevares på tvers.
 * Under søk kalles denne på de FILTRERTE malene → antallet (og dermed overskriften) følger
 * det som faktisk vises (Kenneth-vedtak c).
 */
export function byggUnderkapittelBlokker<R extends MedKapittel>(
  maler: R[],
  standardKey: string,
): MalBlokk<R>[] {
  const blokker: MalBlokk<R>[] = [];
  let i = 0;
  while (i < maler.length) {
    const kode = maler[i]!.kapittelKode;
    let j = i;
    while (j < maler.length && maler[j]!.kapittelKode === kode) j++;
    const sekvens = maler.slice(i, j);
    if (kode && sekvens.length >= UNDERKAPITTEL_TERSKEL) {
      blokker.push({
        type: "underkapittel",
        key: `${standardKey}:${kode}`,
        kode,
        navn: sekvens[0]!.kapittelNavn ?? kode,
        maler: sekvens,
      });
    } else {
      const forrige = blokker[blokker.length - 1];
      if (forrige && forrige.type === "lose") forrige.maler.push(...sekvens);
      else blokker.push({ type: "lose", maler: sekvens });
    }
    i = j;
  }
  return blokker;
}

/** Referanse-sammenligning: naturlig tallsortering innen én standard. */
function sammenlignReferanse(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

type KildeMalMini = { id: string; referanse: string };
type KildeKapittelMini<M extends KildeMalMini> = {
  kode: string;
  navn: string;
  maler: M[];
};
type KildeStandardMini<M extends KildeMalMini> = {
  kode: string;
  navn: string;
  kapitler: KildeKapittelMini<M>[];
};

/**
 * SiteDoc-arkivet: én gruppe PER STANDARD. Typefilteret (Krav 3, per flate) kjøres FØR
 * gruppering slik at et søk aldri kan omgå det — kapitler som tømmes av filteret bidrar
 * ikke. Malene bærer sin kapittel-etikett; de er sortert kapittel-for-kapittel
 * (server-`sortering`) og innen kapitlet på referanse. Standarder uten treff faller bort.
 */
export function byggSitedocGrupper<
  M extends { id: string; kategori: string; domene: string; referanse: string },
>(
  standarder: {
    kode: string;
    navn: string;
    kapitler: { kode: string; navn: string; maler: M[] }[];
  }[],
  fane: ArkivFane | undefined,
): { key: string; tittel: string; maler: (M & MedKapittel)[] }[] {
  const grupper: { key: string; tittel: string; maler: (M & MedKapittel)[] }[] = [];
  for (const s of standarder) {
    const maler: (M & MedKapittel)[] = [];
    for (const k of s.kapitler) {
      const relevante = k.maler
        .filter((m) => malHorerTilFane(fane, m))
        .sort((a, b) => sammenlignReferanse(a.referanse, b.referanse))
        .map((m) => ({ ...m, kapittelKode: k.kode, kapittelNavn: k.navn }));
      maler.push(...relevante);
    }
    if (maler.length === 0) continue;
    grupper.push({ key: s.kode, tittel: `${s.kode} — ${s.navn}`, maler });
  }
  return grupper;
}

/** Oppslag bibliotekMalId → standarden/kapitlet malen bor i, for å utlede firmamalens gruppe. */
export type KildeKapittel = {
  standardKode: string;
  standardNavn: string;
  standardSort: number;
  kapittelKode: string;
  kapittelNavn: string;
  kapittelSort: number;
  referanse: string;
};

export function byggKildeIndeks(
  standarder: KildeStandardMini<KildeMalMini>[],
): Map<string, KildeKapittel> {
  const indeks = new Map<string, KildeKapittel>();
  let standardSort = 0;
  for (const s of standarder) {
    let kapittelSort = 0;
    for (const k of s.kapitler) {
      for (const m of k.maler) {
        indeks.set(m.id, {
          standardKode: s.kode,
          standardNavn: s.navn,
          standardSort,
          kapittelKode: k.kode,
          kapittelNavn: k.navn,
          kapittelSort,
          referanse: m.referanse,
        });
      }
      kapittelSort++;
    }
    standardSort++;
  }
  return indeks;
}

export const EGENLAGDE_KEY = "__egenlagde__";

/**
 * Firma-grupper: SAMME modell som SiteDoc-fanen — én gruppe PER STANDARD.
 * `OrganizationTemplate` har ingen egen kapittelkobling, men når firmamalen er LÅNT
 * (`laantFraBibliotekMalId`) utledes standard + kapittel fra kilden via indeksen. Uten
 * lån-avstamning er malen «Egenlagd» (egen gruppe, sist, uten kapittel-etiketter).
 * Malene sorteres kapittel-for-kapittel og på referanse innen kapitlet.
 */
export function grupperFirmaMaler<
  M extends { id: string; laantFraBibliotekMalId: string | null },
>(
  firma: M[],
  indeks: Map<string, KildeKapittel>,
  egenlagdeTittel: string,
): { key: string; tittel: string; maler: (M & MedKapittel)[] }[] {
  type Post = { mal: M; kilde: KildeKapittel | undefined };
  const grupper = new Map<string, { key: string; tittel: string; sort: number; poster: Post[] }>();
  for (const fm of firma) {
    const kilde = fm.laantFraBibliotekMalId ? indeks.get(fm.laantFraBibliotekMalId) : undefined;
    const key = kilde ? kilde.standardKode : EGENLAGDE_KEY;
    let g = grupper.get(key);
    if (!g) {
      g = {
        key,
        tittel: kilde ? `${kilde.standardKode} — ${kilde.standardNavn}` : egenlagdeTittel,
        sort: kilde ? kilde.standardSort : Number.MAX_SAFE_INTEGER,
        poster: [],
      };
      grupper.set(key, g);
    }
    g.poster.push({ mal: fm, kilde });
  }
  return [...grupper.values()]
    .sort((a, b) => a.sort - b.sort)
    .map((g) => ({
      key: g.key,
      tittel: g.tittel,
      maler: g.poster
        .sort((a, b) => {
          const sa = a.kilde?.kapittelSort ?? 0;
          const sb = b.kilde?.kapittelSort ?? 0;
          if (sa !== sb) return sa - sb;
          return sammenlignReferanse(a.kilde?.referanse ?? "", b.kilde?.referanse ?? "");
        })
        .map(({ mal, kilde }) => ({
          ...mal,
          kapittelKode: kilde?.kapittelKode ?? null,
          kapittelNavn: kilde?.kapittelNavn ?? null,
        })),
    }));
}
