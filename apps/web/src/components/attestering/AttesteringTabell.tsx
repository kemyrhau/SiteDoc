"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { Check, CornerUpLeft, RotateCcw, X, SlidersHorizontal, ExternalLink, AlertTriangle } from "lucide-react";
import { Button, Modal, Tooltip } from "@sitedoc/ui";
import {
  TIMER_TABELL_KOL,
  TIMER_TABELL_KOL_KEYS,
  TIMER_TABELL_STANDARD,
  TIMER_TABELL_TILLAGT,
  erArbeidstidReise,
  erOvertidsnivaa,
  sumOvertidTimer,
  timerTabellVerdi,
  type TimerTabellKolKey,
} from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { kontorReiseTekst, useKontorNavn } from "@/hooks/useKontorReiseTekst";
import { formaterNorsk } from "@/lib/timer-rapport-eksport";
import { useTabelloppsett } from "@/hooks/useTabelloppsett";
import { KolonneVelger } from "@/components/ui/KolonneVelger";
import {
  TimerRadTabell,
  type TimerRadTabellRad,
  type TimerRadTabellSortering,
} from "@/components/timer/TimerRadTabell";
import { SplittRadModal } from "@/components/timer/SplittRadModal";
import { ProsjektHover, type ProsjektHoverJobb } from "./ProsjektHover";
import type { ProsjektValg } from "@/components/timer/rediger-types";
import { RedigerRadModal } from "./RedigerRadModal";
import { Kvitteringer } from "./Kvitteringer";
import { RegistreringPanel, jobbensBeskrivelser } from "./RegistreringPanel";
import { useBareOversikt } from "./useBareOversikt";
import { dagKanTrekkes, ukeFor, ukeMerker, ukeTall, type AttUke, type UkeMerke, type UkeTekster } from "./ukelinje";
import {
  AVVIK_FILTER,
  FILTER_KOLONNER,
  antallRader,
  byggJobbUtvalg,
  byggUtvalg,
  dagensTimer,
  erBareReiseKort,
  filterAlternativer,
  filtrerModell,
  grupperModell,
  linjeIKontekst,
  linjeSpenn,
  linjeVarsel,
  lonnsartMerker,
  lonnsartPlass,
  navnefeltPlass,
  slaaSammen,
  spennerFlereAar,
  sumLinjer,
  visDato,
  type AttDag,
  type AttKort,
  type AttLinje,
  type AttSedel,
  type AvvikMerke,
  type Gruppering,
  type LonnsartMerke,
  type LonnsartOppslag,
  type RadIder,
} from "./attestering-tabell";

/** Det ukeoversikten får fra tabellen (R12): tabellens dager uten datofilteret, og klikk på en dag. */
export interface UkeoversiktApi {
  dager: AttDag[];
  velgDato: (iso: string) => void;
  valgtDato: string | null;
}

/**
 * Firma-attesteringens Sedler-fane som tabell (spec prosjektkort-kortid d2b-1, § 12.8.5).
 *
 * Dagseddel → prosjektsedler (kort) → linjer, som én blokk pr. dag (w5b, B14 A): en blå
 * dagsrad øverst med dato, ansatt, dagens sum, normmerket og «Attester dagen» / «Gjenåpne
 * dagen» og lenke til sedelen. Har dagen flere kort, får hvert kort en jobbrad med ✓, retur
 * og gjenåpne (R4) og sin egen kantfarge; med ett kort står kortets felt og ↺ i dagsraden.
 *
 * w10a (B24 B, B25 A, B27 A, B30 A): jobben attesteres samlet. ✓ ↩ ↺ og avkrysningen står bare
 * på de blå radene (dag, jobb, reise); linjene kan bare leses og har ingen knapper, bortsett fra
 * kvitteringen på utlegg. Retting, ✂ og «✎ Rediger jobben» skjer i kortet den blå raden åpner.
 *
 * Én verktøylinje (R17): sidens uke/gruppering/fane kommer inn som `verktoy`, resten
 * eies her. Filter og sortering gjelder besøket (R7); «Bare oversiktsrader» huskes pr. bruker (A1, B51 A).
 */

// w10a (A3, B26 A): ny listenøkkel — lagrede oppsett nullstilles én gang, alle får kjernekolonnene.
// A2 (plan § 4.17 punkt 5): v3 — nullstilles én gang til, så alle får «Prosjekt» i stedet for Pr.nr. og Underprosjekt.
const LISTE = "timer-attestering-v3";
const STANDARD = new Set<string>(TIMER_TABELL_STANDARD);
// w10a: avkrysning og pil på de blå radene står sammen med smalere innrykk (`TimerRadTabell`).
const VENSTRE = 36;
// «Attester dagen» ↩ ↺ ↗ på dagsraden — smalere brytes knappen og raden blir dobbelt høy (målt w5).
const HOYRE = 176;

/**
 * Attesteringens standardbredder (w5, punkt 5): smalere enn den delte lista, så de 13
 * kjernekolonnene står uten sidelengs rulling på en skjerm på 1 440 (målt: 1 170 px til
 * tabellen ved fast meny, minus 36 + 176 til de faste kolonnene). Hodet er kompakt med korte
 * overskrifter (`HODE_KORT`). Dratt bredde vinner fortsatt (R6). Rapportens Detaljer bruker
 * den delte lista uendret. w5b: dato og ansatt er bredere så dagsraden viser «ons. 18.11.» og
 * et vanlig navn helt (målt 1 440); plassen er tatt fra Vare og mengde, Maskintimer,
 * Betegnelse, Pr.nr., Maskin og Avvik, så summen er den samme. w5b retur 1: alle
 * overskriftene står hele ved 1 440 — det kompakte hodet har 14 px innrykk og filterikonet
 * uten venstremarg (`TimerRadTabell`), og Avvik/Maskintimer har fått 2/4 px fra Vare og
 * mengde, Timer og Antall (målt: ingen hodecelle med scrollWidth > clientWidth).
 * w8: dato 84 → 92, så «man. 16.11.» (bredeste ukedag, halvfet) står hel; de 8 px er tatt fra
 * Pr.nr. (−4), Timer (−2) og Maskin (−2), der hode og celler har luft. Ansattnr (ikke i
 * standardutvalget) får 86 px, så overskriften ikke klippes til «Ansatt». Målt ved 1 440 i
 * firma, «Etter prosjekt» og prosjektet: ingen dato- eller hodecelle med scrollWidth > clientWidth.
 */
const ATTESTERING_BREDDE: Partial<Record<TimerTabellKolKey, number>> = {
  dato: 92,
  ansattnr: 86,
  ansatt: 104,
  // A2: Prosjekt erstatter Pr.nr. og Underprosjekt i standardoppsettet og får plassen deres (66 + 88).
  prosjekt: 154,
  prosjektnummer: 66,
  underprosjekt: 88,
  betegnelse: 74,
  // O15 pkt 6 (R11): «06:56–07:00» står helt (94 kuttet siste siffer). Bare attesteringen.
  fraTil: 100,
  fraTid: 56,
  tilTid: 56,
  // O13 (pkt 3): «11,50» i halvfet står helt (52 ga 40 px til tallet). Reise og Overtid er nye.
  timer: 60,
  reisetimer: 56,
  overtid: 64,
  maskin: 76,
  maskintimer: 66,
  vareOgMengde: 68,
  antall: 54,
  belop: 54,
  avvik: 68,
};

/**
 * Kantfargene i en dagsblokk (w5b, B14 A): dagsraden har mørk blå; jobbene får hver sin farge
 * i rekkefølge, så to jobber samme dag skilles fra hverandre.
 */
const DAG_KANT = "border-blue-700";
// A1 (§ 4.17 del B): gult betyr «se på dette», så ingen jobb har gul kant (AM17). Amber → skifer.
const KORT_KANT = ["border-blue-400", "border-slate-500", "border-emerald-500", "border-violet-500", "border-rose-500"] as const;

/** A1: linja et varsel gjelder (overtid, fravær, reise under terskel) er gul. */
const GUL_LINJE = "bg-amber-50";

/** O13 (pkt 3): merket og tallet på reise- og overtidslinja — blå reise, lilla overtid (B14c B). */
const MERKE_FARGE = { reise: "border-sky-300 bg-sky-50 text-sky-800", overtid: "border-violet-300 bg-violet-50 text-violet-800" } as const;
const TALL_FARGE = { reise: "text-sky-700", overtid: "text-violet-700" } as const;

/** Kolonner med kortere overskrift i hodet; full tittel ved hover. */
const HODE_KORT: ReadonlySet<TimerTabellKolKey> = new Set<TimerTabellKolKey>(["prosjektnummer", "underprosjekt", "betegnelse", "maskintimer"]);

interface Props {
  dager: AttDag[];
  orgId: string;
  readOnly: boolean;
  /** Uke, gruppering og fane — sidens del av verktøylinja. */
  verktoy: ReactNode;
  /** Ukeoversikten (R12, R18), åpnes fra verktøylinja. Prosjektattesteringen har ingen. */
  ukeoversikt?: (api: UkeoversiktApi) => ReactNode;
  /** «Etter prosjekt» / «Etter ansatt» (R12): samme rader, gruppert. Standard: dag for dag. */
  gruppering?: Gruppering;
  /** Lenke til sedelen (dagens «Rediger»-meny). Utelates på detaljsiden, som er sedelen. */
  sedelUrl?: (sheetId: string) => string;
  /** Returner hele sedelen (firmaet). I prosjektkontekst returneres bare prosjektets linjer. */
  onReturnerDag?: (sheetId: string) => void;
  /**
   * Prosjektkontekst (F1, R13): bare linjer på disse prosjektene kan velges og attesteres; linjer
   * på andre prosjekter vises nedtonet uten handlinger (T30). Firma-admin har ingen; prosjektlederen
   * har prosjektene der hen kan attestere (w10b, `mineProsjektIder`).
   */
  prosjektKontekst?: ReadonlySet<string>;
  /**
   * SL2 (B76 ja, L2): merket «N slettet» i dagsraden, som åpner «Slettet og korrigert» på dagen.
   * Siden lager merket (tallet kommer fra serveren); null = ingen slettede linjer, intet merke.
   */
  slettetMerke?: (sheetId: string) => ReactNode;
}

export function AttesteringTabell({ dager, orgId, readOnly, verktoy, ukeoversikt, gruppering = "dag", sedelUrl, onReturnerDag, prosjektKontekst, slettetMerke }: Props) {
  const { t, i18n } = useTranslation();
  const utils = trpc.useUtils();
  const oppsett = useTabelloppsett({
    liste: LISTE,
    standardKolonner: STANDARD,
    // Lagrede oppsett uten egen rekkefølge følger listas rekkefølge som før w5 (WM69).
    kanoniskRekkefolge: TIMER_TABELL_KOL_KEYS,
    // Standarden (ny bruker og «Tilbakestill til standard») har sin egen rekkefølge (w5).
    standardMedRekkefolge: true,
    // O13 (R3): Reise og Overtid settes inn rett etter Timer i et lagret oppsett, én gang.
    tillegg: TIMER_TABELL_TILLAGT,
  });
  const kolonner = useMemo(
    () => oppsett.kolonneRekkefolge.filter((k): k is TimerTabellKolKey => k in TIMER_TABELL_KOL),
    [oppsett.kolonneRekkefolge],
  );
  const overskrift = (k: TimerTabellKolKey) => t(`timer.eksport.${TIMER_TABELL_KOL[k].i18n}`);

  // Besøkets tilstand (R7): aldri lagret.
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});
  const [beskrivelseSok, setBeskrivelseSok] = useState("");
  const [sortering, setSortering] = useState<TimerRadTabellSortering | null>(null);
  // A1 (B51 A): linjene er skjult som standard; valget huskes pr. bruker.
  const { data: session } = useSession();
  const [bareOversikt, setBareOversikt] = useBareOversikt(session?.user?.id);
  const [visVelger, setVisVelger] = useState(false);
  const [visUke, setVisUke] = useState(false);
  const [valgte, setValgte] = useState<Set<string>>(new Set());
  const [melding, setMelding] = useState<string | null>(null);
  const [returner, setReturner] = useState<RadIder | null>(null);
  const [gjenaapneDag, setGjenaapneDag] = useState<string | null>(null);
  const [splitt, setSplitt] = useState<AttLinje | null>(null);
  // w10a (A2): «✎ Rediger jobben» i kortet åpner vinduet for jobbens prosjekt og underprosjekt.
  const [rediger, setRediger] = useState<{ sheetId: string; projectId: string; ecoId: string | null } | null>(null);
  // w8: jobben (kortet) som har registreringen åpen under jobbraden. Besøkets tilstand.
  const [aapenKort, setAapenKort] = useState<string | null>(null);

  const sedelFor = useMemo(() => {
    const m = new Map<string, AttSedel>();
    for (const d of dager) m.set(d.sedel.id, d.sedel);
    return (id: string) => m.get(id);
  }, [dager]);
  const iKontekst = (l: AttLinje) => {
    const s = sedelFor(l.sheetId);
    // w7 (B15): egen sedel er utenfor konteksten også i firmaattesteringen.
    if (!s) return !prosjektKontekst;
    return linjeIKontekst(l, s, prosjektKontekst);
  };

  /** A4 (B53 A): dagen er låst — fanen «Attestert», eller attestert dag under ukelinja. */
  const laast = (s: AttSedel | undefined) => readOnly || s?.attestertVisning === true;

  const synlige = useMemo(
    () => filtrerModell(dager, { verdier: filterVerdier, beskrivelseSok }),
    [dager, filterVerdier, beskrivelseSok],
  );
  const alleLinjer = useMemo(() => dager.flatMap((d) => d.kort.flatMap((k) => k.linjer)), [dager]);
  // w1: datoen som «17.11.»; året står med bare når tabellen spenner over flere år.
  const medAar = useMemo(() => spennerFlereAar(dager), [dager]);
  const dato = (iso: string) => visDato(iso, medAar);
  const synligeLinjer = useMemo(() => synlige.flatMap((d) => d.kort.flatMap((k) => k.linjer)), [synlige]);
  // Ukeoversikten teller tabellens rader uten datofilteret (T45); klikk på en dag setter det (R12).
  const ukeDager = useMemo(
    () => filtrerModell(dager, { verdier: { ...filterVerdier, dato: "" }, beskrivelseSok }),
    [dager, filterVerdier, beskrivelseSok],
  );

  // Utvalget (w10a, B30 A): hele jobber — de avkryssede blant de synlige, ellers alle synlige.
  // Jobbene slås opp ufiltrert, så linjer filteret skjuler, attesteres med (`byggJobbUtvalg`).
  const synligeKort = useMemo(() => synlige.flatMap((d) => d.kort.map((k) => k.nokkel)), [synlige]);
  const utvalg = useMemo(
    () => byggJobbUtvalg(dager, synligeKort, valgte, sedelFor, prosjektKontekst),
    [dager, synligeKort, valgte, sedelFor, prosjektKontekst],
  );

  // Katalogene: lønnsartene til kortet, og navnene i «var …» (samme spørringer som useKatalogNavn — delt cache).
  const katalogInput = { organizationId: orgId };
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery(katalogInput);
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery(katalogInput);
  const { data: prosjekterRaw } = trpc.prosjekt.hentAlle.useQuery({ organizationId: orgId, inkluderFrosne: true });
  const prosjekter = (prosjekterRaw ?? []) as unknown as ProsjektValg[];
  // O13 (pkt 3): lønnsartens overtidsmerke (`overtidsnivaa` 50/100) — Overtid-kolonnen og merket på linja.
  const overtidsnivaa = useMemo(
    () => new Map((lonnsarter ?? []).map((l) => [l.id, (l as { overtidsnivaa?: number | null }).overtidsnivaa ?? null])),
    [lonnsarter],
  );
  // A1 (§ 4.17): lønnsartens type og overtidsnivå — normmerket, lønnsartmerkene og gule linjer.
  const lonnsart = useMemo<LonnsartOppslag>(() => {
    const m = new Map((lonnsarter ?? []).map((l) => [l.id, l as { navn?: string | null; type?: string | null; overtidsnivaa?: number | null }]));
    return (id: string) => m.get(id);
  }, [lonnsarter]);
  // w10b (M3): firmaets standardverdier krever bare ansettelse — prosjektlederen er ikke firma-admin.
  const { data: innstilling } = trpc.organisasjon.hentArbeidstidDefaults.useQuery({ organizationId: orgId });
  const tidsrunding = (innstilling as { tidsrundingMinutter?: number | null } | undefined)?.tidsrundingMinutter ?? null;
  // O17 pkt 21: kontornavnene til reiser mellom to kontorer (spørringen kjøres bare når en slik finnes).
  const reiseRegler = useMemo(
    () =>
      dager.flatMap((d) =>
        d.kort.flatMap((k) => k.linjer.flatMap((l) => (l.kilde.type === "timer" ? [l.kilde.rad.reiseRegel] : []))),
      ),
    [dager],
  );
  const kontorNavn = useKontorNavn(orgId, reiseRegler);

  const oppfrisk = () => {
    void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
    void utils.timer.dagsseddel.hentForAttestering.invalidate();
  };
  const feil = (e: { message: string }) => setMelding(e.message);
  const attesterRader = trpc.timer.dagsseddel.attesterRader.useMutation({ onSuccess: (_d: unknown) => { setValgte(new Set()); oppfrisk(); }, onError: feil });
  const gjenaapneRader = trpc.timer.dagsseddel.gjenaapneRader.useMutation({ onSuccess: (_d: unknown) => oppfrisk(), onError: feil });
  const attesterDag = trpc.timer.dagsseddel.attester.useMutation({ onSuccess: (_d: unknown) => oppfrisk(), onError: feil });
  const opptatt = attesterRader.isPending || gjenaapneRader.isPending || attesterDag.isPending;

  function attester(radIder: RadIder) {
    if (antallRader(radIder) === 0) return;
    setMelding(null);
    attesterRader.mutate({ radIder });
  }
  function gjenaapne(radIder: RadIder) {
    if (antallRader(radIder) === 0) return;
    setMelding(null);
    gjenaapneRader.mutate({ radIder });
  }
  function attesterUtvalget() {
    setMelding(utvalg.stoende > 0 ? t("timer.attestering.tabell.stoende", { count: utvalg.stoende }) : null);
    if (antallRader(utvalg.radIder) > 0) attesterRader.mutate({ radIder: utvalg.radIder });
  }

  /* ---------------- Celler ---------------- */

  /** O13: reiselinja (reiseradene) og overtidslinja (lønnsart med overtidsmerke). */
  function linjeSlag(l: AttLinje): "reise" | "overtid" | null {
    if (l.kilde.type !== "timer") return null;
    if (l.kilde.rad.erReise === true) return "reise";
    return erOvertidsnivaa(overtidsnivaa.get(l.kilde.rad.lonnsartId)) ? "overtid" : null;
  }
  /** O13 (pkt 3): overtidstimene på linjene — summeres i `@sitedoc/shared` (`sumOvertidTimer`). */
  const overtidFor = (linjer: readonly AttLinje[]) =>
    sumOvertidTimer(
      linjer.flatMap((l) => (l.kilde.type === "timer" ? [{ timer: l.linje.timer, overtidsnivaa: overtidsnivaa.get(l.kilde.rad.lonnsartId) ?? null }] : [])),
    );

  const typeTekst = (type: string) => t(`timer.attestering.tabell.type.${type}`);

  function visning(k: TimerTabellKolKey, l: AttLinje, under: number): ReactNode {
    const v = timerTabellVerdi(k, l.linje, under);
    // w12 (§ 4.11 C1): reiselinja i jobben sier «Reise» i typekolonnen.
    if (k === "type") return under === 0 ? typeTekst(l.linje.erReise ? "reise" : l.linje.type) : null;
    if (k === "avvik") {
      return under === 0 && l.avvikMerker.length > 0 ? <AvvikMerker merker={l.avvikMerker} /> : null;
    }
    if (k === "dato") return under === 0 && typeof v === "string" ? dato(v) : null;
    // O15 pkt 6: Fra–til med faste sifferbredder, så «06:56–07:00» får plass i `ATTESTERING_BREDDE.fraTil`.
    if (k === "fraTil" && typeof v === "string") return <span data-fra-til="" className="tabular-nums">{v}</span>;
    // O13 (pkt 3): reise- og overtidslinja har lønnsartens navn i farget merke og timetallet i
    // samme farge. Merket er like høyt som teksten, så raden står på linje med klokkeslettet.
    const slag = under === 0 ? linjeSlag(l) : null;
    const lonnsartMerke = (s: "reise" | "overtid") => (
      <span data-lonnsart-merke={s} className={`rounded-full border px-1.5 text-xs font-medium leading-5 ${MERKE_FARGE[s]}`}>{l.linje.betegnelse}</span>
    );
    // O15 pkt 4 (vedtak pkt 4): reise ført som arbeidstid har merket «Reise» foran lønnsarten —
    // «Reise · Timelønn». Timene står i Timer som vanlig arbeidstid (ikke farget, ikke i Reise).
    if (k === "betegnelse" && under === 0 && l.kilde.type === "timer" && erArbeidstidReise(l.kilde.rad)) {
      return (
        <span data-reise-arbeid="" className="inline-flex items-center gap-1">
          <span className={`rounded-full border px-1.5 text-xs font-medium leading-5 ${MERKE_FARGE.reise}`}>{typeTekst("reise")}</span>
          <span className="text-gray-400">·</span>
          {slag ? lonnsartMerke(slag) : <span>{l.linje.betegnelse}</span>}
        </span>
      );
    }
    if (k === "betegnelse" && slag) return lonnsartMerke(slag);
    if (k === "timer" && slag && typeof v === "number") return <span data-tall={slag} className={`font-medium ${TALL_FARGE[slag]}`}>{formaterNorsk(v)}</span>;
    if (v === null) return null;
    if (typeof v === "number") return k === "pause" ? String(v) : formaterNorsk(v);
    return v;
  }

  // «var 5,00» (T57): verdien før retting, i synlig tekst.
  function varTekst(k: TimerTabellKolKey, l: AttLinje, under: number): string | null {
    const kilde = l.kilde;
    const maskinId = kilde.type === "timer" ? kilde.maskiner[under]?.id : kilde.type === "maskin" && under === 0 ? kilde.rad.id : undefined;
    const nokkel =
      under === 0 && ({ fraTid: "fraTid", tilTid: "tilTid", timer: "timer", pause: "pauseMin", antall: "antall", betegnelse: "lonnsartId", aktivitet: "aktivitetId" } as Record<string, string>)[k];
    let foer: string | number | null | undefined;
    if (kilde.type !== "maskin" && nokkel) foer = l.rettet[nokkel];
    const mFelt = ({ maskin: "vehicleId", maskintimer: "timer", mengde: "mengde", enhet: "enhet" } as Record<string, string>)[k];
    if (maskinId && mFelt) foer = l.rettet[`maskin.${maskinId}.${mFelt}`];
    if (foer === undefined) return null;
    if (foer === null || foer === "") return t("timer.attestering.tabell.var", { verdi: "—" });
    const tekst =
      nokkel === "lonnsartId" ? (lonnsarter ?? []).find((x) => x.id === foer)?.navn ?? String(foer) :
      nokkel === "aktivitetId" ? (aktiviteter ?? []).find((x) => x.id === foer)?.navn ?? String(foer) :
      typeof foer === "number" ? formaterNorsk(foer) : String(foer);
    return t("timer.attestering.tabell.var", { verdi: tekst });
  }

  /** w10a (A4, B25 A): cellene på linja kan bare leses; retting skjer i kortet. */
  function celle(k: TimerTabellKolKey, l: AttLinje, under: number): ReactNode {
    const varT = varTekst(k, l, under);
    return (
      <>
        {visning(k, l, under)}
        {varT && <span className="block text-[11px] text-gray-500">{varT}</span>}
      </>
    );
  }

  /* ---------------- Rader ---------------- */

  // O13 (pkt 2, R2): hvor prosjektnavnet står i dagsraden og jobbraden for dette kolonneoppsettet.
  const avvikKol: TimerTabellKolKey | undefined = (["avvik", "beskrivelse", "betegnelse"] as const).find((k) => kolonner.includes(k));
  // Linjene: navnefeltets plass uten avvikskolonnen (linjas Betegnelse er lønnsartens navn).
  const plass = useMemo(() => navnefeltPlass(kolonner, (k) => TIMER_TABELL_KOL[k].num), [kolonner]);
  // Dagsrad og jobbrad: er Avvik skjult og avviket i Betegnelse, står Betegnelse utenfor feltet.
  const sumPlass = useMemo(() => navnefeltPlass(kolonner, (k) => TIMER_TABELL_KOL[k].num, avvikKol), [kolonner, avvikKol]);
  // A1: feltet med lønnsartmerkene i oversiktsraden (Betegnelse + Fra–til).
  const lPlass = useMemo(() => lonnsartPlass(kolonner), [kolonner]);

  function handlingKnapp(props: { ikon: ReactNode; tekst: string; onClick: () => void; disabled?: boolean; tittel?: string; farge?: string }) {
    return (
      <button
        type="button"
        onClick={props.onClick}
        disabled={props.disabled}
        title={props.tittel ?? props.tekst}
        aria-label={props.tekst}
        className={`inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white disabled:cursor-not-allowed disabled:opacity-40 ${props.farge ?? "text-gray-600 hover:bg-gray-50"}`}
      >
        {props.ikon}
      </button>
    );
  }

  /** `s` bare når kortet står uten dagsrad («Etter prosjekt»): da bærer kortet «Egne timer». */
  function kortHandlinger(kort: AttKort, s?: AttSedel) {
    const egne = kort.linjer.filter(iKontekst);
    const ventende = egne.filter((l) => l.harHandling && l.ventende);
    const sperre = kort.linjer.find((l) => l.sperre)?.sperre;
    return (
      <span className="flex items-center gap-1">
        {s && egenMerke(s)}
        {!laast(sedelFor(kort.sheetId)) && ventende.length > 0 && (
          <>
            {handlingKnapp({ ikon: <Check className="h-4 w-4" />, tekst: t("timer.attestering.tabell.attesterKort"), tittel: sperre ?? undefined, disabled: opptatt || !!sperre, onClick: () => attester(slaaSammen(ventende)), farge: "text-green-700 hover:bg-green-50" })}
            {handlingKnapp({ ikon: <CornerUpLeft className="h-4 w-4" />, tekst: t("timer.attestering.tabell.returnerKort"), onClick: () => setReturner(slaaSammen(ventende)) })}
          </>
        )}
        {kortGjenaapne(kort)}
        {/* «Etter prosjekt» har ingen dagsrad, så lenken til sedelen står på kortet. */}
        {gruppering === "prosjekt" && sedelLenke(kort.sheetId)}
      </span>
    );
  }

  /** Jobbens ↺: gjenåpner de attesterte linjene på kortet (innenfor prosjektkonteksten). */
  function kortGjenaapne(kort: AttKort) {
    const attesterte = kort.linjer.filter((l) => iKontekst(l) && l.harHandling && l.attestert);
    if (attesterte.length === 0) return null;
    return handlingKnapp({ ikon: <RotateCcw className="h-4 w-4" />, tekst: t("timer.attestering.tabell.gjenaapneKort"), disabled: opptatt, onClick: () => gjenaapne(slaaSammen(attesterte)) });
  }

  function sedelLenke(sheetId: string) {
    if (!sedelUrl) return null;
    return (
      <Link href={sedelUrl(sheetId)} title={t("timer.attestering.tabell.aapneDagsseddel")} aria-label={t("timer.attestering.tabell.aapneDagsseddel")} className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    );
  }

  /**
   * Dagsradens knapper. Med én jobb (`enKort`) vises ikke jobbraden: dagens «Attester» og ↩
   * dekker de samme linjene, og jobbens ↺ står her (w5b, B14 A punkt 2).
   */
  function dagHandlinger(dag: AttDag, enKort?: AttKort) {
    const s = dag.sedel;
    if (prosjektKontekst) {
      // Prosjektlederen attesterer bare linjene på sine prosjekter (R13, T30) — aldri hele sedelen.
      const linjer = dag.kort.flatMap((k) => k.linjer);
      const egne = byggUtvalg(linjer, sedelFor, prosjektKontekst);
      const attesterte = slaaSammen(linjer.filter((l) => iKontekst(l) && l.harHandling && l.attestert));
      return (
        <span className="flex items-center gap-1">
          {slettetMerke?.(s.id)}
          {egenMerke(s)}
          {!laast(s) && egne.antallLinjer > 0 && (
            <>
              <Button size="sm" className="whitespace-nowrap" onClick={() => attester(egne.radIder)} disabled={opptatt} title={t("timer.attestering.tabell.attesterDineProsjekter")} aria-label={t("timer.attestering.tabell.attesterDineProsjekter")}>
                <Check className="mr-1 h-3.5 w-3.5" />
                {t("timer.attestering.attester")}
              </Button>
              {handlingKnapp({ ikon: <CornerUpLeft className="h-4 w-4" />, tekst: t("timer.attestering.tabell.returnerKort"), onClick: () => setReturner(egne.radIder) })}
            </>
          )}
          {antallRader(attesterte) > 0 &&
            handlingKnapp({ ikon: <RotateCcw className="h-4 w-4" />, tekst: t("timer.attestering.tabell.gjenaapneKort"), disabled: opptatt, onClick: () => gjenaapne(attesterte) })}
          {sedelLenke(s.id)}
        </span>
      );
    }
    // w7 (B15): egen sedel — ingen attester/returner/gjenåpne; merket der knappene ellers står forklarer.
    const egen = s.egneTimer === true;
    return (
      <span className="flex items-center gap-1">
        {slettetMerke?.(s.id)}
        {egenMerke(s)}
        {!laast(s) && !egen && (
          <>
            {/* Kort tekst (w5): raden heter alt «Sum <dato> · <ansatt>»; full tekst som tittel. */}
            <Button size="sm" className="whitespace-nowrap" onClick={() => { setMelding(null); attesterDag.mutate({ id: s.id }); }} disabled={opptatt || !!dag.sperre} title={dag.sperre ?? t("timer.attestering.tabell.attesterDagen")} aria-label={t("timer.attestering.tabell.attesterDagen")}>
              <Check className="mr-1 h-3.5 w-3.5" />
              {t("timer.attestering.attester")}
            </Button>
            {handlingKnapp({ ikon: <CornerUpLeft className="h-4 w-4" />, tekst: t("timer.attestering.returner"), onClick: () => onReturnerDag?.(s.id) })}
          </>
        )}
        {enKort && !s.attestertVisning && kortGjenaapne(enKort)}
        {laast(s) && !egen && (
          <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => setGjenaapneDag(s.id)} title={t("timer.attestering.tabell.gjenaapneDagen")} aria-label={t("timer.attestering.tabell.gjenaapneDagen")}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            {t("timer.attestering.tabell.gjenaapne")}
          </Button>
        )}
        {sedelLenke(s.id)}
      </span>
    );
  }

  /** w10a (B24 B, B31 B): linja har ingen knapper; kvitteringen på utlegg er det eneste. */
  function linjeHandlinger(l: AttLinje) {
    if (l.kilde.type !== "utlegg" || !iKontekst(l)) return null;
    return (
      <span className="flex items-center gap-1">
        <Kvitteringer vedlegg={l.kilde.rad.vedlegg ?? []} />
      </span>
    );
  }

  /**
   * ✂ ved linja i kortet (w10a A2): samme vilkår som ✂ hadde på linja — WM54/B10: bare når
   * firmaet har «rediger ved attestering» på.
   */
  function kanSplitte(l: AttLinje): boolean {
    if (!iKontekst(l)) return false;
    const redigerTillatt = sedelFor(l.sheetId)?.redigerTillatt === true;
    return !laast(sedelFor(l.sheetId)) && redigerTillatt && l.ventende && l.projectId !== null && (l.kilde.type === "timer" || l.kilde.type === "maskin" || l.kilde.type === "tillegg");
  }

  /**
   * «✎ Rediger jobben» (w10a A2, B27 A): samme vilkår som pennen hadde på linja, for minst én
   * linje i jobben. Vinduet åpnes for jobbens prosjekt og underprosjekt.
   */
  function redigerJobb(kort: AttKort): (() => void) | undefined {
    const redigerTillatt = sedelFor(kort.sheetId)?.redigerTillatt === true;
    const kan = kort.linjer.some((l) => iKontekst(l) && !laast(sedelFor(kort.sheetId)) && redigerTillatt && l.ventende && l.projectId !== null && l.kilde.type !== "utlegg");
    if (!kan || kort.projectId === null) return undefined;
    const projectId = kort.projectId;
    const medEco = kort.linjer.find((l) => l.kilde.type === "timer" || l.kilde.type === "maskin");
    const ecoId = medEco && (medEco.kilde.type === "timer" || medEco.kilde.type === "maskin") ? medEco.kilde.rad.externalCostObjectId ?? null : null;
    return () => setRediger({ sheetId: kort.sheetId, projectId, ecoId });
  }

  /* ---------------- Avkrysningen på de blå radene (w10a A7, B30 A) ---------------- */

  /** Jobben kan krysses av: minst én ventende linje med handling, i konteksten, uten sperre. */
  const kortKanVelges = (kort: AttKort) =>
    !laast(sedelFor(kort.sheetId)) && kort.linjer.some((l) => l.harHandling && l.ventende && !l.sperre && iKontekst(l));

  /** Kryss for jobbene `kort` (én jobb, eller alle jobbene på dagen). Ingen å velge → ingen kryss. */
  function kryss(kort: readonly AttKort[], etikett: string): ReactNode | undefined {
    const nokler = kort.filter(kortKanVelges).map((k) => k.nokkel);
    if (nokler.length === 0) return undefined;
    return (
      <input
        type="checkbox"
        aria-label={etikett}
        checked={nokler.every((n) => valgte.has(n))}
        onChange={(e) => {
          const paa = e.target.checked;
          setValgte((v) => {
            const ny = new Set(v);
            for (const n of nokler) if (paa) ny.add(n); else ny.delete(n);
            return ny;
          });
        }}
        className="h-3.5 w-3.5 rounded"
      />
    );
  }

  /** Registreringen åpnet under jobbraden (w8): hele jobben (kortet). */
  function registrering(kort: AttKort, s: AttSedel) {
    const egne = kort.linjer.filter((l) => iKontekst(l) && l.harHandling);
    const kanAttestere = !laast(s) && egne.length > 0;
    return (
      <RegistreringPanel
        key={kort.nokkel}
        kort={kort}
        sedel={s}
        orgId={orgId}
        kanAttestere={kanAttestere}
        kanRette={kanAttestere && s.redigerTillatt && egne.some((l) => l.ventende)}
        lonnsarter={lonnsarter ?? []}
        tidsrunding={tidsrunding}
        kanSplitte={kanSplitte}
        onSplitt={setSplitt}
        onRedigerJobb={redigerJobb(kort)}
        onEndret={oppfrisk}
        onLukk={() => setAapenKort(null)}
        prosjektKontekst={prosjektKontekst}
      />
    );
  }

  /* ---------------- Dagsblokkene (w5b, B14 A) ---------------- */

  // Ukedag foran datoen i dagsraden: «tir. 17.11.».
  const ukedagDato = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    const ukedag = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(i18n.language, { weekday: "short" });
    return ukedag ? `${ukedag} ${dato(iso)}` : dato(iso);
  };

  /**
   * w7 (B15): «Egne timer» på attestantens egen sedel, forklaringen på hover. Merket står i
   * handlingscellen der knappene ellers står — Avvik-kolonnen kuttet det ved 1 440 (w7 retur 1).
   */
  function egenMerke(s: AttSedel): ReactNode {
    if (!s.egneTimer) return null;
    return <AvvikMerker merker={[{ tekst: t("timer.attestering.egneTimer.merke"), forklaring: t("timer.attestering.egneTimer.forklaring") }]} />;
  }

  /**
   * Normen som merke (w5b): bare når dagen avviker; hele regnestykket på hover (mønsteret fra B7).
   * A1 (§ 4.17, punkt 1 og 2): måles mot arbeid uten reise, med fravær som fyller normen
   * (`dagensTimer`). En vanlig dag har ikke merke.
   */
  function normMerke(s: AttSedel): AvvikMerke | null {
    const d = dagensTimer(s.timer, s.dagsnorm, lonnsart);
    if (d.norm == null || d.avvik == null || d.avvik === 0) return null;
    const deler = [
      t("timer.attestering.tabell.normHover.arbeid", { arbeid: formaterNorsk(d.arbeid), norm: formaterNorsk(d.norm) }),
      ...(d.fravaer > 0 ? [t("timer.attestering.tabell.normHover.fravaer", { timer: formaterNorsk(d.fravaer) })] : []),
      ...(d.overtid > 0 ? [t("timer.attestering.tabell.normHover.overtid", { timer: formaterNorsk(d.overtid) })] : []),
      ...(d.reise > 0 ? [t("timer.attestering.tabell.normHover.reise", { timer: formaterNorsk(d.reise) })] : []),
      t("timer.attestering.tabell.normHover.sum", { timer: formaterNorsk(d.sum) }),
    ];
    return {
      tekst: t("timer.attestering.tabell.normMerke", { avvik: `${d.avvik > 0 ? "+" : "−"}${kortTall(Math.abs(d.avvik))}` }),
      forklaring: deler.join(" · "),
    };
  }

  /* ---------------- Ukelinja (A4, plan § 4.17 del B) ---------------- */

  const ukeTekster = lagUkeTekster(t);

  /**
   * «N t kan trekkes» på dagen (B85): ukas tall, aldri mer enn dagens førte overtid. Bare når
   * uka er komplett (B53 A); hoveren er ukas regnestykke.
   */
  function kanTrekkesMerke(s: AttSedel, iso: string): AvvikMerke | null {
    const n = dagKanTrekkes(s.uke, iso);
    if (n <= 0.005 || !s.uke) return null;
    return {
      tekst: t("timer.attestering.tabell.uke.dagKanTrekkes", { timer: ukeTall(n) }),
      forklaring: ukeMerker(s.uke, ukeTekster, ukeTall)[0]?.forklaring ?? null,
    };
  }

  /**
   * Ukelinja (B50 A): navn · uke · ukesum av ukenorm · ordinært, overtid, fravær og reise ·
   * ukevarselet · kryss som velger alle dagene (B57). Uten reise i ukesummen (B85). Gult først
   * når uka er komplett; før det «Uka så langt» og dagene som mangler, i grått (B53 A).
   */
  function ukelinje(tittel: string, uke: AttUke, gDager: readonly AttDag[]): ReactNode {
    const r = uke.regnestykke;
    const merker = ukeMerker(uke, ukeTekster, ukeTall);
    const fordeling = [
      r.sumOrdinaert > 0 ? t("timer.attestering.tabell.uke.ordinaert", { timer: ukeTall(r.sumOrdinaert) }) : null,
      r.sumOvertid > 0 ? t("timer.attestering.tabell.uke.overtid", { timer: ukeTall(r.sumOvertid) }) : null,
      r.fravaer > 0 ? t("timer.attestering.tabell.uke.fravaer", { timer: ukeTall(r.fravaer) }) : null,
      r.reise > 0 ? t("timer.attestering.tabell.uke.reise", { timer: ukeTall(r.reise) }) : null,
    ].filter((x): x is string => !!x);
    const mangler = uke.manglerDager.map((iso) => ukedagDato(iso)).join(", ");
    const boks = kryss(gDager.flatMap((d) => d.kort), t("timer.attestering.tabell.uke.velgUka"));
    return (
      <span data-ukelinje={uke.komplett ? "komplett" : "saaLangt"} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
        {boks}
        <span>{tittel}</span>
        <span className="font-normal text-gray-600">{t("timer.attestering.uke.label", { nr: isoUkenummer(uke.ukestart) })}</span>
        <span data-ukesum="" className="tabular-nums">
          {t("timer.attestering.tabell.uke.sum", { sum: ukeTall(r.ukesum), norm: ukeTall(r.ukenorm) })}
        </span>
        {fordeling.length > 0 && <span className="font-normal text-gray-600">{fordeling.join(" · ")}</span>}
        {!uke.komplett && (
          <span data-uke-saa-langt="" className="font-normal text-gray-500">
            {t("timer.attestering.tabell.uke.saaLangt")}
            {mangler ? ` · ${t("timer.attestering.tabell.uke.mangler", { dager: mangler })}` : ""}
          </span>
        )}
        {merker.map((m) => <UkeMerkeVis key={m.tekst} merke={m} />)}
      </span>
    );
  }

  /**
   * A1 (§ 4.17, punkt 6): lønnsartmerkene på oversiktsraden — Betegnelse og over Fra–til.
   * Står avviket i Betegnelse (Avvik og Beskrivelse skjult), står det etter merkene.
   */
  const lonnsartFelt = (linjer: readonly AttLinje[], avvik?: ReactNode) => {
    if (!lPlass) return [];
    const merker = lonnsartMerker(linjer, lonnsart);
    return [{
      fra: lPlass.fra,
      antall: lPlass.antall,
      felt: "lonnsartfelt" as const,
      innhold: (
        <span className="flex flex-wrap items-center gap-1 font-normal">
          {merker.map((m) => <LonnsartMerkeVis key={m.nokkel} merke={m} />)}
          {avvik}
        </span>
      ),
    }];
  };

  /** Kortets felt slik raden over viser dem — linja skriver dem ikke på nytt når de er like. */
  function kortVerdi(k: TimerTabellKolKey, kort: AttKort): string | null {
    if (k === "prosjektnummer") return kort.prosjektnummer;
    if (k === "prosjekt") return kort.prosjekt;
    if (k === "underprosjekt") return kort.underprosjekt ?? "";
    if (k === "byggeplass") return kort.byggeplass ?? "";
    return null;
  }
  function skjulPaaLinje(l: AttLinje, kort: AttKort): TimerTabellKolKey[] {
    const ut: TimerTabellKolKey[] = ["dato", "ansatt", "ansattnr"];
    for (const k of ["prosjektnummer", "prosjekt", "underprosjekt", "byggeplass"] as const) {
      const v = timerTabellVerdi(k, l.linje, 0);
      if ((v == null ? "" : String(v)) === kortVerdi(k, kort)) ut.push(k);
    }
    return ut;
  }

  /**
   * Jobbraden (w12, § 4.11 C4): «Timer» er arbeidstimene, så tallet stemmer med «høyst X t».
   * Et kort med bare reise viser reisetimene (C7). Dagsraden summerer alt. Reisen står i egen
   * kolonne (O13, pkt 3).
   */
  const jobbTimer = (sum: { timer: number; reise: number }, kort: AttKort) =>
    formaterNorsk(kort.reise ? sum.timer : sum.timer - sum.reise);

  /** O13 (pkt 3): Reise og Overtid i dags- og jobbraden — tom celle når det er 0. */
  function reiseOvertidCelle(k: TimerTabellKolKey, reise: number, overtid: number): ReactNode | undefined {
    if (k === "reisetimer") return reise > 0 ? <span data-tall="reise" className={TALL_FARGE.reise}>{formaterNorsk(reise)}</span> : "";
    if (k === "overtid") return overtid > 0 ? <span data-tall="overtid" className={TALL_FARGE.overtid}>{formaterNorsk(overtid)}</span> : "";
    return undefined;
  }

  /** A2: det hoveren på prosjektnavnet viser om jobben. */
  const hoverJobb = (kort: AttKort): ProsjektHoverJobb => ({
    nokkel: kort.nokkel,
    prosjekt: kort.prosjekt,
    prosjektnummer: kort.prosjektnummer,
    byggeplass: kort.byggeplass,
    underprosjekt: kort.underprosjekt,
    beskrivelser: kortBeskrivelser(kort),
  });

  /**
   * O13 (pkt 2) / A2 (plan § 4.17 punkt 5, B56 A): prosjektnavnet i halvfet, med «↳» når jobben har
   * underprosjekt. Nummer, byggeplass, underprosjekt og «Hva gjorde du?» står i hoveren på navnet
   * (`ProsjektHover`) i stedet for på linje 2. For langt navn kuttes med «…».
   */
  function navnInnhold(kort: AttKort): ReactNode {
    return (
      <ProsjektHover jobber={[hoverJobb(kort)]}>
        <span data-prosjektnavn="" className="flex min-w-0 items-baseline gap-1">
          <span className="truncate font-semibold">{kort.prosjekt}</span>
          {kort.underprosjekt && <span data-underprosjekt-pil="" aria-hidden className="shrink-0 font-normal text-gray-500">↳</span>}
        </span>
      </ProsjektHover>
    );
  }
  const antallJobber = (dag: AttDag) => {
    // «N jobber» teller jobber, ikke reise alene i et kort (§ 4.11 C2). «1 jobb» vises ikke (O13).
    // O15 pkt 5: kort med bare reise (begge slag) telles for seg — «2 jobber · 1 reise», og
    // «1 jobb · 1 reise» når dagen har to kort (beslutning c).
    const reiser = dag.kort.filter(erBareReiseKort).length;
    const n = dag.kort.length - reiser;
    if (reiser === 0 && n < 2) return "";
    const deler = [
      ...(n > 0 ? [t("timer.attestering.tabell.antallJobber", { count: n })] : []),
      ...(reiser > 0 ? [t("timer.attestering.tabell.antallReiser", { count: reiser })] : []),
    ];
    // A2: hover på «N jobber» viser én blokk pr. jobb.
    return (
      <ProsjektHover jobber={dag.kort.map(hoverJobb)}>
        <span data-antall-jobber="" className="block truncate font-normal text-gray-500">{deler.join(" · ")}</span>
      </ProsjektHover>
    );
  };

  /**
   * O13 (R1, R2): navnefeltet i en dags- eller jobbrad. `spenn` til raden når feltet ligger over
   * kolonner; ellers står innholdet i én kolonne eller under ansattnavnet (`navnCelle`).
   */
  function navnefelt(innhold: ReactNode) {
    const p = sumPlass;
    const spenn = p.type === "spenn" ? [{ fra: p.fra, antall: p.antall, innhold }] : [];
    const navnCelle = (k: TimerTabellKolKey, ansatt: ReactNode): ReactNode | undefined => {
      if (p.tomme.has(k)) return "";
      if (p.type === "kolonne" && k === p.kolonne) return innhold;
      if (p.type === "ansatt" && k === "ansatt") return <span className="block min-w-0"><span className="block truncate">{ansatt}</span>{innhold}</span>;
      return undefined;
    };
    return { spenn, navnCelle };
  }

  function avvikCelle(merker: AvvikMerke[], tekster: string[] = []) {
    if (merker.length === 0 && tekster.length === 0) return "";
    return (
      // Én linje (w5): bryting gjorde raden dobbelt høy.
      <span className="inline-flex items-center gap-1 whitespace-nowrap font-normal text-gray-700" title={tekster.length > 0 ? tekster.join(" · ") : undefined}>
        {merker.length > 0 && <AvvikMerker merker={merker} />}
        {tekster.length > 0 && <span className="text-amber-700">{tekster.join(" · ")}</span>}
      </span>
    );
  }

  /** O6: jobbens «Hva gjorde du?» — timeradene uten reise, som registreringen viser dem. */
  function kortBeskrivelser(kort: AttKort): string[] {
    // O15 pkt 7 (O14 pkt 6, K3): kort med bare reise får reiselinja — «Til {sted} · 06:26–06:56»,
    // som timer-siden — og reisens beskrivelse.
    if (erBareReiseKort(kort)) {
      const sted = kort.byggeplass || kort.prosjekt;
      const reiser = kort.linjer
        .flatMap((l) => (l.kilde.type === "timer" ? [{ l, rad: l.kilde.rad }] : []))
        .sort((a, b) => (a.l.linje.fraTid ?? "").localeCompare(b.l.linje.fraTid ?? ""));
      const linje = ({ l, rad }: (typeof reiser)[number]) => {
        const retning = rad.erReise ? rad.reiseRetning : (rad.arbeidReiseRetning ?? null);
        // O17 pkt 21: reise mellom to kontorer vises som «{fra} → {til}».
        const stedTekst =
          kontorReiseTekst(t, rad.reiseRegel, kontorNavn) ??
          (retning === "ut"
            ? t("timer.prosjektkort.reiseTil", { sted })
            : retning === "retur"
              ? t("timer.prosjektkort.reiseFra", { sted })
              : sted);
        const tid = l.linje.fraTid && l.linje.tilTid ? ` · ${l.linje.fraTid}–${l.linje.tilTid}` : "";
        return `${stedTekst}${tid}`;
      };
      return [
        ...reiser.map(linje),
        ...jobbensBeskrivelser(reiser.map(({ l, rad }) => ({ fraTid: l.linje.fraTid, beskrivelse: rad.beskrivelse }))),
      ];
    }
    return jobbensBeskrivelser(
      kort.linjer.flatMap((l) =>
        l.kilde.type === "timer" && l.kilde.rad.erReise !== true
          ? [{ fraTid: l.linje.fraTid, beskrivelse: l.kilde.rad.beskrivelse }]
          : [],
      ),
    );
  }

  // A1: dagens lønnsartmerker teller alle dagens linjer, også dem filteret skjuler (som normmerket).
  const dagFor = useMemo(() => new Map(dager.map((d) => [d.sedel.id, d])), [dager]);
  const helDag = (dag: AttDag) => (dagFor.get(dag.sedel.id) ?? dag).kort.flatMap((k) => k.linjer);

  const rader = useMemo<TimerRadTabellRad<AttLinje>[]>(() => {
    const ut: TimerRadTabellRad<AttLinje>[] = [];
    const avsluttBlokk = () => {
      const siste = ut[ut.length - 1];
      if (siste && siste.kind !== "overskrift" && siste.blokk) siste.blokk = { ...siste.blokk, slutt: true };
    };
    // w8: registreringen står rett under raden som åpnet den (jobbraden, eller dagsraden når
    // dagen har én jobb), over timeradene. Timeradene åpner den ikke.
    const linjerFor = (kort: AttKort, s: AttSedel, kant: string) => {
      if (aapenKort === kort.nokkel) ut.push({ kind: "panel", nokkel: `p:${kort.nokkel}`, innhold: registrering(kort, s), blokk: { kant } });
      if (bareOversikt) return;
      for (const l of kort.linjer) {
        const skjul = skjulPaaLinje(l, kort);
        // O13 (B14c B): linjas navn over de tomme cellene foran Betegnelse, så det ikke kuttes.
        const spenn = linjeSpenn(plass, kolonner, skjul);
        ut.push({ kind: "linje", nokkel: l.nokkel, data: l, underlinjer: Math.max(1, l.linje.maskiner.length, l.linje.varer.length), blokk: { kant }, skjul, ...(spenn ? { spenn } : {}) });
      }
    };
    const aapne = (kort: AttKort) => ({
      onKlikk: () => setAapenKort((a) => (a === kort.nokkel ? null : kort.nokkel)),
      aapen: aapenKort === kort.nokkel,
      // A2 (§ 4.17 punkt 5): hoveren på hele raden (O6) er tatt ut; beskrivelsene står i hoveren
      // på prosjektnavnet (`ProsjektHover`).
    });
    const grupper = grupperModell(synlige, gruppering) ?? [{ nokkel: "", tittel: "", dager: synlige }];
    for (const gruppe of grupper) {
    if (gruppe.nokkel) {
      const gSum = sumLinjer(gruppe.dager.flatMap((d) => d.kort.flatMap((k) => k.linjer)));
      // A4 (B50 A): «Etter ansatt» har ukelinja med ukas regnestykke fra serveren.
      const uke = gruppering === "ansatt" ? ukeFor(gruppe.dager) : null;
      ut.push({
        kind: "overskrift",
        nokkel: `g:${gruppe.nokkel}`,
        innhold: uke ? (
          ukelinje(gruppe.tittel, uke, gruppe.dager)
        ) : (
          <span className="flex items-center justify-between gap-4">
            <span>{gruppe.tittel}</span>
            <span className="tabular-nums">{t("timer.attestering.tabell.gruppeSum", { timer: formaterNorsk(gSum.timer) })}</span>
          </span>
        ),
      });
    }
    for (const dag of gruppe.dager) {
      const s = dag.sedel;

      // «Etter prosjekt» viser bare prosjektets del av dagen — en dagsrad der ville villede (T28).
      // Hver jobb er sin egen blokk; jobbraden bærer dato og ansatt og har dagsradens utseende.
      if (gruppering === "prosjekt") {
        for (const kort of dag.kort) {
          const sum = sumLinjer(kort.linjer);
          const overtid = overtidFor(kort.linjer);
          const norm = normMerke(s);
          const trekkes = kort.linjer.some((l) => linjeSlag(l) === "overtid") ? kanTrekkesMerke(s, dag.dato) : null;
          const nf = navnefelt(navnInnhold(kort));
          const kortAvvik = () => avvikCelle([...(norm ? [norm] : []), ...(trekkes ? [trekkes] : []), ...unikeMerker(kort.linjer.flatMap((l) => l.avvikMerker))]);
          ut.push({
            kind: "sum",
            nokkel: `o:${kort.nokkel}`,
            variant: "dag",
            blokk: { kant: DAG_KANT },
            venstre: kryss([kort], t("timer.attestering.tabell.velgJobb")),
            hoyre: kortHandlinger(kort, s),
            ...aapne(kort),
            spenn: [...nf.spenn, ...lonnsartFelt(kort.linjer, avvikKol === "betegnelse" ? kortAvvik() : undefined)],
            celle: (k) => {
              const nc = nf.navnCelle(k, dag.ansatt);
              if (nc !== undefined) return nc;
              const ro = reiseOvertidCelle(k, sum.reise, overtid);
              if (ro !== undefined) return ro;
              switch (k) {
                case "dato": return ukedagDato(dag.dato);
                case "ansatt": return dag.ansatt;
                case "ansattnr": return dag.ansattnr ?? "";
                case "timer": return jobbTimer(sum, kort);
                case "maskintimer": return sum.maskintimer > 0 ? formaterNorsk(sum.maskintimer) : "";
                default:
                  return k === avvikKol ? kortAvvik() : "";
              }
            },
          });
          linjerFor(kort, s, KORT_KANT[0]);
          avsluttBlokk();
        }
        continue;
      }

      // Dagsraden øverst (B14 A): dato, ansatt, dagens sum, avvik og dagens knapper. Med én jobb
      // står jobbens prosjektnavn her (O13), og jobbraden vises ikke.
      const enKort = dag.kort.length === 1 ? dag.kort[0] : undefined;
      const alle = dag.kort.flatMap((k) => k.linjer);
      const dagSum = sumLinjer(alle);
      const norm = normMerke(s);
      const trekkes = kanTrekkesMerke(s, dag.dato);
      const dagMerker = [
        ...(norm ? [norm] : []),
        ...(trekkes ? [trekkes] : []),
        ...(enKort ? unikeMerker(enKort.linjer.flatMap((l) => l.avvikMerker)) : []),
      ];
      const dagTekster = [
        dag.sperre,
        s.normStatus === "cachet" ? t("timer.attestering.norm.cachet") : s.normStatus === "ukjent" ? t("timer.attestering.norm.ukjent") : null,
      ].filter((x): x is string => !!x);
      const dagOvertid = overtidFor(alle);
      // O13 (pkt 2): med én jobb står prosjektnavnet i dagsraden; med flere «N jobber» der.
      const dagNf = navnefelt(enKort ? navnInnhold(enKort) : antallJobber(dag));
      ut.push({
        kind: "sum",
        nokkel: `d:${s.id}`,
        variant: "dag",
        blokk: { kant: DAG_KANT },
        // Kryss på dagsraden velger alle jobbene på dagen; med én jobb er dagsraden jobben.
        venstre: kryss(dag.kort, enKort ? t("timer.attestering.tabell.velgJobb") : t("timer.attestering.tabell.velgDagen")),
        hoyre: dagHandlinger(dag, enKort),
        // Flere jobber: dagsraden er ikke én jobb og åpner ingenting; jobbradene gjør det.
        ...(enKort ? aapne(enKort) : {}),
        // A1: lønnsartmerkene for hele dagen (alle jobbene; filteret skjuler ingen timer her).
        spenn: [...dagNf.spenn, ...lonnsartFelt(helDag(dag), avvikKol === "betegnelse" ? avvikCelle(dagMerker, dagTekster) : undefined)],
        celle: (k) => {
          const nc = dagNf.navnCelle(k, dag.ansatt);
          if (nc !== undefined) return nc;
          const ro = reiseOvertidCelle(k, dagSum.reise, dagOvertid);
          if (ro !== undefined) return ro;
          switch (k) {
            case "dato": return ukedagDato(dag.dato);
            case "ansatt": return dag.ansatt;
            case "ansattnr": return dag.ansattnr ?? "";
            case "timer": return formaterNorsk(dagSum.timer);
            case "maskintimer": return dagSum.maskintimer > 0 ? formaterNorsk(dagSum.maskintimer) : "";
            default:
              if (k === avvikKol) return avvikCelle(dagMerker, dagTekster);
              return "";
          }
        },
      });

      dag.kort.forEach((kort, i) => {
        const kant = KORT_KANT[i % KORT_KANT.length]!;
        // Flere jobber samme dag (Kenneths tillegg til B14): hver jobb sin jobbrad og sin kantfarge.
        if (!enKort) {
          const sum = sumLinjer(kort.linjer);
          const overtid = overtidFor(kort.linjer);
          const nf = navnefelt(navnInnhold(kort));
          ut.push({
            kind: "sum",
            nokkel: `o:${kort.nokkel}`,
            variant: "jobb",
            blokk: { kant },
            venstre: kryss([kort], t("timer.attestering.tabell.velgJobb")),
            hoyre: kortHandlinger(kort),
            ...aapne(kort),
            spenn: [...nf.spenn, ...lonnsartFelt(kort.linjer, avvikKol === "betegnelse" ? avvikCelle(unikeMerker(kort.linjer.flatMap((l) => l.avvikMerker))) : undefined)],
            celle: (k) => {
              const nc = nf.navnCelle(k, "");
              if (nc !== undefined) return nc;
              const ro = reiseOvertidCelle(k, sum.reise, overtid);
              if (ro !== undefined) return ro;
              if (k === "timer") return jobbTimer(sum, kort);
              if (k === "maskintimer") return sum.maskintimer > 0 ? formaterNorsk(sum.maskintimer) : "";
              if (k === avvikKol) return avvikCelle(unikeMerker(kort.linjer.flatMap((l) => l.avvikMerker)));
              return "";
            },
          });
        }
        linjerFor(kort, s, kant);
      });
      avsluttBlokk();
    }
    }
    return ut;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlingene leser fersk tilstand ved klikk
  }, [synlige, gruppering, bareOversikt, t, readOnly, opptatt, plass, sumPlass, lPlass, kolonner, avvikKol, prosjektKontekst, medAar, aapenKort, lonnsarter, lonnsart, overtidsnivaa, i18n.language, valgte, tidsrunding, dagFor]);

  /* ---------------- Filter i hodet (R8) ---------------- */

  const filter = {
    verdier: filterVerdier,
    onEndring: (k: TimerTabellKolKey, v: string) => setFilterVerdier((f) => ({ ...f, [k]: v })),
    alternativer: (k: TimerTabellKolKey) => {
      if (k === "avvik") return [
        { value: AVVIK_FILTER.kreverVurdering, label: t("timer.attestering.ekspander.kreverVurdering") },
        { value: AVVIK_FILTER.harAvvik, label: t("timer.attestering.tabell.harAvvik") },
      ];
      if (!FILTER_KOLONNER.includes(k)) return undefined;
      return filterAlternativer(dager, k).map((v) => ({ value: v, label: k === "type" ? typeTekst(v) : k === "dato" ? dato(v) : v }));
    },
    sok: (k: TimerTabellKolKey) => (k === "beskrivelse" ? { verdi: beskrivelseSok, onChange: setBeskrivelseSok } : undefined),
  };

  const brikker: { nokkel: string; tekst: string; fjern: () => void }[] = [
    ...Object.entries(filterVerdier)
      .filter(([, v]) => v)
      .map(([k, v]) => {
        const kk = k as TimerTabellKolKey;
        const etiketter = v.split(",").map((x) => (filter.alternativer(kk) ?? []).find((a) => a.value === x)?.label ?? x);
        return { nokkel: `f:${k}`, tekst: `${overskrift(kk)}: ${etiketter.join(", ")}`, fjern: () => setFilterVerdier((f) => ({ ...f, [k]: "" })) };
      }),
    ...(beskrivelseSok ? [{ nokkel: "sok", tekst: `${overskrift("beskrivelse")}: «${beskrivelseSok}»`, fjern: () => setBeskrivelseSok("") }] : []),
    ...(sortering
      ? [{ nokkel: "sort", tekst: `${overskrift(sortering.k)} ${sortering.retning === "asc" ? "↑" : "↓"}`, fjern: () => setSortering(null) }]
      : []),
  ];

  const velgerGrupper = useMemo(
    () => [{ id: "alle", navn: t("timer.attestering.tabell.kolonner"), felter: TIMER_TABELL_KOL_KEYS.map((k) => ({ id: k, navn: t(`timer.eksport.${TIMER_TABELL_KOL[k].velgerI18n ?? TIMER_TABELL_KOL[k].i18n}`) })) }],
    [t],
  );

  // Hodets kryss velger alle synlige jobber som kan velges.
  const valgbare = synlige.flatMap((d) => d.kort).filter(kortKanVelges).map((k) => k.nokkel);
  const alleValgt = valgbare.length > 0 && valgbare.every((n) => valgte.has(n));

  return (
    <div className="flex flex-col gap-2">
      {/* Én verktøylinje (R17) */}
      <div className="flex flex-wrap items-center gap-2">
        {verktoy}
        <button type="button" onClick={() => setVisVelger(true)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t("timer.attestering.tabell.velgParameter")}
        </button>
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
          <input type="checkbox" checked={bareOversikt} onChange={(e) => setBareOversikt(e.target.checked)} className="h-3.5 w-3.5 rounded" />
          {t("timer.attestering.tabell.bareOversikt")}
        </label>
        {ukeoversikt && <button type="button" onClick={() => setVisUke((v) => !v)} aria-pressed={visUke} className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${visUke ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>
          {t("timer.attestering.tabell.ukeoversikt")}
        </button>}
        {brikker.map((b) => (
          <span key={b.nokkel} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-800">
            {b.tekst}
            <button type="button" onClick={b.fjern} aria-label={t("timer.attestering.tabell.fjernFilter", { navn: b.tekst })} className="rounded-full p-0.5 hover:bg-blue-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <span className="ml-auto text-xs text-gray-500">
          {t("timer.attestering.tabell.teller", { n: synligeLinjer.length, m: alleLinjer.length })}
        </span>
        {!readOnly && (
          <Button size="sm" onClick={attesterUtvalget} disabled={opptatt || utvalg.antallJobber === 0}>
            <Check className="mr-1 h-3.5 w-3.5" />
            {t("timer.attestering.tabell.attesterUtvalget", { antall: utvalg.antallJobber })}
          </Button>
        )}
      </div>

      {melding && <p className="text-sm text-red-600">{melding}</p>}
      {visUke && ukeoversikt && (
        <div>
          {ukeoversikt({
            dager: ukeDager,
            valgtDato: filterVerdier.dato || null,
            velgDato: (iso) => setFilterVerdier((f) => ({ ...f, dato: f.dato === iso ? "" : iso })),
          })}
        </div>
      )}

      {dager.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">{t("timer.attestering.ingenSedler")}</div>
      ) : (
        <TimerRadTabell<AttLinje>
          kolonner={kolonner}
          rader={rader}
          celle={celle}
          bredder={oppsett.kolonneBredder}
          onBreddeEndring={oppsett.handleBreddeEndring}
          onRekkefolgeEndring={oppsett.handleRekkefolgeEndring}
          sorterVerdi={(k, l) => timerTabellVerdi(k, l.linje, 0)}
          sortering={sortering}
          onSortering={setSortering}
          filter={filter}
          rammeKlasse="h-[calc(100vh-15rem)] min-h-[320px]"
          venstre={{
            bredde: VENSTRE,
            hode: readOnly ? undefined : (
              <input
                type="checkbox"
                aria-label={t("timer.attestering.tabell.velgAlle")}
                checked={alleValgt}
                onChange={(e) => setValgte(e.target.checked ? new Set(valgbare) : new Set())}
                className="h-3.5 w-3.5 rounded"
              />
            ),
            // w10a (A7): linjene har ingen avkrysning; den står på de blå radene.
            celle: () => null,
          }}
          hoyre={{ bredde: HOYRE, celle: linjeHandlinger }}
          linjeKlasse={(l) => (iKontekst(l) ? undefined : "opacity-50")}
          linjeBakgrunn={(l) => (linjeVarsel(l, lonnsart) ? GUL_LINJE : undefined)}
          standardBredder={ATTESTERING_BREDDE}
          hodeBrytes
          hodeTekst={(k) => (HODE_KORT.has(k) ? t(`timer.attestering.tabell.hode.${k}`) : undefined)}
        />
      )}

      <KolonneVelger
        apen={visVelger}
        onLukk={() => setVisVelger(false)}
        aktive={oppsett.aktiveKolonner}
        onToggle={oppsett.handleToggleKolonne}
        grupper={velgerGrupper}
        sorterbar
        rekkefolge={oppsett.kolonneRekkefolge}
        onRekkefolgeEndring={oppsett.handleRekkefolgeEndring}
        flyttTekst={(navn) => t("kolonne.flytt", { navn })}
        fjernTekst={(navn) => t("kolonne.fjern", { navn })}
        sokPlaceholder={t("handling.sok")}
        nullstillTekst={t("timer.attestering.tabell.tilbakestillStandard")}
        okTekst={t("handling.ok")}
      />

      {returner && <ReturnerRaderDialog radIder={returner} onLukk={() => setReturner(null)} onFerdig={() => { setReturner(null); oppfrisk(); }} />}
      {gjenaapneDag && <GjenaapneDagDialog sheetId={gjenaapneDag} onLukk={() => setGjenaapneDag(null)} onFerdig={() => { setGjenaapneDag(null); oppfrisk(); }} />}
      {splitt && splitt.kilde.type !== "vare" && splitt.kilde.type !== "utlegg" && (
        <SplittFor linje={splitt} orgId={orgId} prosjekter={prosjekter} tidsrunding={tidsrunding} onLukk={() => setSplitt(null)} onLagret={() => { setSplitt(null); oppfrisk(); }} />
      )}
      {rediger && (
        <RedigerRadModal
          sheetId={rediger.sheetId}
          projectId={rediger.projectId}
          ecoId={rediger.ecoId}
          onLukk={() => setRediger(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SplittFor({ linje, orgId, prosjekter, tidsrunding, onLukk, onLagret }: {
  linje: AttLinje; orgId: string; prosjekter: ProsjektValg[]; tidsrunding: number | null; onLukk: () => void; onLagret: () => void;
}) {
  const felles = { sheetId: linje.sheetId, organizationId: orgId, prosjekter, tidsrundingMinutter: tidsrunding, onLukk, onLagret };
  const k = linje.kilde;
  if (k.type === "timer") return <SplittRadModal radType="timer" original={{ ...k.rad, projectId: k.rad.projectId ?? "" }} {...felles} />;
  if (k.type === "maskin") return <SplittRadModal radType="maskin" original={k.rad} {...felles} />;
  if (k.type === "tillegg") return <SplittRadModal radType="tillegg" original={k.rad} {...felles} />;
  return null;
}

function ReturnerRaderDialog({ radIder, onLukk, onFerdig }: { radIder: RadIder; onLukk: () => void; onFerdig: () => void }) {
  const { t } = useTranslation();
  const [kommentar, setKommentar] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const returner = trpc.timer.dagsseddel.returnerRader.useMutation({
    onSuccess: (_d: unknown) => onFerdig(),
    onError: (e: { message: string }) => setFeil(e.message),
  });
  return (
    <Modal open onClose={onLukk} title={t("timer.attestering.returnerTittel")}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (kommentar.trim()) returner.mutate({ radIder, kommentar: kommentar.trim() }); }}
        className="space-y-4"
      >
        <p className="text-sm text-gray-600">{t("timer.attestering.tabell.returnerLinjer", { count: antallRader(radIder) })}</p>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("timer.attestering.kommentar")}</label>
          <textarea value={kommentar} onChange={(e) => setKommentar(e.target.value)} rows={4} placeholder={t("timer.attestering.kommentarPlaceholder")} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" autoFocus required />
        </div>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>{t("handling.avbryt")}</Button>
          <Button type="submit" disabled={returner.isPending || !kommentar.trim()}>{returner.isPending ? t("handling.lagrer") : t("timer.attestering.returner")}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Gjenåpne hele sedelen — samme vindu og samme kall som i dag (HM52). */
function GjenaapneDagDialog({ sheetId, onLukk, onFerdig }: { sheetId: string; onLukk: () => void; onFerdig: () => void }) {
  const { t } = useTranslation();
  const [feil, setFeil] = useState<string | null>(null);
  const gjenaapne = trpc.timer.dagsseddel.gjenaapneAttestering.useMutation({
    onSuccess: (_d: unknown) => onFerdig(),
    onError: (e: { message: string }) => setFeil(e.message),
  });
  return (
    <Modal open onClose={onLukk} title={t("timer.attestering.gjenaapne.tittel")}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{t("timer.attestering.gjenaapne.beskrivelse")}</p>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>{t("handling.avbryt")}</Button>
          <Button type="button" disabled={gjenaapne.isPending} onClick={() => gjenaapne.mutate({ sheetId })}>
            {gjenaapne.isPending ? t("handling.lagrer") : t("timer.attestering.gjenaapne.bekreft")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Avvikene som korte merker (w1, B7) med forklaringen på hover/trykk; øvrige som tekst.
 * w9 retur 1 (valg A): hvert merke står helt ved 1 440 i Avvik (68 px, ingen annen kolonne har
 * luft — målt). Merketekstene er korte («Uten bevis», «Over arbeid»), hele teksten står på hover.
 * Merkene stables når de ikke får plass ved siden av hverandre, og et merke bredere enn kolonnen
 * brytes ved mellomrom. Cella er `truncate`, så beholderen setter bryting på igjen.
 */
function AvvikMerker({ merker }: { merker: readonly AvvikMerke[] }) {
  return (
    <span className="flex flex-wrap items-start gap-1 whitespace-normal text-amber-700">
      {merker.map((m, i) =>
        m.forklaring ? (
          <Tooltip key={`${i}:${m.tekst}`} tekst={m.forklaring} side="bottom" delayMs={150}>
            <span
              data-avvik-merke=""
              className="max-w-full cursor-help rounded-lg border border-amber-300 bg-amber-50 px-1 py-px text-[11px] font-medium leading-4 text-amber-800"
            >
              {m.tekst}
            </span>
          </Tooltip>
        ) : (
          <span key={`${i}:${m.tekst}`} className="whitespace-normal">
            {m.tekst}
          </span>
        ),
      )}
    </span>
  );
}

/** A1: tallet i et merke uten unødige nuller — «7,5», «10». */
function kortTall(n: number): string {
  return formaterNorsk(n).replace(/,?0+$/, "") || "0";
}

/**
 * A1 (§ 4.17 del B): ett lønnsartmerke på oversiktsraden — «Overtid 50 % 2,5». Gult når
 * linjene bak har et varsel (overtid, fravær, reise under terskel), ellers nøytralt. Hover viser
 * linjene bak tallet med fra–til.
 */
function LonnsartMerkeVis({ merke }: { merke: LonnsartMerke }) {
  const linjer = merke.linjer
    .map((l) => (l.fraTid && l.tilTid ? `${l.fraTid}–${l.tilTid} ${kortTall(l.timer)} t` : `${kortTall(l.timer)} t`))
    .join(" · ");
  const farge = merke.varsel ? "border-amber-300 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-700";
  return (
    <Tooltip tekst={linjer} side="bottom" delayMs={150}>
      <span
        data-lonnsart-oversikt={merke.varsel ?? ""}
        className={`cursor-help whitespace-nowrap rounded-lg border px-1 py-px text-[11px] font-medium leading-4 ${farge}`}
      >
        {merke.navn} {kortTall(merke.timer)}
      </span>
    </Tooltip>
  );
}

/** Kortets oversiktsrad viser hvert avvik én gang. */
function unikeMerker(merker: readonly AvvikMerke[]): AvvikMerke[] {
  const sett = new Map<string, AvvikMerke>();
  for (const m of merker) if (!sett.has(m.tekst)) sett.set(m.tekst, m);
  return [...sett.values()];
}

/** A4: tekstene til ukelinjas merker og regnestykket på hover. */
function lagUkeTekster(t: (k: string, o?: Record<string, unknown>) => string): UkeTekster {
  return {
    underNorm: (timer) => t("timer.attestering.tabell.uke.underNorm", { timer }),
    kanTrekkes: (timer, overtid) => t("timer.attestering.tabell.uke.kanTrekkes", { timer, overtid }),
    overNorm: (timer) => t("timer.attestering.tabell.uke.overNorm", { timer }),
    regnestykke: (r) => t("timer.attestering.tabell.uke.regnestykke", r),
  };
}

/** A4: ukevarselet som merker — ukelinja og ukeoversiktens normkolonne. */
export function UkevarselMerker({ uke }: { uke: AttUke }) {
  const { t } = useTranslation();
  const merker = ukeMerker(uke, lagUkeTekster(t), ukeTall);
  if (merker.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {merker.map((m) => <UkeMerkeVis key={m.tekst} merke={m} />)}
    </span>
  );
}

/**
 * A4 RETUR vilkår 4: banneret i attesteringsdetaljen — samme merker og regnestykke som
 * ukelinja, bare når uka er komplett (B53 A). Kun varsel; sperrer ikke.
 */
export function UkeBanner({ uke }: { uke: AttUke }) {
  const { t } = useTranslation();
  if (!uke.komplett) return null;
  const merker = ukeMerker(uke, lagUkeTekster(t), ukeTall);
  if (merker.length === 0) return null;
  return (
    <div data-ukebanner="" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">{merker.map((m) => m.tekst).join(" · ")}</p>
          <p className="mt-0.5 text-xs text-amber-800">{merker[0]!.forklaring}</p>
        </div>
      </div>
    </div>
  );
}

/** A4: ett merke på ukelinja — gult når uka er komplett, grått før det; regnestykket på hover. */
function UkeMerkeVis({ merke }: { merke: UkeMerke }) {
  const farge = merke.gul ? "border-amber-300 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-500";
  return (
    <Tooltip tekst={merke.forklaring} side="bottom" delayMs={150}>
      <span
        data-ukevarsel={merke.gul ? "gul" : "graa"}
        className={`cursor-help whitespace-nowrap rounded-lg border px-1 py-px text-[11px] font-medium leading-4 ${farge}`}
      >
        {merke.tekst}
      </span>
    </Tooltip>
  );
}

/** ISO-ukenummeret til en mandag (YYYY-MM-DD). */
function isoUkenummer(iso: string): number {
  const d = new Date(`${iso}T00:00:00.000Z`);
  const dag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dag);
  const aarStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - aarStart.getTime()) / 86400000 + 1) / 7);
}
