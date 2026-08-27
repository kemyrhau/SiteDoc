"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ALLE_RADTYPER, type DetaljRadType, type Gruppering } from "@sitedoc/shared";
import { Spinner } from "@sitedoc/ui";
import { useFirma } from "@/kontekst/firma-kontekst";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";

type StatusFordeling = { kladd: number; sent: number; attestert: number };

type AnsattRad = {
  userId: string;
  navn: string | null;
  email: string;
  ansattnummer: string | null;
  totalTimer: number;
  antallSedler: number;
  sistRegistrert: string | null;
  statusFordeling: StatusFordeling;
  perProsjekt: Array<{
    prosjektId: string;
    prosjektNavn: string;
    prosjektNummer: string | null;
    internProsjektNummer: string | null;
    timer: number;
  }>;
  perDag: Array<{ dato: string; timer: number }>;
};

type RapportResultat = {
  ansatte: AnsattRad[];
  prosjekter: Array<{ id: string; navn: string; nummer: string | null }>;
  totalTimer: number;
  antallSedler: number;
  statusFordeling: StatusFordeling;
};

type SortKolonne =
  | "navn"
  | "ansattnummer"
  | "totalTimer"
  | "antallSedler"
  | "sistRegistrert";
type SortRetning = "asc" | "desc";

type DetaljVy = "dag" | "uke";

type Mottaker = "intern" | "ekstern";
type Orientering = "auto" | "staaende" | "liggende";
type Topptekst = { linjer: string[] } | null;

/** Configen en lagret utskriftsmal bærer (configVersion 2, fase 4). `format`
 *  (xlsx|pdf) = filtype (v1, urørt); `orientering` (auto|staaende|liggende) =
 *  PDF-sideformat (eget felt, ikke omdøping av `format`). */
type MalConfig = {
  radTyper: DetaljRadType[];
  format: "xlsx" | "pdf";
  mottaker: Mottaker;
  gruppering: Gruppering;
  orientering: Orientering;
  topptekst: Topptekst;
};

/** En lagret mal slik list-endepunktet returnerer den (config er Json). */
type LagretMal = { id: string; name: string; eierId: string | null; config: unknown };

/** Tolk mal-config defensivt: ukjente/tomme felt faller tilbake til v1-default
 *  (alt · Excel · intern · ingen · auto · ingen topptekst), så en configVersion-1-
 *  rad leses uten atferdsendring og en fremtidig form aldri krasjer klienten. */
function lesConfig(config: unknown): MalConfig {
  const c = (config ?? {}) as {
    radTyper?: unknown;
    format?: unknown;
    mottaker?: unknown;
    gruppering?: unknown;
    orientering?: unknown;
    topptekst?: unknown;
  };
  const radTyper = Array.isArray(c.radTyper)
    ? c.radTyper.filter((r): r is DetaljRadType =>
        ALLE_RADTYPER.includes(r as DetaljRadType),
      )
    : [];
  const tp = c.topptekst as { linjer?: unknown } | null | undefined;
  const linjer =
    tp && Array.isArray(tp.linjer)
      ? tp.linjer.filter((l): l is string => typeof l === "string")
      : null;
  return {
    radTyper: radTyper.length > 0 ? radTyper : [...ALLE_RADTYPER],
    format: c.format === "pdf" ? "pdf" : "xlsx",
    mottaker: c.mottaker === "ekstern" ? "ekstern" : "intern",
    gruppering:
      c.gruppering === "ansatt" || c.gruppering === "prosjekt" ? c.gruppering : "ingen",
    orientering:
      c.orientering === "staaende" || c.orientering === "liggende"
        ? c.orientering
        : "auto",
    topptekst: linjer && linjer.length > 0 ? { linjer } : null,
  };
}

/** Innebygd mal (KODE, ikke DB-rad) — alltid tilgjengelig, kan ikke slettes.
 *  «Rediger» åpner redigereren forhåndsutfylt som grunnlag for «Lagre som ny». */
type InnebygdMal = { navn: string; config: MalConfig };

/** Innebygde maler etter fase 4: Full eksport · Lønnsgrunnlag (ansatt-gruppert) ·
 *  Fakturagrunnlag (ekstern · prosjekt · liggende · firmatopp). Bygges med t() fordi
 *  Fakturagrunnlag-toppteksten bærer det oversatte malnavnet som dokumenttittel. */
function byggInnebygde(t: (k: string) => string): InnebygdMal[] {
  return [
    {
      navn: t("firma.timer.rapport.maler.fullEksport"),
      config: {
        radTyper: [...ALLE_RADTYPER],
        format: "xlsx",
        mottaker: "intern",
        gruppering: "ingen",
        orientering: "auto",
        topptekst: null,
      },
    },
    {
      navn: t("firma.timer.rapport.maler.lonnsgrunnlag"),
      config: {
        radTyper: [...ALLE_RADTYPER],
        format: "xlsx",
        mottaker: "intern",
        gruppering: "ansatt",
        orientering: "auto",
        topptekst: null,
      },
    },
    {
      navn: t("firma.timer.rapport.maler.fakturagrunnlag"),
      config: {
        radTyper: [...ALLE_RADTYPER],
        format: "pdf",
        mottaker: "ekstern",
        gruppering: "prosjekt",
        orientering: "liggende",
        // {firma}/{periode}/{prosjekt} flettes server-side; midtlinjen er dokumenttittelen.
        topptekst: {
          linjer: [
            "{firma}",
            t("firma.timer.rapport.maler.fakturagrunnlag"),
            "{periode}",
            "{prosjekt}",
          ],
        },
      },
    },
  ];
}

function isoUkeNokkel(datoStr: string): string {
  const d = new Date(datoStr);
  const year = d.getUTCFullYear();
  const dag = new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate()));
  // ISO 8601 ukeberegning
  const dayNum = (dag.getUTCDay() + 6) % 7;
  dag.setUTCDate(dag.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(dag.getUTCFullYear(), 0, 4));
  const diff = (dag.getTime() - firstThursday.getTime()) / 86400000;
  const uke = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${dag.getUTCFullYear()}-U${String(uke).padStart(2, "0")}`;
}

function formaterTimer(t: number): string {
  return t.toFixed(2).replace(/\.?0+$/, "");
}

function førsteOgSisteIMåneden(): { fra: string; til: string } {
  const nå = new Date();
  const fra = new Date(nå.getFullYear(), nå.getMonth(), 1);
  const til = new Date(nå.getFullYear(), nå.getMonth() + 1, 0);
  return {
    fra: fra.toISOString().slice(0, 10),
    til: til.toISOString().slice(0, 10),
  };
}

/** Last ned base64-PDF fra pdfEksport-prosedyren. */
function lastNedBase64(base64: string, filnavn: string, mime: string): void {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Alle oversatte PDF-overskrifter/etiketter (1:1 med teksterSchema server-side).
 *  PDF-overskrifter er synlige strenger → gjennom t(), som arknavnene. */
function byggPdfTekster(
  t: (key: string) => string,
  statusEtiketter: Record<string, string>,
): {
  [K in
    | "dokumentTittel" | "periode" | "prosjekt" | "ansatt" | "alle" | "ingenData" | "sum"
    | "sammendrag" | "kolAnsattnr" | "kolTotalTimer" | "kolSedler" | "kolSistRegistrert"
    | "kolKladd" | "kolSent" | "kolAttestert" | "detaljer" | "subtotal" | "kolDato" | "kolType"
    | "kolBetegnelse" | "kolAktivitet" | "kolFra" | "kolTil" | "kolTimer" | "kolMaskintimer"
    | "kolAntall" | "kolBelop" | "kolMengde" | "kolEnhet" | "kolBeskrivelse" | "kolStatus"
    | "typeTimer" | "typeMaskin" | "typeTillegg" | "typeUtlegg" | "maskinUtenTimerad"
    | "maskinIkkeEksporterbar"]: string;
} & { statusEtiketter: Record<string, string> } {
  const k = (s: string): string => t(`firma.timer.rapport.pdf.${s}`);
  return {
    dokumentTittel: k("dokumentTittel"),
    periode: k("periode"),
    prosjekt: k("prosjekt"),
    ansatt: k("ansatt"),
    alle: k("alle"),
    ingenData: k("ingenData"),
    sum: k("sum"),
    sammendrag: k("sammendrag"),
    kolAnsattnr: k("kolAnsattnr"),
    kolTotalTimer: k("kolTotalTimer"),
    kolSedler: k("kolSedler"),
    kolSistRegistrert: k("kolSistRegistrert"),
    kolKladd: k("kolKladd"),
    kolSent: k("kolSent"),
    kolAttestert: k("kolAttestert"),
    detaljer: k("detaljer"),
    subtotal: k("subtotal"),
    kolDato: k("kolDato"),
    kolType: k("kolType"),
    kolBetegnelse: k("kolBetegnelse"),
    kolAktivitet: k("kolAktivitet"),
    kolFra: k("kolFra"),
    kolTil: k("kolTil"),
    kolTimer: k("kolTimer"),
    kolMaskintimer: k("kolMaskintimer"),
    kolAntall: k("kolAntall"),
    kolBelop: k("kolBelop"),
    kolMengde: k("kolMengde"),
    kolEnhet: k("kolEnhet"),
    kolBeskrivelse: k("kolBeskrivelse"),
    kolStatus: k("kolStatus"),
    typeTimer: k("typeTimer"),
    typeMaskin: k("typeMaskin"),
    typeTillegg: k("typeTillegg"),
    typeUtlegg: k("typeUtlegg"),
    maskinUtenTimerad: k("maskinUtenTimerad"),
    maskinIkkeEksporterbar: k("maskinIkkeEksporterbar"),
    statusEtiketter,
  };
}

export default function TimerRapportSide() {
  const { t } = useTranslation();
  const { valgtFirma, kanAdministrereFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const harTimer = valgtFirma?.aktiveFirmamoduler.includes("timer") ?? false;
  const utils = trpc.useUtils();

  const standardPeriode = useMemo(() => førsteOgSisteIMåneden(), []);
  const [fra, setFra] = useState(standardPeriode.fra);
  const [til, setTil] = useState(standardPeriode.til);
  const [valgtProsjektId, setValgtProsjektId] = useState<string>("");
  const [valgtAnsattId, setValgtAnsattId] = useState<string>("");
  const [sortKolonne, setSortKolonne] = useState<SortKolonne>("totalTimer");
  const [sortRetning, setSortRetning] = useState<SortRetning>("desc");
  const [ekspandertUserId, setEkspandertUserId] = useState<string | null>(null);
  const [detaljVy, setDetaljVy] = useState<DetaljVy>("dag");
  const [eksportÅpen, setEksportÅpen] = useState(false);
  const [eksporterer, setEksporterer] = useState(false);
  // Tilpasset-modalen ER redigereren (fase 3): radvalg + format + navn + lagring.
  // `redigererMalId` = null → ny/innebygd (kun «Lagre som ny»); satt → en lagret
  // mal åpnet for redigering (får «Lagre»/«Slett»). valgteRadTyper+format er den
  // arbeidende configen; malNavn navnefeltet.
  const [tilpassetÅpen, setTilpassetÅpen] = useState(false);
  const [valgteRadTyper, setValgteRadTyper] = useState<DetaljRadType[]>([...ALLE_RADTYPER]);
  const [tilpassetFormat, setTilpassetFormat] = useState<"xlsx" | "pdf">("xlsx");
  // Fase 4-akser (config v2): mottaker · gruppering · orientering · topptekst.
  // Toppteksten redigeres som flerlinjet tekst (én linje pr. rad) og konverteres
  // til/fra `{linjer}` ved lagring/lasting.
  const [mottaker, setMottaker] = useState<Mottaker>("intern");
  const [gruppering, setGruppering] = useState<Gruppering>("ingen");
  const [orientering, setOrientering] = useState<Orientering>("auto");
  const [topptekstTekst, setTopptekstTekst] = useState("");
  const [malNavn, setMalNavn] = useState("");
  const [redigererMalId, setRedigererMalId] = useState<string | null>(null);
  // 1c: try/finally uten catch svelget kastet → «virker ikke» uten spor. Vis
  // feilen til brukeren så den blir konkret (og logg for feilsøking).
  const [eksportFeil, setEksportFeil] = useState<string | null>(null);

  const { data: prosjekter } = trpc.timer.rapport.hentFirmaProsjekterMedTimer.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId && harTimer },
  );
  const { data: ansatte } = trpc.timer.rapport.hentFirmaAnsatteMedTimer.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId && harTimer },
  );
  const { data: rapport, isLoading } = trpc.timer.rapport.firmaPeriodeRapport.useQuery(
    {
      organizationId: orgId!,
      fra,
      til,
      prosjektId: valgtProsjektId || undefined,
      ansattId: valgtAnsattId || undefined,
    },
    { enabled: !!orgId && harTimer },
  );

  // Lagrede utskriftsmaler (fase 3): firmaets (eierId=null) + kallerens egne
  // personlige. Serveren filtrerer bort andres personlige.
  const { data: maler } = trpc.timer.eksportOppsett.list.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId && harTimer },
  );
  const lagreMal = trpc.timer.eksportOppsett.lagre.useMutation();
  const oppdaterMal = trpc.timer.eksportOppsett.oppdater.useMutation();
  const slettMal = trpc.timer.eksportOppsett.slett.useMutation();

  // Cast bryter tRPC-ens dype Json-inferens på `config` (TS2589) — LagretMal
  // bærer config som `unknown`, som er den formen klienten uansett tolker via lesConfig.
  const malerListe = (maler ?? []) as unknown as LagretMal[];
  const mineMalene = malerListe.filter((m) => m.eierId !== null);
  const firmaMalene = malerListe.filter((m) => m.eierId === null);

  // Innebygde maler (kode) — bygges med t() for oversatt navn + Fakturagrunnlag-topptekst.
  const innebygde = useMemo(() => byggInnebygde(t), [t]);

  // Viktig: useMemo MÅ kalles før alle conditional returns under,
  // ellers brytes Rules of Hooks (React error #310 — flagget i memory
  // som tidligere ftd-økonomi-bug 2026-04).
  const rapportData = (rapport ?? null) as RapportResultat | null;
  const sorterteAnsatte = useMemo(() => {
    if (!rapportData) return [];
    const arr = [...rapportData.ansatte];
    arr.sort((a, b) => {
      const dir = sortRetning === "asc" ? 1 : -1;
      switch (sortKolonne) {
        case "navn":
          return ((a.navn ?? a.email).localeCompare(b.navn ?? b.email)) * dir;
        case "ansattnummer":
          return ((a.ansattnummer ?? "").localeCompare(b.ansattnummer ?? "")) * dir;
        case "totalTimer":
          return (a.totalTimer - b.totalTimer) * dir;
        case "antallSedler":
          return (a.antallSedler - b.antallSedler) * dir;
        case "sistRegistrert": {
          const ad = a.sistRegistrert ? new Date(a.sistRegistrert).getTime() : 0;
          const bd = b.sistRegistrert ? new Date(b.sistRegistrert).getTime() : 0;
          return (ad - bd) * dir;
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [rapportData, sortKolonne, sortRetning]);

  if (!orgId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!harTimer) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-base font-semibold text-amber-900">
          {t("firma.timer.rapport.modulIkkeAktivert.tittel")}
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          {t("firma.timer.rapport.modulIkkeAktivert.beskrivelse")}
        </p>
      </div>
    );
  }

  function settHurtigPeriode(type: "denne-uken" | "forrige-uken" | "denne-maaneden" | "forrige-maaneden") {
    const nå = new Date();
    let fraDato: Date;
    let tilDato: Date;
    if (type === "denne-uken") {
      const dag = (nå.getDay() + 6) % 7;
      fraDato = new Date(nå);
      fraDato.setDate(nå.getDate() - dag);
      tilDato = new Date(fraDato);
      tilDato.setDate(fraDato.getDate() + 6);
    } else if (type === "forrige-uken") {
      const dag = (nå.getDay() + 6) % 7;
      fraDato = new Date(nå);
      fraDato.setDate(nå.getDate() - dag - 7);
      tilDato = new Date(fraDato);
      tilDato.setDate(fraDato.getDate() + 6);
    } else if (type === "denne-maaneden") {
      fraDato = new Date(nå.getFullYear(), nå.getMonth(), 1);
      tilDato = new Date(nå.getFullYear(), nå.getMonth() + 1, 0);
    } else {
      fraDato = new Date(nå.getFullYear(), nå.getMonth() - 1, 1);
      tilDato = new Date(nå.getFullYear(), nå.getMonth(), 0);
    }
    setFra(fraDato.toISOString().slice(0, 10));
    setTil(tilDato.toISOString().slice(0, 10));
  }

  function bytteSort(kolonne: SortKolonne) {
    if (sortKolonne === kolonne) {
      setSortRetning(sortRetning === "asc" ? "desc" : "asc");
    } else {
      setSortKolonne(kolonne);
      setSortRetning("desc");
    }
  }

  /** Utforming-config for en eksport. Bygges fra en mal (brukMal), fra modalen
   *  («Eksporter uten å lagre») eller som full-default (de direkte format-knappene). */
  const FULL_CONFIG: MalConfig = {
    radTyper: [...ALLE_RADTYPER],
    format: "xlsx",
    mottaker: "intern",
    gruppering: "ingen",
    orientering: "auto",
    topptekst: null,
  };

  /** `utFormat` = filtypen som produseres (csv|xlsx|pdf). `cfg` bærer fase 4-aksene
   *  (radvalg · mottaker · gruppering · orientering · topptekst). Excel og PDF følger
   *  SAMME cfg. CSV er sammendrag (respekterer kun mottaker). */
  async function håndterEksport(
    utFormat: "csv" | "xlsx" | "pdf",
    cfg: MalConfig = FULL_CONFIG,
  ) {
    if (!rapportData || rapportData.ansatte.length === 0) return;
    const radTyper = cfg.radTyper;
    setEksportÅpen(false);
    setEksportFeil(null);
    setEksporterer(true);
    try {
      if (utFormat === "pdf") {
        // PDF bygges SERVER-side (samme HTML→PDF-motor som arkiv). Klienten
        // sender oversatte overskrifter/filnavn + radvalg + status-etiketter inn
        // (ingen server-i18n); serveren gjenbruker firmaPeriodeRapport + detaljEksport.
        // Status-etikett-mappen kommer fra SAMME kilde som Excel (lazy — unngå
        // exceljs-bundle i initial load; helperen selv drar ikke inn exceljs).
        const { byggStatusEtiketter } = await import("@/lib/timer-rapport-eksport");
        const res = await utils.timer.rapport.pdfEksport.fetch({
          organizationId: orgId!,
          fra,
          til,
          prosjektId: valgtProsjektId || undefined,
          ansattId: valgtAnsattId || undefined,
          firmanavn: valgtFirma?.name ?? "firma",
          filnavn: `SiteDoc-${t("firma.timer.rapport.pdf.filnavn")}-${fra}-${til}.pdf`,
          footerGenerert: t("firma.timer.rapport.pdf.footerGenerert", {
            dato: new Date().toLocaleDateString("nb-NO"),
          }),
          footerSide: t("firma.timer.rapport.pdf.footerSide"),
          footerAv: t("firma.timer.rapport.pdf.footerAv"),
          radTyper,
          // Fase 4-akser. topptekst-linjene sendes rå (med {firma}/{periode}/
          // {prosjekt}) — serveren flettes dem fra rapportfilteret.
          mottaker: cfg.mottaker,
          gruppering: cfg.gruppering,
          orientering: cfg.orientering,
          topptekstLinjer: cfg.topptekst?.linjer,
          tekster: byggPdfTekster(t, byggStatusEtiketter(t)),
        });
        lastNedBase64(res.pdf, res.filnavn, "application/pdf");
        return;
      }

      const mod = await import("@/lib/timer-rapport-eksport");
      // Aggregatet til eksporten hentes med kunEksporterbare=true — time-summene
      // ekskluderer lønnsarter merket skalEksporteres=false, så aggregat-arkene
      // matcher detalj-arkene. Skjermens `rapportData` (alle timer) brukes kun
      // som «har data»-vakt over; eksporten skal ikke speile ikke-eksporterbare.
      const eksportRapport = await utils.timer.rapport.firmaPeriodeRapport.fetch({
        organizationId: orgId!,
        fra,
        til,
        prosjektId: valgtProsjektId || undefined,
        ansattId: valgtAnsattId || undefined,
        kunEksporterbare: true,
      });
      const input = {
        ansatte: eksportRapport.ansatte.map((a) => ({
          ...a,
          sistRegistrert:
            typeof a.sistRegistrert === "string"
              ? a.sistRegistrert
              : a.sistRegistrert
                ? new Date(a.sistRegistrert).toISOString()
                : null,
        })),
        fra,
        til,
        firmanavn: valgtFirma?.name ?? "firma",
      };
      if (utFormat === "csv") {
        mod.eksporterCsv(input, t, { mottaker: cfg.mottaker });
      } else {
        // Detalj-radene hentes KUN her (ved eksport-klikk), med SAMME filtre som
        // skjermrapporten. detaljEksport filtrerer alltid på skalEksporteres
        // (det ER lønnseksporten). .xlsx får detalj-arkene; CSV forblir sammendrag.
        const detalj = await utils.timer.rapport.detaljEksport.fetch({
          organizationId: orgId!,
          fra,
          til,
          prosjektId: valgtProsjektId || undefined,
          ansattId: valgtAnsattId || undefined,
        });
        await mod.eksporterXlsx(input, detalj, t, {
          radTyper,
          mottaker: cfg.mottaker,
          gruppering: cfg.gruppering,
        });
      }
    } catch (e) {
      // 1c: gjør det tause kastet synlig. Loggen bevarer stacken for å pinne
      // det faktiske kastet (exceljs-runtime mistenkt); brukeren får en konkret
      // melding i stedet for en fil som aldri kom.
      console.error("[timer-eksport] eksport feilet", e);
      setEksportFeil(e instanceof Error ? e.message : String(e));
    } finally {
      setEksporterer(false);
    }
  }

  /* ---- Lagrede maler (fase 3/4) — åpne/bruk/lagre/slett ---- */

  /** Sett hele modal-tilstanden fra en config (delt av «Ny», «Rediger» og innebygd). */
  function settModalFraConfig(cfg: MalConfig) {
    setValgteRadTyper([...cfg.radTyper]);
    setTilpassetFormat(cfg.format);
    setMottaker(cfg.mottaker);
    setGruppering(cfg.gruppering);
    setOrientering(cfg.orientering);
    setTopptekstTekst(cfg.topptekst ? cfg.topptekst.linjer.join("\n") : "");
  }

  /** Bygg config fra gjeldende modal-tilstand. Topptekst: én linje pr. rad, tomme
   *  linjer filtreres bort; ingen linjer → null. */
  function modalConfig(): MalConfig {
    const linjer = topptekstTekst
      .split("\n")
      .map((l) => l.trimEnd())
      .filter((l) => l.trim().length > 0);
    return {
      radTyper: valgteRadTyper,
      format: tilpassetFormat,
      mottaker,
      gruppering,
      orientering,
      topptekst: linjer.length > 0 ? { linjer } : null,
    };
  }

  /** Åpne redigereren for en NY mal (blank) eller forhåndsutfylt fra en innebygd. */
  function åpneRedigerer(forhåndsutfylt?: InnebygdMal) {
    setRedigererMalId(null);
    setMalNavn(forhåndsutfylt?.navn ?? "");
    settModalFraConfig(forhåndsutfylt?.config ?? FULL_CONFIG);
    setEksportÅpen(false);
    setTilpassetÅpen(true);
  }

  /** Åpne en lagret mal for redigering (får «Lagre»/«Slett»). */
  function redigerMal(m: LagretMal) {
    setRedigererMalId(m.id);
    setMalNavn(m.name);
    settModalFraConfig(lesConfig(m.config));
    setEksportÅpen(false);
    setTilpassetÅpen(true);
  }

  /** Klikk på en mal-rad = eksporter direkte med malens config (filtype = config.format). */
  function brukMal(m: LagretMal) {
    const cfg = lesConfig(m.config);
    setEksportÅpen(false);
    void håndterEksport(cfg.format, cfg);
  }

  /** Klikk på en innebygd mal-rad = ett-klikk-eksport med dens config. */
  function brukInnebygd(mal: InnebygdMal) {
    setEksportÅpen(false);
    void håndterEksport(mal.config.format, mal.config);
  }

  async function lagreSomNy(nivaa: "firma" | "personlig") {
    if (!orgId || !malNavn.trim()) return;
    setEksportFeil(null);
    try {
      await lagreMal.mutateAsync({
        organizationId: orgId,
        name: malNavn.trim(),
        config: modalConfig(),
        nivaa,
      });
      await utils.timer.eksportOppsett.list.invalidate();
      setTilpassetÅpen(false);
    } catch (e) {
      setEksportFeil(e instanceof Error ? e.message : String(e));
    }
  }

  async function lagreEndring() {
    if (!orgId || !redigererMalId || !malNavn.trim()) return;
    setEksportFeil(null);
    try {
      await oppdaterMal.mutateAsync({
        id: redigererMalId,
        organizationId: orgId,
        name: malNavn.trim(),
        config: modalConfig(),
      });
      await utils.timer.eksportOppsett.list.invalidate();
      setTilpassetÅpen(false);
    } catch (e) {
      setEksportFeil(e instanceof Error ? e.message : String(e));
    }
  }

  async function slettMalen() {
    if (!orgId || !redigererMalId) return;
    setEksportFeil(null);
    try {
      await slettMal.mutateAsync({ id: redigererMalId, organizationId: orgId });
      await utils.timer.eksportOppsett.list.invalidate();
      setTilpassetÅpen(false);
    } catch (e) {
      setEksportFeil(e instanceof Error ? e.message : String(e));
    }
  }

  const harData = !!rapportData && rapportData.ansatte.length > 0;

  return (
    <div>
      <SonetonetSidehode sone="firma" className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">
            {t("firma.timer.rapport.tittel")}
          </h1>
          <div className="relative">
            <button
              type="button"
              onClick={() => setEksportÅpen(!eksportÅpen)}
              disabled={!harData || eksporterer}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {eksporterer ? <Spinner size="sm" /> : <Download className="h-4 w-4" />}
              {t("firma.timer.rapport.eksport.knapp")}
            </button>
            {eksportÅpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setEksportÅpen(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                  {/* Lagrede maler — «Mine» øverst, så «Firmaets». Klikk på raden
                      eksporterer med malens config; «Rediger» åpner redigereren. */}
                  {mineMalene.length > 0 && (
                    <MalSeksjon
                      tittel={t("firma.timer.rapport.maler.mine")}
                      maler={mineMalene}
                      onBruk={brukMal}
                      onRediger={redigerMal}
                      redigerTekst={t("firma.timer.rapport.maler.rediger")}
                    />
                  )}
                  {firmaMalene.length > 0 && (
                    <MalSeksjon
                      tittel={t("firma.timer.rapport.maler.firma")}
                      maler={firmaMalene}
                      onBruk={brukMal}
                      onRediger={redigerMal}
                      redigerTekst={t("firma.timer.rapport.maler.rediger")}
                    />
                  )}

                  {/* Innebygde maler (kode): Full eksport · Lønnsgrunnlag ·
                      Fakturagrunnlag. Rad-klikk = ett-klikk-eksport med malens
                      config; «Rediger» åpner redigereren forhåndsutfylt. */}
                  <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {t("firma.timer.rapport.maler.innebygd")}
                  </div>
                  {innebygde.map((mal) => (
                    <div key={mal.navn} className="flex items-center hover:bg-gray-50">
                      <button
                        type="button"
                        onClick={() => brukInnebygd(mal)}
                        className="flex-1 truncate px-3 py-1.5 text-left text-sm text-gray-700"
                        title={mal.navn}
                      >
                        {mal.navn}
                      </button>
                      <button
                        type="button"
                        onClick={() => åpneRedigerer(mal)}
                        className="px-2 py-1.5 text-xs text-gray-400 hover:text-sitedoc-primary"
                      >
                        {t("firma.timer.rapport.maler.rediger")}
                      </button>
                    </div>
                  ))}

                  {/* Direkte full-eksport per format — uendret fra i dag. */}
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => håndterEksport("csv")}
                    className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {t("firma.timer.rapport.eksport.csv")}
                  </button>
                  <button
                    type="button"
                    onClick={() => håndterEksport("xlsx")}
                    className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {t("firma.timer.rapport.eksport.excel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => håndterEksport("pdf")}
                    className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {t("firma.timer.rapport.eksport.pdf")}
                  </button>

                  <div className="my-1 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => åpneRedigerer()}
                    className="block w-full px-3 py-1.5 text-left text-sm font-medium text-sitedoc-primary hover:bg-gray-50"
                  >
                    {t("firma.timer.rapport.maler.ny")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </SonetonetSidehode>

      {tilpassetÅpen && (
        <TilpassetModal
          navn={malNavn}
          setNavn={setMalNavn}
          valgteRadTyper={valgteRadTyper}
          setValgteRadTyper={setValgteRadTyper}
          format={tilpassetFormat}
          setFormat={setTilpassetFormat}
          mottaker={mottaker}
          setMottaker={setMottaker}
          gruppering={gruppering}
          setGruppering={setGruppering}
          orientering={orientering}
          setOrientering={setOrientering}
          topptekstTekst={topptekstTekst}
          setTopptekstTekst={setTopptekstTekst}
          redigererEksisterende={redigererMalId !== null}
          kanLagreFirma={kanAdministrereFirma}
          lagrer={lagreMal.isPending || oppdaterMal.isPending || slettMal.isPending}
          onAvbryt={() => setTilpassetÅpen(false)}
          onEksporter={() => {
            setTilpassetÅpen(false);
            void håndterEksport(tilpassetFormat === "pdf" ? "pdf" : "xlsx", modalConfig());
          }}
          onLagreSomNy={lagreSomNy}
          onLagreEndring={lagreEndring}
          onSlett={slettMalen}
          t={t}
        />
      )}

      {/* 1c: eksport-feil synlig for bruker (ellers svelget i try/finally). */}
      {eksportFeil && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("firma.timer.rapport.eksport.feil")}: {eksportFeil}
        </div>
      )}

      {/* Filter-rad */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              {t("firma.timer.rapport.filter.fra")}
            </label>
            <input
              type="date"
              value={fra}
              onChange={(e) => setFra(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              {t("firma.timer.rapport.filter.til")}
            </label>
            <input
              type="date"
              value={til}
              onChange={(e) => setTil(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <HurtigKnapp onClick={() => settHurtigPeriode("denne-uken")}>
              {t("firma.timer.rapport.filter.denneUken")}
            </HurtigKnapp>
            <HurtigKnapp onClick={() => settHurtigPeriode("forrige-uken")}>
              {t("firma.timer.rapport.filter.forrigeUken")}
            </HurtigKnapp>
            <HurtigKnapp onClick={() => settHurtigPeriode("denne-maaneden")}>
              {t("firma.timer.rapport.filter.denneMaaneden")}
            </HurtigKnapp>
            <HurtigKnapp onClick={() => settHurtigPeriode("forrige-maaneden")}>
              {t("firma.timer.rapport.filter.forrigeMaaneden")}
            </HurtigKnapp>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              {t("firma.timer.rapport.filter.prosjekt")}
            </label>
            <select
              value={valgtProsjektId}
              onChange={(e) => setValgtProsjektId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t("firma.timer.rapport.filter.alleProsjekter")}</option>
              {(prosjekter ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.navn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              {t("firma.timer.rapport.filter.ansatt")}
            </label>
            <select
              value={valgtAnsattId}
              onChange={(e) => setValgtAnsattId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t("firma.timer.rapport.filter.alleAnsatte")}</option>
              {(ansatte ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sammendrag */}
      {rapportData && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label={t("firma.timer.rapport.sammendrag.totalTimer")} verdi={formaterTimer(rapportData.totalTimer)} fremhev />
          <Stat label={t("firma.timer.rapport.sammendrag.antallAnsatte")} verdi={String(rapportData.ansatte.length)} />
          <Stat label={t("firma.timer.rapport.sammendrag.antallSedler")} verdi={String(rapportData.antallSedler)} />
          <Stat label={t("firma.timer.rapport.sammendrag.sent")} verdi={String(rapportData.statusFordeling.sent)} />
          <Stat label={t("firma.timer.rapport.sammendrag.attestert")} verdi={String(rapportData.statusFordeling.attestert)} />
        </div>
      )}

      {/* Tabell */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !rapportData || rapportData.ansatte.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-600">
          {t("firma.timer.rapport.tom")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="w-8 px-3 py-3"></th>
                <SortHeader k="navn" aktiv={sortKolonne} retning={sortRetning} onClick={bytteSort}>
                  {t("firma.timer.rapport.kolonne.ansatt")}
                </SortHeader>
                <SortHeader k="ansattnummer" aktiv={sortKolonne} retning={sortRetning} onClick={bytteSort}>
                  {t("firma.timer.rapport.kolonne.ansattnummer")}
                </SortHeader>
                <SortHeader k="totalTimer" aktiv={sortKolonne} retning={sortRetning} onClick={bytteSort} høyre>
                  {t("firma.timer.rapport.kolonne.totalTimer")}
                </SortHeader>
                <SortHeader k="antallSedler" aktiv={sortKolonne} retning={sortRetning} onClick={bytteSort} høyre>
                  {t("firma.timer.rapport.kolonne.sedler")}
                </SortHeader>
                <SortHeader k="sistRegistrert" aktiv={sortKolonne} retning={sortRetning} onClick={bytteSort}>
                  {t("firma.timer.rapport.kolonne.sistRegistrert")}
                </SortHeader>
                <th className="px-3 py-3">{t("firma.timer.rapport.kolonne.status")}</th>
              </tr>
            </thead>
            <tbody>
              {sorterteAnsatte.map((a) => {
                const ekspandert = ekspandertUserId === a.userId;
                return (
                  <>
                    <tr
                      key={a.userId}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setEkspandertUserId(ekspandert ? null : a.userId)}
                    >
                      <td className="px-3 py-2">
                        {ekspandert ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{a.navn ?? a.email}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{a.ansattnummer ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">{formaterTimer(a.totalTimer)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{a.antallSedler}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {a.sistRegistrert ? new Date(a.sistRegistrert).toLocaleDateString("nb-NO") : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadges fordeling={a.statusFordeling} t={t} />
                      </td>
                    </tr>
                    {ekspandert && (
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <td colSpan={7} className="px-6 py-4">
                          <Detaljvisning ansatt={a} vy={detaljVy} setVy={setDetaljVy} t={t} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Segmentert valgknapp-gruppe (forhåndsdefinerte valg fremfor fritekst). Generisk
 *  over string-unionen den styrer. */
function Segment<T extends string>({
  verdi,
  valg,
  onVelg,
}: {
  verdi: T;
  valg: Array<{ v: T; tekst: string }>;
  onVelg: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap overflow-hidden rounded-md border border-gray-300">
      {valg.map((o, i) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onVelg(o.v)}
          className={`px-3 py-1.5 text-sm ${i > 0 ? "border-l border-gray-300" : ""} ${
            verdi === o.v ? "bg-sitedoc-primary text-white" : "bg-white text-gray-700"
          }`}
        >
          {o.tekst}
        </button>
      ))}
    </div>
  );
}

function HurtigKnapp({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
    >
      {children}
    </button>
  );
}

function Stat({ label, verdi, fremhev }: { label: string; verdi: string; fremhev?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className={`text-2xl font-semibold ${fremhev ? "text-sitedoc-primary" : "text-gray-900"}`}>{verdi}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function SortHeader({
  k,
  aktiv,
  retning,
  onClick,
  høyre,
  children,
}: {
  k: SortKolonne;
  aktiv: SortKolonne;
  retning: SortRetning;
  onClick: (k: SortKolonne) => void;
  høyre?: boolean;
  children: React.ReactNode;
}) {
  return (
    <th
      className={`cursor-pointer select-none px-3 py-3 hover:text-gray-900 ${høyre ? "text-right" : ""}`}
      onClick={() => onClick(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {aktiv === k && <span className="text-gray-400">{retning === "asc" ? "↑" : "↓"}</span>}
      </span>
    </th>
  );
}

function StatusBadges({ fordeling, t }: { fordeling: StatusFordeling; t: (k: string) => string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {fordeling.kladd > 0 && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
          {t("firma.timer.rapport.status.kladd")}: {fordeling.kladd}
        </span>
      )}
      {fordeling.sent > 0 && (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
          {t("firma.timer.rapport.status.sent")}: {fordeling.sent}
        </span>
      )}
      {fordeling.attestert > 0 && (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
          {t("firma.timer.rapport.status.attestert")}: {fordeling.attestert}
        </span>
      )}
    </div>
  );
}

function Detaljvisning({
  ansatt,
  vy,
  setVy,
  t,
}: {
  ansatt: AnsattRad;
  vy: DetaljVy;
  setVy: (v: DetaljVy) => void;
  t: (k: string) => string;
}) {
  const perPeriode = useMemo(() => {
    if (vy === "dag") return ansatt.perDag;
    const map = new Map<string, number>();
    for (const d of ansatt.perDag) {
      const uke = isoUkeNokkel(d.dato);
      map.set(uke, (map.get(uke) ?? 0) + d.timer);
    }
    return Array.from(map.entries()).map(([dato, timer]) => ({ dato, timer }));
  }, [ansatt.perDag, vy]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">
          {ansatt.navn ?? ansatt.email}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setVy("dag")}
            className={`rounded-md px-2 py-1 text-xs ${vy === "dag" ? "bg-sitedoc-primary text-white" : "bg-white text-gray-700 border border-gray-300"}`}
          >
            {t("firma.timer.rapport.detalj.perDag")}
          </button>
          <button
            type="button"
            onClick={() => setVy("uke")}
            className={`rounded-md px-2 py-1 text-xs ${vy === "uke" ? "bg-sitedoc-primary text-white" : "bg-white text-gray-700 border border-gray-300"}`}
          >
            {t("firma.timer.rapport.detalj.perUke")}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Per periode */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {vy === "dag" ? t("firma.timer.rapport.detalj.perDag") : t("firma.timer.rapport.detalj.perUke")}
          </h4>
          <table className="w-full text-xs">
            <tbody>
              {perPeriode.map((d) => (
                <tr key={d.dato} className="border-t border-gray-100 first:border-t-0">
                  <td className="py-1 text-gray-700">{d.dato}</td>
                  <td className="py-1 text-right font-medium text-gray-900">{formaterTimer(d.timer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per prosjekt */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t("firma.timer.rapport.detalj.perProsjekt")}
          </h4>
          <table className="w-full text-xs">
            <tbody>
              {ansatt.perProsjekt
                .slice()
                .sort((a, b) => b.timer - a.timer)
                .map((p) => (
                  <tr key={p.prosjektId} className="border-t border-gray-100 first:border-t-0">
                    <td className="py-1 text-gray-700">
                      {p.prosjektNavn}
                      {p.internProsjektNummer && (
                        <span className="ml-1 font-mono text-[10px] text-gray-400">{p.internProsjektNummer}</span>
                      )}
                    </td>
                    <td className="py-1 text-right font-medium text-gray-900">{formaterTimer(p.timer)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Radtypene i visningsrekkefølge — samme fire som eksport-radvalget. */
const RADTYPER: DetaljRadType[] = ["timer", "maskin", "tillegg", "utlegg"];

/** Én mal-seksjon i eksport-nedtrekket (Mine / Firmaets). Rad-klikk eksporterer;
 *  «Rediger» åpner redigereren. */
function MalSeksjon({
  tittel,
  maler,
  onBruk,
  onRediger,
  redigerTekst,
}: {
  tittel: string;
  maler: LagretMal[];
  onBruk: (m: LagretMal) => void;
  onRediger: (m: LagretMal) => void;
  redigerTekst: string;
}) {
  return (
    <>
      <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {tittel}
      </div>
      {maler.map((m) => (
        <div key={m.id} className="flex items-center hover:bg-gray-50">
          <button
            type="button"
            onClick={() => onBruk(m)}
            className="flex-1 truncate px-3 py-1.5 text-left text-sm text-gray-700"
            title={m.name}
          >
            {m.name}
          </button>
          <button
            type="button"
            onClick={() => onRediger(m)}
            className="px-2 py-1.5 text-xs text-gray-400 hover:text-sitedoc-primary"
          >
            {redigerTekst}
          </button>
        </div>
      ))}
    </>
  );
}

/**
 * Redigereren (fase 3) — Tilpasset-modalen med lagring. Navnefelt + radvalg +
 * format, og lagringsveier avhengig av modus:
 *  - alltid: «Eksporter uten å lagre» (fase-2-oppførselen).
 *  - alltid: «Lagre som min» (+ «Lagre som firma» for firma-admin).
 *  - når en lagret mal er åpnet: «Lagre» (oppdater) + «Slett» (med in-modal
 *    bekreftelse, ikke confirm() — UI-standard).
 * Gruppering/kolonnevalg er fase 4 (ikke bygd her).
 */
function TilpassetModal({
  navn,
  setNavn,
  valgteRadTyper,
  setValgteRadTyper,
  format,
  setFormat,
  mottaker,
  setMottaker,
  gruppering,
  setGruppering,
  orientering,
  setOrientering,
  topptekstTekst,
  setTopptekstTekst,
  redigererEksisterende,
  kanLagreFirma,
  lagrer,
  onAvbryt,
  onEksporter,
  onLagreSomNy,
  onLagreEndring,
  onSlett,
  t,
}: {
  navn: string;
  setNavn: (v: string) => void;
  valgteRadTyper: DetaljRadType[];
  setValgteRadTyper: (v: DetaljRadType[]) => void;
  format: "xlsx" | "pdf";
  setFormat: (f: "xlsx" | "pdf") => void;
  mottaker: Mottaker;
  setMottaker: (m: Mottaker) => void;
  gruppering: Gruppering;
  setGruppering: (g: Gruppering) => void;
  orientering: Orientering;
  setOrientering: (o: Orientering) => void;
  topptekstTekst: string;
  setTopptekstTekst: (v: string) => void;
  redigererEksisterende: boolean;
  kanLagreFirma: boolean;
  lagrer: boolean;
  onAvbryt: () => void;
  onEksporter: () => void;
  onLagreSomNy: (nivaa: "firma" | "personlig") => void;
  onLagreEndring: () => void;
  onSlett: () => void;
  t: (k: string) => string;
}) {
  const [bekrefterSlett, setBekrefterSlett] = useState(false);
  // Auto-orientering avledes av om beskrivelse-kolonnen er med (grovt: brukeren har
  // valgt en radtype som bærer beskrivelse). Vises som hint; det faktiske valget
  // gjøres i rendereren fra de faktiske radene.
  const beskrivelseSannsynlig =
    valgteRadTyper.includes("timer") ||
    valgteRadTyper.includes("tillegg") ||
    valgteRadTyper.includes("utlegg");
  const autoResultat = beskrivelseSannsynlig
    ? t("firma.timer.rapport.tilpasset.orienteringLiggende")
    : t("firma.timer.rapport.tilpasset.orienteringStaaende");

  function toggle(rt: DetaljRadType) {
    setValgteRadTyper(
      valgteRadTyper.includes(rt)
        ? valgteRadTyper.filter((x) => x !== rt)
        : [...valgteRadTyper, rt],
    );
  }
  const ingenValgt = valgteRadTyper.length === 0;
  const utenNavn = navn.trim().length === 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-xl">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {t("firma.timer.rapport.tilpasset.tittel")}
          </h2>
        </div>

        <div className="space-y-4 px-4 py-4">
          {/* Navn */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("firma.timer.rapport.tilpasset.navn")}
            </label>
            <input
              type="text"
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              placeholder={t("firma.timer.rapport.tilpasset.navnPlaceholder")}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-sitedoc-primary focus:outline-none"
            />
          </div>

          {/* Rader */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("firma.timer.rapport.tilpasset.rader")}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {RADTYPER.map((rt) => (
                <label key={rt} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={valgteRadTyper.includes(rt)}
                    onChange={() => toggle(rt)}
                    className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary"
                  />
                  {t(`timer.eksport.type${rt.charAt(0).toUpperCase()}${rt.slice(1)}`)}
                </label>
              ))}
            </div>
          </div>

          {/* Mottaker (fase 4) — regel, ikke avhuking. Ekstern fjerner status+ID strukturelt. */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("firma.timer.rapport.tilpasset.mottaker")}
            </div>
            <Segment
              verdi={mottaker}
              valg={[
                { v: "intern", tekst: t("firma.timer.rapport.tilpasset.mottakerIntern") },
                { v: "ekstern", tekst: t("firma.timer.rapport.tilpasset.mottakerEkstern") },
              ]}
              onVelg={setMottaker}
            />
            {mottaker === "ekstern" && (
              <p className="mt-1.5 text-xs text-gray-500">
                {t("firma.timer.rapport.tilpasset.eksternNote")}
              </p>
            )}
          </div>

          {/* Gruppering (fase 4) — ren presentasjon, rører aldri radsettet. */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("firma.timer.rapport.tilpasset.gruppering")}
            </div>
            <Segment
              verdi={gruppering}
              valg={[
                { v: "ingen", tekst: t("firma.timer.rapport.tilpasset.grupperingIngen") },
                { v: "ansatt", tekst: t("firma.timer.rapport.tilpasset.grupperingAnsatt") },
                { v: "prosjekt", tekst: t("firma.timer.rapport.tilpasset.grupperingProsjekt") },
              ]}
              onVelg={setGruppering}
            />
          </div>

          {/* Format */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("firma.timer.rapport.tilpasset.format")}
            </div>
            <Segment
              verdi={format}
              valg={[
                { v: "xlsx", tekst: t("firma.timer.rapport.tilpasset.formatExcel") },
                { v: "pdf", tekst: t("firma.timer.rapport.tilpasset.formatPdf") },
              ]}
              onVelg={setFormat}
            />
          </div>

          {/* Orientering + topptekst — kun relevant for PDF (dokumentet som sendes). */}
          {format === "pdf" && (
            <>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("firma.timer.rapport.tilpasset.orientering")}
                </div>
                <Segment
                  verdi={orientering}
                  valg={[
                    {
                      v: "auto",
                      tekst: `${t("firma.timer.rapport.tilpasset.orienteringAuto")} (${autoResultat})`,
                    },
                    { v: "staaende", tekst: t("firma.timer.rapport.tilpasset.orienteringStaaende") },
                    { v: "liggende", tekst: t("firma.timer.rapport.tilpasset.orienteringLiggende") },
                  ]}
                  onVelg={setOrientering}
                />
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("firma.timer.rapport.tilpasset.topptekst")}
                </div>
                <textarea
                  value={topptekstTekst}
                  onChange={(e) => setTopptekstTekst(e.target.value)}
                  rows={4}
                  placeholder={t("firma.timer.rapport.tilpasset.topptekstPlaceholder")}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-sitedoc-primary focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t("firma.timer.rapport.tilpasset.topptekstHjelp")}
                </p>
              </div>
            </>
          )}

          {/* Lagre-valg (forhåndsdefinerte knapper, ikke fritekst-nivåvalg) */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("firma.timer.rapport.tilpasset.lagreGruppe")}
            </div>
            <div className="flex flex-wrap gap-2">
              {redigererEksisterende && (
                <button
                  type="button"
                  onClick={onLagreEndring}
                  disabled={ingenValgt || utenNavn || lagrer}
                  className="rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
                >
                  {t("firma.timer.rapport.tilpasset.lagre")}
                </button>
              )}
              <button
                type="button"
                onClick={() => onLagreSomNy("personlig")}
                disabled={ingenValgt || utenNavn || lagrer}
                className="rounded-md border border-sitedoc-primary px-3 py-1.5 text-sm font-medium text-sitedoc-primary hover:bg-sitedoc-primary/5 disabled:opacity-50"
              >
                {t("firma.timer.rapport.tilpasset.lagreSomMin")}
              </button>
              {kanLagreFirma && (
                <button
                  type="button"
                  onClick={() => onLagreSomNy("firma")}
                  disabled={ingenValgt || utenNavn || lagrer}
                  className="rounded-md border border-sitedoc-primary px-3 py-1.5 text-sm font-medium text-sitedoc-primary hover:bg-sitedoc-primary/5 disabled:opacity-50"
                >
                  {t("firma.timer.rapport.tilpasset.lagreSomFirma")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer: slett (venstre) · avbryt + eksporter (høyre). Slett bekreftes
            in-modal, aldri via confirm() (UI-standard). */}
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3">
          <div>
            {redigererEksisterende &&
              (bekrefterSlett ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {t("firma.timer.rapport.tilpasset.slettBekreft")}
                  </span>
                  <button
                    type="button"
                    onClick={onSlett}
                    disabled={lagrer}
                    className="rounded-md bg-red-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {t("firma.timer.rapport.tilpasset.slett")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBekrefterSlett(false)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {t("firma.timer.rapport.tilpasset.avbryt")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setBekrefterSlett(true)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  {t("firma.timer.rapport.tilpasset.slett")}
                </button>
              ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAvbryt}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t("firma.timer.rapport.tilpasset.avbryt")}
            </button>
            <button
              type="button"
              onClick={onEksporter}
              disabled={ingenValgt}
              className="rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("firma.timer.rapport.tilpasset.eksporter")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
