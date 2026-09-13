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

/* ---- Gruppering: SAMME modell i begge faner (standard → kapittel) ---- */

type KildeMalMini = { id: string; referanse: string };
type KildeKapittelMini<M extends KildeMalMini> = {
  id: string;
  kode: string;
  navn: string;
  maler: M[];
};
type KildeStandardMini<M extends KildeMalMini> = {
  kode: string;
  kapitler: KildeKapittelMini<M>[];
};

/**
 * SiteDoc-arkivet: nøstet standard → kapittel finnes i dataene. Typefilteret (Krav 3,
 * per flate) kjøres FØR gruppering slik at et søk aldri kan omgå det — kapitler som
 * tømmes av filteret faller bort. Rekkefølgen følger kildens.
 */
export function byggSitedocGrupper<
  M extends { id: string; kategori: string; domene: string },
>(
  standarder: {
    kode: string;
    kapitler: { id: string; kode: string; navn: string; maler: M[] }[];
  }[],
  fane: ArkivFane | undefined,
): { key: string; tittel: string; maler: M[] }[] {
  return standarder.flatMap((s) =>
    s.kapitler
      .map((k) => ({ k, maler: k.maler.filter((m) => malHorerTilFane(fane, m)) }))
      .filter(({ maler }) => maler.length > 0)
      .map(({ k, maler }) => ({
        key: k.id,
        tittel: `${s.kode} · ${k.kode} ${k.navn}`,
        maler,
      })),
  );
}

/** Oppslag bibliotekMalId → kapitlet malen bor i, for å utlede firmamalens gruppe fra kilden. */
export type KildeKapittel = { kapittelId: string; tittel: string; referanse: string; sort: number };

export function byggKildeIndeks(
  standarder: KildeStandardMini<KildeMalMini>[],
): Map<string, KildeKapittel> {
  const indeks = new Map<string, KildeKapittel>();
  let sort = 0;
  for (const s of standarder) {
    for (const k of s.kapitler) {
      const tittel = `${s.kode} · ${k.kode} ${k.navn}`;
      const kapSort = sort++;
      for (const m of k.maler) {
        indeks.set(m.id, { kapittelId: k.id, tittel, referanse: m.referanse, sort: kapSort });
      }
    }
  }
  return indeks;
}

export const EGENLAGDE_KEY = "__egenlagde__";

/**
 * Firma-grupper: SAMME modell som SiteDoc-fanen (standard → kapittel). `OrganizationTemplate`
 * har ingen egen kapittelkobling, men når firmamalen er LÅNT (`laantFraBibliotekMalId`)
 * kan kapitlet utledes fra kilden via indeksen. Uten lån-avstamning er malen «Egenlagd».
 * Kapittel-grupper i kildens rekkefølge, «Egenlagde» sist.
 */
export function grupperFirmaMaler<
  M extends { id: string; laantFraBibliotekMalId: string | null },
>(
  firma: M[],
  indeks: Map<string, KildeKapittel>,
  egenlagdeTittel: string,
): { key: string; tittel: string; maler: M[] }[] {
  const grupper = new Map<string, { key: string; tittel: string; sort: number; maler: M[] }>();
  for (const fm of firma) {
    const kilde = fm.laantFraBibliotekMalId ? indeks.get(fm.laantFraBibliotekMalId) : undefined;
    const key = kilde ? kilde.kapittelId : EGENLAGDE_KEY;
    let g = grupper.get(key);
    if (!g) {
      g = {
        key,
        tittel: kilde ? kilde.tittel : egenlagdeTittel,
        sort: kilde ? kilde.sort : Number.MAX_SAFE_INTEGER,
        maler: [],
      };
      grupper.set(key, g);
    }
    g.maler.push(fm);
  }
  return [...grupper.values()]
    .sort((a, b) => a.sort - b.sort)
    .map(({ key, tittel, maler }) => ({ key, tittel, maler }));
}
