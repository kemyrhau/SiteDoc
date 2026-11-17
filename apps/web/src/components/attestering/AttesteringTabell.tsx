"use client";

import { useMemo, useState, type ReactNode, type KeyboardEvent } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Check, CornerUpLeft, RotateCcw, Scissors, Pencil, X, SlidersHorizontal, ExternalLink, Paperclip } from "lucide-react";
import { Button, Modal, Tooltip } from "@sitedoc/ui";
import {
  TIMER_TABELL_KOL,
  TIMER_TABELL_KOL_KEYS,
  TIMER_TABELL_STANDARD,
  timerTabellVerdi,
  type TimerTabellKolKey,
} from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { SignertBilde } from "@/components/SignertBilde";
import { SignertLenke } from "@/components/SignertLenke";
import { formaterNorsk } from "@/lib/timer-rapport-eksport";
import { useTabelloppsett } from "@/hooks/useTabelloppsett";
import { KolonneVelger } from "@/components/ui/KolonneVelger";
import {
  TimerRadTabell,
  type TimerRadTabellRad,
  type TimerRadTabellSortering,
} from "@/components/timer/TimerRadTabell";
import { SplittRadModal } from "@/components/timer/SplittRadModal";
import type { ProsjektValg } from "@/components/timer/rediger-types";
import { RedigerRadModal } from "./RedigerRadModal";
import { RegistreringPanel } from "./RegistreringPanel";
import { ReiseRadMerke } from "./ReiseRadMerke";
import {
  AVVIK_FILTER,
  FILTER_KOLONNER,
  antallRader,
  byggUtvalg,
  filterAlternativer,
  filtrerModell,
  grupperModell,
  linjeIKontekst,
  slaaSammen,
  spennerFlereAar,
  sumLinjer,
  visDato,
  type AttDag,
  type AttKort,
  type AttLinje,
  type AttSedel,
  type AttVedlegg,
  type AvvikMerke,
  type Gruppering,
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
 * Dagseddel → prosjektsedler (kort) → linjer. Hvert kort har en oversiktsrad (R4) med ✓,
 * retur og gjenåpne for kortet; linjene har sine egne (R10, R23); dagseddelens sum står i
 * en rad nederst med «Attester dagen» / «Gjenåpne dagen» og lenke til sedelen — uten
 * retting (Kenneth runde 3). Retting skjer i cella på linja (R21).
 *
 * Én verktøylinje (R17): sidens uke/gruppering/fane kommer inn som `verktoy`, resten
 * eies her. Filter, sortering og «bare oversiktsrader» gjelder besøket (R7).
 */

type Felt = "fraTid" | "tilTid" | "timer" | "pauseMin" | "lonnsartId" | "aktivitetId" | "vehicleId" | "mengde" | "enhet" | "antall";
type Mal = { radType: "timer" | "maskin" | "tillegg"; radId: string; felt: Felt; verdi: string; type: "tekst" | "tall" | "heltall" | "valg" };

const LISTE = "timer-attestering";
const STANDARD = new Set<string>(TIMER_TABELL_STANDARD);
/**
 * Visningsrekkefølgen for oppsett uten egen rekkefølge (ny bruker og «Tilbakestill til
 * standard»): kjernekolonnene i standardrekkefølgen først, så resten i listas rekkefølge (w5).
 */
const KANONISK: readonly string[] = [...TIMER_TABELL_STANDARD, ...TIMER_TABELL_KOL_KEYS.filter((k) => !STANDARD.has(k))];
const VENSTRE = 36;
// ✓ ↩ ✂ penn, og «Attester dagen» ↩ ↗ på sumraden — smalere brytes knappen og raden blir dobbelt høy (målt w5).
const HOYRE = 176;

/**
 * Attesteringens standardbredder (w5, punkt 5): smalere enn den delte lista, så de 13
 * kjernekolonnene står uten sidelengs rulling på en skjerm på 1 440 (målt: 1 170 px til
 * tabellen ved fast meny, minus 36 + 176 til de faste kolonnene). Hodet er kompakt med korte
 * overskrifter (`HODE_KORT`). Dratt bredde vinner fortsatt (R6). Rapportens Detaljer bruker
 * den delte lista uendret.
 */
const ATTESTERING_BREDDE: Partial<Record<TimerTabellKolKey, number>> = {
  dato: 68,
  ansatt: 86,
  prosjektnummer: 72,
  underprosjekt: 88,
  betegnelse: 78,
  fraTil: 94,
  fraTid: 56,
  tilTid: 56,
  timer: 56,
  maskin: 82,
  maskintimer: 68,
  vareOgMengde: 84,
  antall: 56,
  belop: 54,
  avvik: 70,
};

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
   * Prosjektkontekst (F1, R13): bare prosjektets linjer kan velges og attesteres; linjer på
   * andre prosjekter vises nedtonet uten handlinger (T30). Firmaattesteringen har ingen.
   */
  prosjektKontekst?: string;
}

export function AttesteringTabell({ dager, orgId, readOnly, verktoy, ukeoversikt, gruppering = "dag", sedelUrl, onReturnerDag, prosjektKontekst }: Props) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const oppsett = useTabelloppsett({ liste: LISTE, standardKolonner: STANDARD, kanoniskRekkefolge: KANONISK });
  const kolonner = useMemo(
    () => oppsett.kolonneRekkefolge.filter((k): k is TimerTabellKolKey => k in TIMER_TABELL_KOL),
    [oppsett.kolonneRekkefolge],
  );
  const overskrift = (k: TimerTabellKolKey) => t(`timer.eksport.${TIMER_TABELL_KOL[k].i18n}`);

  // Besøkets tilstand (R7): aldri lagret.
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});
  const [beskrivelseSok, setBeskrivelseSok] = useState("");
  const [sortering, setSortering] = useState<TimerRadTabellSortering | null>(null);
  const [bareOversikt, setBareOversikt] = useState(false);
  const [visVelger, setVisVelger] = useState(false);
  const [visUke, setVisUke] = useState(false);
  const [valgte, setValgte] = useState<Set<string>>(new Set());
  const [melding, setMelding] = useState<string | null>(null);
  const [returner, setReturner] = useState<RadIder | null>(null);
  const [gjenaapneDag, setGjenaapneDag] = useState<string | null>(null);
  const [splitt, setSplitt] = useState<AttLinje | null>(null);
  const [rediger, setRediger] = useState<AttLinje | null>(null);
  const [redigerer, setRedigerer] = useState<{ nokkel: string; mal: Mal } | null>(null);
  const [celleFeil, setCelleFeil] = useState<Record<string, string>>({});
  // w5 (bilde 7): linja som har registreringen åpen under seg. Besøkets tilstand.
  const [aapenLinje, setAapenLinje] = useState<string | null>(null);

  const sedelFor = useMemo(() => {
    const m = new Map<string, AttSedel>();
    for (const d of dager) m.set(d.sedel.id, d.sedel);
    return (id: string) => m.get(id);
  }, [dager]);
  const iKontekst = (l: AttLinje) => {
    if (!prosjektKontekst) return true;
    const s = sedelFor(l.sheetId);
    return !!s && linjeIKontekst(l, s, prosjektKontekst);
  };

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

  // Utvalget (R10): avkryssede linjer blant de synlige; ingen avkrysset → alle synlige.
  const utvalgGrunnlag = useMemo(() => {
    const krysset = synligeLinjer.filter((l) => valgte.has(l.nokkel));
    return krysset.length > 0 ? krysset : synligeLinjer;
  }, [synligeLinjer, valgte]);
  const utvalg = useMemo(() => byggUtvalg(utvalgGrunnlag, sedelFor, prosjektKontekst), [utvalgGrunnlag, sedelFor, prosjektKontekst]);

  // Kataloger til valg-cellene (samme spørringer som useKatalogNavn — delt cache).
  const katalogInput = { organizationId: orgId };
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery(katalogInput);
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery(katalogInput);
  const { data: utstyrRaw } = trpc.maskin.equipment.list.useQuery(katalogInput);
  const utstyr = utstyrRaw as unknown as Array<{ id: string; merke: string; modell: string; internNavn: string | null }> | undefined;
  const { data: prosjekterRaw } = trpc.prosjekt.hentAlle.useQuery({ organizationId: orgId, inkluderFrosne: true });
  const prosjekter = (prosjekterRaw ?? []) as unknown as ProsjektValg[];
  const { data: innstilling } = trpc.organisasjon.hentSetting.useQuery({ organizationId: orgId });
  const tidsrunding = (innstilling as { tidsrundingMinutter?: number | null } | undefined)?.tidsrundingMinutter ?? null;

  const oppfrisk = () => {
    void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
    void utils.timer.dagsseddel.hentTilAttestering.invalidate();
    void utils.timer.dagsseddel.hentForAttestering.invalidate();
  };
  const feil = (e: { message: string }) => setMelding(e.message);
  const attesterRader = trpc.timer.dagsseddel.attesterRader.useMutation({ onSuccess: (_d: unknown) => { setValgte(new Set()); oppfrisk(); }, onError: feil });
  const gjenaapneRader = trpc.timer.dagsseddel.gjenaapneRader.useMutation({ onSuccess: (_d: unknown) => oppfrisk(), onError: feil });
  const attesterDag = trpc.timer.dagsseddel.attester.useMutation({ onSuccess: (_d: unknown) => oppfrisk(), onError: feil });
  const rettRadFelt = trpc.timer.dagsseddel.rettRadFelt.useMutation();
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

  /* ---------------- Retting i cella (R21, T61) ---------------- */

  function malFor(k: TimerTabellKolKey, l: AttLinje, under: number): Mal | null {
    const s = sedelFor(l.sheetId);
    if (readOnly || !s?.redigerTillatt || !l.ventende || !l.harHandling || !iKontekst(l)) return null;
    const kilde = l.kilde;
    if (kilde.type === "timer" && under === 0) {
      const r = kilde.rad;
      const m = (felt: Felt, verdi: unknown, type: Mal["type"]): Mal => ({ radType: "timer", radId: r.id, felt, verdi: verdi == null ? "" : String(verdi), type });
      if (k === "fraTid") return m("fraTid", r.fraTid, "tekst");
      if (k === "tilTid") return m("tilTid", r.tilTid, "tekst");
      if (k === "timer") return m("timer", r.timer, "tall");
      if (k === "pause") return m("pauseMin", r.pauseMin, "heltall");
      if (k === "betegnelse") return m("lonnsartId", r.lonnsartId, "valg");
      if (k === "aktivitet") return m("aktivitetId", r.aktivitetId, "valg");
    }
    const maskin = kilde.type === "timer" ? kilde.maskiner[under] : kilde.type === "maskin" && under === 0 ? kilde.rad : undefined;
    if (maskin) {
      const m = (felt: Felt, verdi: unknown, type: Mal["type"]): Mal => ({ radType: "maskin", radId: maskin.id, felt, verdi: verdi == null ? "" : String(verdi), type });
      if (k === "maskin") return m("vehicleId", maskin.vehicleId, "valg");
      if (k === "maskintimer") return m("timer", maskin.timer, "tall");
      if (k === "mengde") return m("mengde", maskin.mengde, "tall");
      if (k === "enhet") return m("enhet", maskin.enhet, "tekst");
    }
    if (kilde.type === "tillegg" && under === 0 && k === "antall") {
      return { radType: "tillegg", radId: kilde.rad.id, felt: "antall", verdi: String(kilde.rad.antall ?? ""), type: "tall" };
    }
    return null;
  }

  function lagre(nokkel: string, mal: Mal, verdi: string) {
    setRedigerer(null);
    if (verdi === mal.verdi) return;
    const tolket: string | number | null =
      mal.type === "tall" ? (verdi.trim() === "" ? null : Number(verdi.replace(",", "."))) :
      mal.type === "heltall" ? Number.parseInt(verdi, 10) :
      verdi.trim() === "" ? null : verdi.trim();
    if (typeof tolket === "number" && Number.isNaN(tolket)) {
      setCelleFeil((f) => ({ ...f, [nokkel]: t("timer.attestering.tabell.ugyldigTall") }));
      return;
    }
    setCelleFeil(({ [nokkel]: _bort, ...rest }) => rest);
    const felter = { [mal.felt]: tolket };
    const input =
      mal.radType === "timer" ? { radType: "timer" as const, radId: mal.radId, felter } :
      mal.radType === "maskin" ? { radType: "maskin" as const, radId: mal.radId, felter } :
      { radType: "tillegg" as const, radId: mal.radId, felter };
    rettRadFelt.mutate(input as Parameters<typeof rettRadFelt.mutate>[0], {
      onSuccess: (_d: unknown) => oppfrisk(),
      // Avviser serveren, står den gamle verdien og cella viser grunnen (T61).
      onError: (e: { message: string }) => setCelleFeil((f) => ({ ...f, [nokkel]: e.message })),
    });
  }

  function valgAlternativer(felt: Felt): { value: string; label: string }[] {
    if (felt === "lonnsartId") return (lonnsarter ?? []).map((l) => ({ value: l.id, label: l.navn }));
    if (felt === "aktivitetId") return (aktiviteter ?? []).map((a) => ({ value: a.id, label: a.navn }));
    if (felt === "vehicleId") return (utstyr ?? []).map((e) => ({ value: e.id, label: `${e.merke} ${e.modell}`.trim() || e.internNavn || e.id }));
    return [];
  }

  /* ---------------- Celler ---------------- */

  const typeTekst = (type: string) => t(`timer.attestering.tabell.type.${type}`);

  function visning(k: TimerTabellKolKey, l: AttLinje, under: number): ReactNode {
    const v = timerTabellVerdi(k, l.linje, under);
    if (k === "type") return under === 0 ? typeTekst(l.linje.type) : null;
    if (k === "avvik") {
      return under === 0 && l.avvikMerker.length > 0 ? <AvvikMerker merker={l.avvikMerker} /> : null;
    }
    if (k === "dato") return under === 0 && typeof v === "string" ? dato(v) : null;
    if (k === "betegnelse" && under === 0 && l.kilde.type === "timer" && l.kilde.rad.erReise) {
      return <span className="inline-flex items-center gap-1">{l.linje.betegnelse}<ReiseRadMerke rad={l.kilde.rad} /></span>;
    }
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

  function celle(k: TimerTabellKolKey, l: AttLinje, under: number): ReactNode {
    // Fra–til (w5): én kolonne, men fra og til rettes hver for seg som før.
    if (k === "fraTil" && (malFor("fraTid", l, under) || malFor("tilTid", l, under))) {
      return (
        <span className="flex items-start whitespace-nowrap">
          <span className="shrink-0 [&>button]:mx-0 [&>button]:w-auto [&>button]:px-0">{celle("fraTid", l, under)}</span>
          <span>–</span>
          <span className="shrink-0 [&>button]:mx-0 [&>button]:w-auto [&>button]:px-0">{celle("tilTid", l, under)}</span>
        </span>
      );
    }
    const nokkel = `${l.nokkel}:${under}:${k}`;
    const mal = malFor(k, l, under);
    const varT = varTekst(k, l, under);
    const feilT = celleFeil[nokkel];
    const innhold = visning(k, l, under);
    if (redigerer?.nokkel === nokkel && mal) {
      return <CelleRedigering mal={mal} alternativer={valgAlternativer(mal.felt)} onLagre={(v) => lagre(nokkel, mal, v)} onAngre={() => setRedigerer(null)} />;
    }
    const tekst = (
      <>
        {innhold}
        {varT && <span className="block text-[11px] text-gray-500">{varT}</span>}
        {feilT && <span className="block whitespace-normal text-[11px] text-red-600">{feilT}</span>}
      </>
    );
    if (!mal) return tekst;
    return (
      <button
        type="button"
        onClick={() => setRedigerer({ nokkel, mal })}
        className="-mx-1 block w-[calc(100%+0.5rem)] min-w-0 truncate rounded px-1 text-inherit [text-align:inherit] hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        title={t("timer.attestering.tabell.rettCelle")}
      >
        {tekst}
      </button>
    );
  }

  /* ---------------- Rader ---------------- */

  const etikettKol: TimerTabellKolKey | undefined =
    (["betegnelse", "prosjekt", "ansatt", "dato"] as const).find((k) => kolonner.includes(k)) ?? kolonner[0];
  const avvikKol: TimerTabellKolKey | undefined = (["avvik", "beskrivelse", "betegnelse"] as const).find((k) => kolonner.includes(k));

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

  function kortHandlinger(kort: AttKort) {
    const egne = kort.linjer.filter(iKontekst);
    const ventende = egne.filter((l) => l.harHandling && l.ventende);
    const attesterte = egne.filter((l) => l.harHandling && l.attestert);
    const sperre = kort.linjer.find((l) => l.sperre)?.sperre;
    return (
      <span className="flex items-center gap-1">
        {!readOnly && ventende.length > 0 && (
          <>
            {handlingKnapp({ ikon: <Check className="h-4 w-4" />, tekst: t("timer.attestering.tabell.attesterKort"), tittel: sperre ?? undefined, disabled: opptatt || !!sperre, onClick: () => attester(slaaSammen(ventende)), farge: "text-green-700 hover:bg-green-50" })}
            {handlingKnapp({ ikon: <CornerUpLeft className="h-4 w-4" />, tekst: t("timer.attestering.tabell.returnerKort"), onClick: () => setReturner(slaaSammen(ventende)) })}
          </>
        )}
        {attesterte.length > 0 &&
          handlingKnapp({ ikon: <RotateCcw className="h-4 w-4" />, tekst: t("timer.attestering.tabell.gjenaapneKort"), disabled: opptatt, onClick: () => gjenaapne(slaaSammen(attesterte)) })}
        {/* «Etter prosjekt» har ingen dagsum-rad, så lenken til sedelen står på kortet. */}
        {gruppering === "prosjekt" && sedelLenke(kort.sheetId)}
      </span>
    );
  }

  function sedelLenke(sheetId: string) {
    if (!sedelUrl) return null;
    return (
      <Link href={sedelUrl(sheetId)} title={t("timer.attestering.meny.rediger")} aria-label={t("timer.attestering.meny.rediger")} className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    );
  }

  function dagHandlinger(dag: AttDag) {
    const s = dag.sedel;
    if (prosjektKontekst) {
      // Prosjektet attesterer bare sine egne linjer (R13, T30) — aldri hele sedelen.
      const linjer = dag.kort.flatMap((k) => k.linjer);
      const egne = byggUtvalg(linjer, sedelFor, prosjektKontekst);
      const attesterte = slaaSammen(linjer.filter((l) => iKontekst(l) && l.harHandling && l.attestert));
      return (
        <span className="flex items-center gap-1">
          {!readOnly && egne.antallLinjer > 0 && (
            <>
              <Button size="sm" className="whitespace-nowrap" onClick={() => attester(egne.radIder)} disabled={opptatt} title={t("timer.attestering.tabell.attesterProsjektetsDel")} aria-label={t("timer.attestering.tabell.attesterProsjektetsDel")}>
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
    return (
      <span className="flex items-center gap-1">
        {!readOnly && (
          <>
            {/* Kort tekst (w5): raden heter alt «Sum <dato> · <ansatt>»; full tekst som tittel. */}
            <Button size="sm" className="whitespace-nowrap" onClick={() => { setMelding(null); attesterDag.mutate({ id: s.id }); }} disabled={opptatt || !!dag.sperre} title={dag.sperre ?? t("timer.attestering.tabell.attesterDagen")} aria-label={t("timer.attestering.tabell.attesterDagen")}>
              <Check className="mr-1 h-3.5 w-3.5" />
              {t("timer.attestering.attester")}
            </Button>
            {handlingKnapp({ ikon: <CornerUpLeft className="h-4 w-4" />, tekst: t("timer.attestering.returner"), onClick: () => onReturnerDag?.(s.id) })}
          </>
        )}
        {readOnly && (
          <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => setGjenaapneDag(s.id)} title={t("timer.attestering.tabell.gjenaapneDagen")} aria-label={t("timer.attestering.tabell.gjenaapneDagen")}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            {t("timer.attestering.tabell.gjenaapne")}
          </Button>
        )}
        {sedelLenke(s.id)}
      </span>
    );
  }

  function linjeHandlinger(l: AttLinje) {
    if (!iKontekst(l)) return null;
    // WM54/B10: ✂ og pennen vises bare når firmaet har «rediger ved attestering» på.
    const redigerTillatt = sedelFor(l.sheetId)?.redigerTillatt === true;
    const kanSplitte = !readOnly && redigerTillatt && l.ventende && l.projectId !== null && (l.kilde.type === "timer" || l.kilde.type === "maskin" || l.kilde.type === "tillegg");
    return (
      <span className="flex items-center gap-1">
        {l.kilde.type === "utlegg" && <Kvitteringer vedlegg={l.kilde.rad.vedlegg ?? []} />}
        {l.harHandling && !readOnly && l.ventende && (
          <>
            {handlingKnapp({ ikon: <Check className="h-4 w-4" />, tekst: t("timer.attestering.attester"), tittel: l.sperre ?? undefined, disabled: opptatt || !!l.sperre, onClick: () => attester(l.radIder), farge: "text-green-700 hover:bg-green-50" })}
            {handlingKnapp({ ikon: <CornerUpLeft className="h-4 w-4" />, tekst: t("timer.attestering.returner"), onClick: () => setReturner(l.radIder) })}
          </>
        )}
        {l.harHandling && l.attestert &&
          handlingKnapp({ ikon: <RotateCcw className="h-4 w-4" />, tekst: t("timer.attestering.tabell.gjenaapneLinje"), disabled: opptatt, onClick: () => gjenaapne(l.radIder) })}
        {kanSplitte && handlingKnapp({ ikon: <Scissors className="h-3.5 w-3.5" />, tekst: t("timer.attestering.meny.splittRad"), onClick: () => setSplitt(l) })}
        {!readOnly && redigerTillatt && l.ventende && l.projectId !== null && l.kilde.type !== "utlegg" &&
          handlingKnapp({ ikon: <Pencil className="h-3.5 w-3.5" />, tekst: t("timer.attestering.meny.rediger"), onClick: () => setRediger(l) })}
      </span>
    );
  }

  /** Registreringen åpnet under linja (bilde 7): hele jobben (kortet) linja står på. */
  function registrering(kort: AttKort, s: AttSedel) {
    const egne = kort.linjer.filter((l) => iKontekst(l) && l.harHandling);
    const kanAttestere = !readOnly && egne.length > 0;
    return (
      <RegistreringPanel
        key={kort.nokkel}
        kort={kort}
        sedel={s}
        orgId={orgId}
        kanAttestere={kanAttestere}
        kanRette={kanAttestere && s.redigerTillatt && egne.some((l) => l.ventende)}
        lonnsarter={lonnsarter ?? []}
        onEndret={oppfrisk}
        onLukk={() => setAapenLinje(null)}
      />
    );
  }

  const rader = useMemo<TimerRadTabellRad<AttLinje>[]>(() => {
    const ut: TimerRadTabellRad<AttLinje>[] = [];
    const grupper = grupperModell(synlige, gruppering) ?? [{ nokkel: "", tittel: "", dager: synlige }];
    for (const gruppe of grupper) {
    if (gruppe.nokkel) {
      const gSum = sumLinjer(gruppe.dager.flatMap((d) => d.kort.flatMap((k) => k.linjer)));
      ut.push({
        kind: "overskrift",
        nokkel: `g:${gruppe.nokkel}`,
        innhold: (
          <span className="flex items-center justify-between gap-4">
            <span>{gruppe.tittel}</span>
            <span className="tabular-nums">{t("timer.attestering.tabell.gruppeSum", { timer: formaterNorsk(gSum.timer) })}</span>
          </span>
        ),
      });
    }
    for (const dag of gruppe.dager) {
      const s = dag.sedel;
      for (const kort of dag.kort) {
        const sum = sumLinjer(kort.linjer);
        const avvik = unikeMerker(kort.linjer.flatMap((l) => l.avvikMerker));
        const dagen = s.dagsnorm == null ? null : t("timer.attestering.tabell.dagenAvNorm", { timer: formaterNorsk(s.totaltimer), norm: formaterNorsk(s.dagsnorm) });
        ut.push({
          kind: "sum",
          nokkel: `o:${kort.nokkel}`,
          hoyre: kortHandlinger(kort),
          celle: (k) => {
            switch (k) {
              case "dato": return dato(dag.dato);
              case "ansatt": return dag.ansatt;
              case "ansattnr": return dag.ansattnr ?? "";
              case "prosjektnummer": return kort.prosjektnummer;
              case "prosjekt": return kort.prosjekt;
              case "byggeplass": return kort.byggeplass ?? "";
              case "underprosjekt": return kort.underprosjekt ?? "";
              case "timer": return formaterNorsk(sum.timer);
              case "maskintimer": return sum.maskintimer > 0 ? formaterNorsk(sum.maskintimer) : "";
              default:
                return k === avvikKol ? (
                  // Én linje (w5): bryting gjorde oversiktsraden dobbelt høy og ga luke under dagen.
                  <span className="inline-flex items-center gap-1 whitespace-nowrap font-normal text-gray-700" title={dagen ?? undefined}>
                    {dagen}
                    {avvik.length > 0 && <AvvikMerker merker={avvik} />}
                  </span>
                ) : "";
            }
          },
        });
        if (!bareOversikt) for (const l of kort.linjer) {
          ut.push({ kind: "linje", nokkel: l.nokkel, data: l, underlinjer: Math.max(1, l.linje.maskiner.length, l.linje.varer.length) });
          if (aapenLinje === l.nokkel) ut.push({ kind: "panel", nokkel: `p:${l.nokkel}`, innhold: registrering(kort, s) });
        }
      }
      // «Etter prosjekt» viser bare prosjektets del av dagen — en dagsum der ville villede (T28).
      if (gruppering === "prosjekt") continue;
      // Dagseddelens sum nederst (§ 12.8.5): bare sum og handlinger.
      const alle = dag.kort.flatMap((k) => k.linjer);
      const sum = sumLinjer(alle);
      const merker = [
        dag.sperre,
        s.normStatus === "cachet" ? t("timer.attestering.norm.cachet") : s.normStatus === "ukjent" ? t("timer.attestering.norm.ukjent") : null,
      ].filter(Boolean);
      ut.push({
        kind: "sum",
        nokkel: `d:${s.id}`,
        sterk: true,
        hoyre: dagHandlinger(dag),
        celle: (k) =>
          k === etikettKol ? t("timer.attestering.tabell.dagsum", { dato: dato(dag.dato), ansatt: dag.ansatt }) :
          k === "timer" ? formaterNorsk(sum.timer) :
          k === "maskintimer" ? (sum.maskintimer > 0 ? formaterNorsk(sum.maskintimer) : "") :
          k === avvikKol && merker.length > 0 ? <span className="font-normal text-amber-700" title={merker.join(" · ")}>{merker.join(" · ")}</span> : "",
      });
    }
    }
    return ut;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlingene leser fersk tilstand ved klikk
  }, [synlige, gruppering, bareOversikt, t, readOnly, opptatt, etikettKol, avvikKol, prosjektKontekst, medAar, aapenLinje, lonnsarter]);

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
    () => [{ id: "alle", navn: t("timer.attestering.tabell.kolonner"), felter: TIMER_TABELL_KOL_KEYS.map((k) => ({ id: k, navn: t(`timer.eksport.${TIMER_TABELL_KOL[k].i18n}`) })) }],
    [t],
  );

  const kanVelges = (l: AttLinje) => l.harHandling && l.ventende && !readOnly && !l.sperre && iKontekst(l);
  const valgbare = synligeLinjer.filter(kanVelges);
  const alleValgt = valgbare.length > 0 && valgbare.every((l) => valgte.has(l.nokkel));

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
          <Button size="sm" onClick={attesterUtvalget} disabled={opptatt || utvalg.antallLinjer === 0}>
            <Check className="mr-1 h-3.5 w-3.5" />
            {t("timer.attestering.tabell.attesterUtvalget", { antall: utvalg.antallLinjer })}
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
                onChange={(e) => setValgte(e.target.checked ? new Set(valgbare.map((l) => l.nokkel)) : new Set())}
                className="h-3.5 w-3.5 rounded"
              />
            ),
            celle: (l) =>
              kanVelges(l) ? (
                <input
                  type="checkbox"
                  aria-label={t("timer.attestering.tabell.velgLinje")}
                  checked={valgte.has(l.nokkel)}
                  onChange={(e) => setValgte((v) => { const ny = new Set(v); if (e.target.checked) ny.add(l.nokkel); else ny.delete(l.nokkel); return ny; })}
                  className="mt-0.5 h-3.5 w-3.5 rounded"
                />
              ) : null,
          }}
          hoyre={{ bredde: HOYRE, celle: linjeHandlinger }}
          linjeKlasse={(l) => (iKontekst(l) ? undefined : "opacity-50")}
          standardBredder={ATTESTERING_BREDDE}
          hodeBrytes
          hodeTekst={(k) => (HODE_KORT.has(k) ? t(`timer.attestering.tabell.hode.${k}`) : undefined)}
          onLinjeKlikk={(l) => setAapenLinje((a) => (a === l.nokkel ? null : l.nokkel))}
          erAapen={(l) => l.nokkel === aapenLinje}
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
      {rediger && rediger.projectId !== null && (
        <RedigerRadModal
          sheetId={rediger.sheetId}
          projectId={rediger.projectId}
          ecoId={rediger.kilde.type === "timer" || rediger.kilde.type === "maskin" ? rediger.kilde.rad.externalCostObjectId : null}
          onLukk={() => setRediger(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CelleRedigering({ mal, alternativer, onLagre, onAngre }: { mal: Mal; alternativer: { value: string; label: string }[]; onLagre: (v: string) => void; onAngre: () => void }) {
  const [verdi, setVerdi] = useState(mal.verdi);
  const tast = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    // Enter eller Tab lagrer cella i ett kall; Esc angrer (R21, T61).
    if (e.key === "Enter" || e.key === "Tab") {
      if (e.key === "Enter") e.preventDefault();
      onLagre(verdi);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onAngre();
    }
  };
  const klasse = "w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  if (mal.type === "valg") {
    return (
      <select autoFocus value={verdi} onChange={(e) => setVerdi(e.target.value)} onKeyDown={tast} onBlur={onAngre} className={klasse}>
        {alternativer.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
      </select>
    );
  }
  return (
    <input
      autoFocus
      value={verdi}
      inputMode={mal.type === "tekst" ? undefined : "decimal"}
      onChange={(e) => setVerdi(e.target.value)}
      onKeyDown={tast}
      onBlur={onAngre}
      className={klasse}
    />
  );
}

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
 * Kvitteringene på et utlegg (ordre d2b-3, d): attestanten åpner og kontrollerer dem før
 * ✓ — «ellers godkjenner vi noe vi ikke har lest». Samme visning som timer-detaljen
 * (`SignertLenke` + `SignertBilde`, signatur fra serveren, selvfornyende). Bilde vises som
 * miniatyr; annet (PDF) som binders. Begge åpner fila i ny fane.
 */
function Kvitteringer({ vedlegg }: { vedlegg: readonly AttVedlegg[] }) {
  const { t } = useTranslation();
  if (vedlegg.length === 0) return null;
  return (
    <>
      {vedlegg.map((v) => (
        <SignertLenke
          key={v.id}
          url={v.fileUrl}
          nyFane
          title={t("timer.attestering.tabell.aapneKvittering", { fil: v.fileName })}
          className="inline-flex shrink-0 items-center rounded hover:opacity-80"
        >
          {v.mimeType.startsWith("image/") ? (
            <SignertBilde url={v.fileUrl} alt={t("timer.vedlegg.tittel")} className="h-6 w-6 rounded border border-gray-200 object-cover" />
          ) : (
            <Paperclip className="h-4 w-4 text-gray-600" />
          )}
        </SignertLenke>
      ))}
    </>
  );
}

/** Avvikene på én linje (w1, B7): korte merker med forklaringen på hover/trykk; øvrige som tekst. */
function AvvikMerker({ merker }: { merker: readonly AvvikMerke[] }) {
  return (
    // Én linje (flex uten bryting): maskinlinjene blir like høye som de andre (WM21).
    <span className="inline-flex items-center gap-1 text-amber-700">
      {merker.map((m, i) =>
        m.forklaring ? (
          <Tooltip key={`${i}:${m.tekst}`} tekst={m.forklaring} side="bottom" delayMs={150}>
            <span
              data-avvik-merke=""
              className="cursor-help whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-1.5 py-px text-[11px] font-medium leading-4 text-amber-800"
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

/** Kortets oversiktsrad viser hvert avvik én gang. */
function unikeMerker(merker: readonly AvvikMerke[]): AvvikMerke[] {
  const sett = new Map<string, AvvikMerke>();
  for (const m of merker) if (!sett.has(m.tekst)) sett.set(m.tekst, m);
  return [...sett.values()];
}
