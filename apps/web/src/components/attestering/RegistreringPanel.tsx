"use client";

import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Scissors, Undo2, X } from "lucide-react";
import { Button } from "@sitedoc/ui";
import { effektiveTimerFraSpenn, erReiseLonnsart, maskinHoystPerRad, overMaskinHoyst, tolkKlokkeslett, type ErReiseKontekst } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { formaterNorsk } from "@/lib/timer-rapport-eksport";
import { rundTilNarmeste } from "@/lib/tidsrunding";
import { Kvitteringer } from "./Kvitteringer";
import { ReiseRadMerke } from "./ReiseRadMerke";
import { ReiseRettVindu } from "./ReiseRettVindu";
import { LinjeRettVindu, type LinjeRett } from "./LinjeRettVindu";
import type { AttKort, AttLinje, AttMaskin, AttSedel, AttTimer, AttVare, FlyttMaal } from "./attestering-tabell";
import { jobbensBeskrivelser } from "../timer/BeskrivelseHover";

/**
 * Registreringen åpnet under linja (web-timeføring w5, bilde 7 og 8). Viser jobben (kortet)
 * slik den ble ført, i de sju delene: Fra–til · Lønnsart · Hva gjorde du? · Maskiner · Varer ·
 * Tillegg · Utlegg. Underprosjektet gjelder hele jobben (`flyttTimerRadEco` med `helJobb`).
 *
 *  - Underprosjekt: knapper til og med 6, søkbar nedtrekk over det (B11). Krever bare
 *    attesteringsrett, som flyttingen alltid har gjort (WM54).
 *  - w15g (§ 4.15 del F, F63): kortet er informasjonsstatus — linjene er tekst. Fra, til, pause
 *    (på linja som bærer den), lønnsart, maskintimer og antall rettes i vinduet bak ✎ på linja
 *    (`LinjeRettVindu`), med én `rettRadFelt` ved «Lagre». Krever firmavalget «rediger ved
 *    attestering» (B10), som før. w10a (A1): timene rettes aldri alene; de regnes ut av fra, til
 *    og pause og sendes i samme kall. Avviser serveren, står grunnen i vinduet.
 *  - w10a (A2): ✂ står ved linjene i kortet, «✎ Rediger jobben» øverst. Linjene i tabellen har
 *    ingen knapper. Beskrivelsen og dagens kommentar kan leses, ikke rettes (A6).
 *  - «Del opp» deler hele jobben ved et klokkeslett (`delJobb`): timene pr. del regner
 *    serveren ut (forhåndsvisning før lagring).
 *  - w12 (§ 4.11 C5–C7): del 1–7 regnes av arbeidsradene. Reisen står i del 8 «Reise», som bare
 *    vises når jobben har reise. Et kort med bare reise har ikke underprosjektvalget i hodet.
 *  - w15f (§ 4.15 del E): reiselinja i del 8 er tekst «fra–til · lønnsart · prosjekt · byggeplass ·
 *    underprosjekt» med ✂ og ✎. ✎ åpner «Rett reisen» (`ReiseRettVindu`): start, slutt, prosjekt,
 *    byggeplass og underprosjekt. Lønnsarten på reisen rettes i «✎ Rediger jobben».
 *  - D2a (skissen `d2ab-losning.png`): etter «Del opp» står kort A og B åpne side om side
 *    (`parRolle`), med merket «Kort A»/«Kort B» i hodet. Del 8 «Reise» vises alltid når
 *    attestanten kan rette kortet, så en reise kan flyttes inn.
 *  - D2b: linjene under Maskiner, Varer, Tillegg, Utlegg og Reise har en flytteknapp
 *    (`flyttLinjeTilKort`). I paret «→ Kort B» / «← Kort A»; alene «→ underprosjekt · fra–til»
 *    for ett mål, «→ Flytt til ▾» for flere, ingen knapp uten mål. Vare åpner et mengdefelt.
 */

/** Til og med så mange underprosjekter vises som knapper (B11). */
export const UNDERPROSJEKT_KNAPPER_MAKS = 6;

type Eco = { id: string; proAdmId: string; kortNavn: string };

interface Props {
  kort: AttKort;
  sedel: AttSedel;
  orgId: string;
  /** Attestanten kan attestere jobben: flytte underprosjekt. */
  kanAttestere: boolean;
  /** Firmavalget «rediger ved attestering» er på og jobben venter: rette og dele opp. */
  kanRette: boolean;
  /** Firmaets lønnsartkatalog; `satsEnhet` avgjør om linja rettes med fra–til eller tallfelt. */
  lonnsarter: readonly { id: string; navn: string; satsEnhet?: string | null }[];
  /** Firmaets tidsrunding (minutter) for fra og til, som sedelsiden. */
  tidsrunding?: number | null;
  /** w10a (A2): ✂ ved linja i kortet — vilkåret er det linja hadde i tabellen. */
  kanSplitte?: (l: AttLinje) => boolean;
  onSplitt?: (l: AttLinje) => void;
  /** w10a (A2, B27 A): «✎ Rediger jobben». Utelatt → knappen vises ikke. */
  onRedigerJobb?: () => void;
  onEndret: () => void;
  onLukk: () => void;
  /** w15f: prosjektene attestanten kan attestere (`undefined` = alle) — lista i «Rett reisen». */
  prosjektKontekst?: ReadonlySet<string>;
  /** D2a: kortet står i paret etter «Del opp» — «a» er kortet som ble delt, «b» det nye. */
  parRolle?: "a" | "b";
  /** D2a: «Del opp» er utført; kortet B fikk denne kort-id-en. */
  onDelt?: (kortIdB: string) => void;
  /** D2h: kort B er slått sammen med kort A igjen («↶ Angre del opp»). */
  onAngret?: (kortIdA: string) => void;
  /** D2b: kortene en linje kan flyttes til (`flyttMaal`). I paret bare partneren. */
  flyttMaal?: readonly FlyttMaal[];
}

/**
 * Lønnsartene linja tilbyr (w10a A1, plan § 4.7 punkt 6; Fabel 2026-11-20): regelen gjelder
 * linjetypen (radens flagg), ikke kortet. En reiselinje (`erReise`) tilbyr bare reisearter.
 * O25: en arbeidslinje tilbyr alle lønnsarter — også den firmaet bruker som reise-lønnsart; valget
 * gjør aldri raden til reise. Lagret art står alltid med, så valget aldri viser feil verdi. Uten
 * reisekonteksten (ikke lastet) tilbyr reiselinja bare lagret art.
 */
export function tillatteLonnsarter<L extends { id: string; navn: string }>(
  linje: { erReise?: boolean | null },
  lonnsarter: readonly L[],
  ktx: ErReiseKontekst | null,
  lagretId: string,
): L[] {
  if (linje.erReise !== true) return [...lonnsarter];
  return lonnsarter.filter((l) => l.id === lagretId || (ktx !== null && erReiseLonnsart(l.id, l.navn, ktx)));
}

/**
 * Rettes linja med fra–til (RETUR 1 w10a, vilkår 2)? Bare timebaserte lønnsarter (`satsEnhet` null
 * eller `per_time`) — samme regel som serverens `erTimebasert` (`dagsseddel.ts`). På `per_km`,
 * `per_dag` og `per_natt` er `timer` antallet (km, dager, netter), så fra–til ville skrevet det
 * over; de beholder tallfeltet. Lønnsart som ikke finnes i katalogen (ikke lastet, inaktiv) gir
 * tallfeltet, så antallet aldri regnes om.
 */
export function erTimebasertLonnsart(lonnsartId: string, lonnsarter: readonly { id: string; satsEnhet?: string | null }[]): boolean {
  const art = lonnsarter.find((l) => l.id === lonnsartId);
  if (!art) return false;
  return art.satsEnhet == null || art.satsEnhet === "per_time";
}

// O6: flyttet til `components/timer/BeskrivelseHover`, så dagssiden og attesteringen deler den.
export { jobbensBeskrivelser };

const tilMin = (hhmm: string | null | undefined): number | null => {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [t, m] = hhmm.split(":").map(Number);
  return (t ?? 0) * 60 + (m ?? 0);
};
const fraMin = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const ecoTekst = (e: Eco) => `${e.proAdmId} · ${e.kortNavn}`;

/** Jobbens tidsrom: tidligste fra og seneste til blant timeradene. */
export function jobbensTidsrom(rader: readonly { fraTid: string | null; tilTid: string | null }[]): { fra: string; til: string } | null {
  const fra = rader.map((r) => tilMin(r.fraTid)).filter((x): x is number => x !== null);
  const til = rader.map((r) => tilMin(r.tilTid)).filter((x): x is number => x !== null);
  if (fra.length === 0 || til.length === 0) return null;
  return { fra: fraMin(Math.min(...fra)), til: fraMin(Math.max(...til)) };
}

export function RegistreringPanel({ kort, sedel, orgId, kanAttestere, kanRette, lonnsarter, tidsrunding = null, kanSplitte, onSplitt, onRedigerJobb, onEndret, onLukk, prosjektKontekst, parRolle, onDelt, onAngret, flyttMaal = [] }: Props) {
  const { t } = useTranslation();
  const [feil, setFeil] = useState<string | null>(null);
  const [delOpp, setDelOpp] = useState(false);
  // w15f: reisen som rettes i «Rett reisen».
  const [reiseRett, setReiseRett] = useState<AttTimer | null>(null);
  // w15g: linja som rettes i vinduet bak ✎.
  const [linjeRett, setLinjeRett] = useState<LinjeRett | null>(null);
  // D2b: vare som flyttes — mengdefeltet står under linja.
  const [vareFlytt, setVareFlytt] = useState<{ v: AttVare; maal: FlyttMaal; tekst: string } | null>(null);

  // w12 (A punkt 7): del 1–7 leser bare arbeidsradene; reisen står i del 8.
  const timerLinjer = useMemo(
    () =>
      kort.linjer
        .filter((l): l is AttLinje & { kilde: { type: "timer" } } => l.kilde.type === "timer" && l.kilde.rad.erReise !== true)
        .sort((a, b) => (a.linje.fraTid ?? "").localeCompare(b.linje.fraTid ?? "")),
    [kort.linjer],
  );
  // Rekkefølgen fra grupperingen: utreise, uten retning, retur.
  const reiseLinjer = useMemo(
    () => kort.linjer.filter((l): l is AttLinje & { kilde: { type: "timer" } } => l.kilde.type === "timer" && l.kilde.rad.erReise === true),
    [kort.linjer],
  );
  const maskiner = useMemo(() => {
    const ut: { m: AttMaskin; navn: string | null; linje: AttLinje }[] = [];
    for (const l of kort.linjer) {
      if (l.kilde.type === "timer") l.kilde.maskiner.forEach((m, i) => ut.push({ m, navn: l.linje.maskiner[i]?.navn ?? null, linje: l }));
      if (l.kilde.type === "maskin") ut.push({ m: l.kilde.rad, navn: l.linje.maskiner[0]?.navn ?? null, linje: l });
    }
    return ut;
  }, [kort.linjer]);
  // w9 (2c): «høyst X t» pr. maskin — jobbens arbeid minus de andre førermaskinene,
  // regnet på hele sedelen med samme delte regel som serveren. Døgn-maskin: null.
  const hoystFor = useMemo(() => {
    const maskinRader = sedel.maskiner;
    const hoyst = maskinHoystPerRad(
      sedel.timer.map((r) => ({
        kortId: r.kortId,
        projectId: r.projectId,
        externalCostObjectId: r.externalCostObjectId ?? null,
        timer: Number(r.timer ?? 0),
        erReise: r.erReise === true,
      })),
      maskinRader.map((m) => ({
        kortId: m.kortId,
        projectId: m.projectId,
        externalCostObjectId: m.externalCostObjectId ?? null,
        timer: Number(m.timer ?? 0),
        utleieEnhet: m.utleieEnhet ?? null,
      })),
      sedel.pauseMin,
    );
    return new Map(maskinRader.map((m, i) => [m.id, hoyst[i] ?? null]));
  }, [sedel.timer, sedel.maskiner, sedel.pauseMin]);
  // D2b: varene med kilden (attestert, antall) — flytteknappen trenger dem.
  const varer = kort.linjer.flatMap((l): AttVare[] => (l.kilde.type === "timer" ? l.kilde.varer : l.kilde.type === "vare" ? [l.kilde.rad] : []));
  const tillegg = kort.linjer.filter((l) => l.kilde.type === "tillegg");
  const utlegg = kort.linjer.filter((l) => l.kilde.type === "utlegg");

  const tidsrom = jobbensTidsrom(timerLinjer.map((l) => l.linje));
  const sumTimer = timerLinjer.reduce((s, l) => s + (l.linje.timer ?? 0), 0);
  const sumPause = timerLinjer.reduce((s, l) => s + (l.linje.pauseMin ?? 0), 0);
  // w10a (A6): aktiviteten settes aldri inn i stedet for beskrivelsen; den står i hodet.
  const beskrivelser = jobbensBeskrivelser(timerLinjer.map((l) => ({ fraTid: l.linje.fraTid, beskrivelse: l.kilde.rad.beskrivelse })));
  const aktivitetene = [...new Set(timerLinjer.map((l) => l.linje.aktivitet ?? "").filter(Boolean))];
  const kommentar = sedel.beskrivelse?.trim() || null;

  // Reisekonteksten til lønnsartvalget — samme kilde som sedelsiden.
  const { data: arbeidstid } = trpc.organisasjon.hentArbeidstidDefaults.useQuery({ organizationId: orgId });
  const reiseKtx = useMemo<ErReiseKontekst | null>(() => {
    if (!arbeidstid) return null;
    const a = arbeidstid as { reiseLonnsartId?: string | null; reiseGrenser?: { lonnsartId: string | null }[] | null };
    return {
      reiseLonnsartId: a.reiseLonnsartId ?? null,
      grensepunktLonnsartIds: (a.reiseGrenser ?? []).map((g) => g.lonnsartId).filter((id): id is string => id != null),
    };
  }, [arbeidstid]);

  // Underprosjektet gjelder hele jobben (K3); jobbens rader deler det. RETUR O12 vilkår 2: en
  // arbeidstid-reise (`arbeidReiseRetning`) er ingen jobbrad — den kan ha eget underprosjekt og
  // står ofte først (kl. 06:30); jobbens underprosjekt og «hele jobben» leses fra første jobbrad.
  const forste = timerLinjer.find((l) => !l.kilde.rad.arbeidReiseRetning)?.kilde.rad ?? null;
  const tilleggForste = tillegg[0]?.kilde.type === "tillegg" ? tillegg[0].kilde.rad : null;
  const naaEco = forste?.externalCostObjectId ?? tilleggForste?.externalCostObjectId ?? null;

  const { data: ecoRaw } = trpc.eksternKostObjekt.list.useQuery(
    { projectId: kort.projectId ?? "", organizationId: orgId },
    { enabled: !!kort.projectId },
  );
  const ecoListe = (ecoRaw ?? []) as Eco[];

  const flytt = trpc.timer.dagsseddel.flyttTimerRadEco.useMutation({
    onSuccess: (_d: unknown) => { setFeil(null); onEndret(); },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const alleVenter = kort.linjer.every((l) => !l.harHandling || l.ventende);

  // D2b: flytt én linje til et annet kort i samme prosjekt.
  const flyttLinje = trpc.timer.dagsseddel.flyttLinjeTilKort.useMutation({
    onSuccess: (_d: unknown) => { setFeil(null); setVareFlytt(null); onEndret(); },
    onError: (e: { message: string }) => setFeil(e.message),
  });
  const flyttTil = (radType: "maskin" | "tillegg" | "utlegg" | "reise" | "vare", radId: string, maal: FlyttMaal, mengde?: number) =>
    flyttLinje.mutate({ sheetId: kort.sheetId, radType, radId, tilKortId: maal.kortId, ...(mengde !== undefined ? { mengde } : {}) });
  const kildeNavn = parRolle === "a" ? t("timer.attestering.registrering.kortA") : parRolle === "b" ? t("timer.attestering.registrering.kortB") : t("timer.attestering.registrering.flytt.detteKortet");
  const flyttKnapp = (radType: "maskin" | "tillegg" | "utlegg" | "reise", radId: string) => (
    <FlyttKnapp maal={flyttMaal} parRolle={parRolle} disabled={flyttLinje.isPending} onVelg={(m) => flyttTil(radType, radId, m)} />
  );
  // Eldre rader uten kortId er ingen jobb — serveren avviser «hele jobben» og del opp for dem.
  const jobbId = forste?.kortId ?? tilleggForste?.kortId ?? null;
  const kanFlytte = kanAttestere && alleVenter && kort.projectId !== null && jobbId !== null;
  // D2h: «↶ Angre del opp» på kort B som kom fra «Del opp» — serveren sier hvilke kort (`angreDelOppKort`).
  const kanAngre = kanRette && jobbId !== null && (sedel.angreDelOppKort ?? []).includes(jobbId);
  const angreDel = trpc.timer.dagsseddel.angreDelJobb.useMutation({
    onSuccess: (d: { kortIdA: string }) => { setFeil(null); onEndret(); onAngret?.(d.kortIdA); },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function velgEco(ecoId: string | null) {
    if (ecoId === naaEco) return;
    const rad = forste ?? tilleggForste;
    if (!rad) return;
    flytt.mutate({ timerRadId: rad.id, radType: forste ? "timer" : "tillegg", externalCostObjectId: ecoId, helJobb: true });
  }

  /** w15g: ✎ på linja — åpner vinduet for linja; samme utseende som ✎ på reiselinja. */
  const pennKnapp = (tittel: string, linje: LinjeRett) => (
    <button
      type="button"
      data-linje-penn={linje.type}
      onClick={() => setLinjeRett(linje)}
      aria-label={tittel}
      title={tittel}
      className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  );
  const splittKnapp = (l: AttLinje) =>
    kanSplitte?.(l) && onSplitt ? (
      <button
        type="button"
        onClick={() => onSplitt(l)}
        aria-label={t("timer.attestering.meny.splittRad")}
        title={t("timer.attestering.meny.splittRad")}
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      >
        <Scissors className="h-3.5 w-3.5" />
      </button>
    ) : null;

  /** Én timelinje i kortet (del 2): fra–til, pause, timer og lønnsart som tekst, med ✂ og ✎ (w15g). */
  const timeLinje = (l: AttLinje & { kilde: { type: "timer" } }) => {
    const r = l.kilde.rad;
    const kan = kanRette && l.ventende && l.harHandling;
    const tidTekst = l.linje.fraTid && l.linje.tilTid ? `${l.linje.fraTid}–${l.linje.tilTid}` : "—";
    return (
      <div key={l.nokkel} data-timelinje={l.nokkel} className="flex flex-wrap items-center gap-3">
        <span className="tabular-nums text-gray-700">
          {tidTekst}
          {(r.pauseMin ?? 0) > 0 && <span className="text-gray-500"> · {t("timer.attestering.registrering.pause", { min: r.pauseMin })}</span>}
          <span className="font-medium text-gray-900"> · {t("timer.attestering.registrering.timer", { timer: formaterNorsk(l.linje.timer ?? 0) })}</span>
        </span>
        <span>{l.linje.betegnelse}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {splittKnapp(l)}
          {kan && pennKnapp(t("timer.korrigert.vindu.timer"), {
            type: "timer",
            radId: r.id,
            tittel: [tidTekst, l.linje.betegnelse].filter(Boolean).join(" · "),
            lagret: { fraTid: r.fraTid ?? null, tilTid: r.tilTid ?? null, pauseMin: r.pauseMin ?? 0, timer: l.linje.timer, lonnsartId: r.lonnsartId },
            timebasert: erTimebasertLonnsart(r.lonnsartId, lonnsarter),
            lonnsValg: tillatteLonnsarter(r, lonnsarter, reiseKtx, r.lonnsartId),
          })}
        </span>
      </div>
    );
  };

  const tom = <span className="text-gray-400">—</span>;
  // D2a: del 8 står alltid når kortet kan rettes, så en reise kan flyttes inn.
  const visReise = reiseLinjer.length > 0 || kanRette;
  const tittel = [kort.prosjektnummer, kort.prosjekt].filter(Boolean).join(" · ");

  return (
    <div
      data-registrering={kort.nokkel}
      {...(parRolle ? { "data-par-rolle": parRolle } : {})}
      className={`${parRolle ? "min-w-0" : "mx-3 my-2"} rounded-lg border border-blue-300 bg-white text-sm text-gray-800 shadow-sm`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold text-gray-900">
            {parRolle && (
              <span data-kort-merke="" className="shrink-0 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                {t(parRolle === "a" ? "timer.attestering.registrering.kortA" : "timer.attestering.registrering.kortB")}
              </span>
            )}
            <span className="truncate">{tittel}</span>
          </p>
          {/* w10a (A6): aktiviteten står i hodet, ved byggeplassen. */}
          {(kort.byggeplass || aktivitetene.length > 0) && (
            <p data-kort-hode="" className="truncate text-xs text-gray-500">{[kort.byggeplass, ...aktivitetene].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {kanAngre && jobbId && (
            <button
              type="button"
              data-angre-del-opp=""
              onClick={() => angreDel.mutate({ sheetId: kort.sheetId, kortId: jobbId })}
              disabled={angreDel.isPending}
              title={t("timer.attestering.registrering.angreDelOppHjelp")}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Undo2 className="h-3.5 w-3.5" />
              {t("timer.attestering.registrering.angreDelOpp")}
            </button>
          )}
          {onRedigerJobb && (
            <button
              type="button"
              onClick={onRedigerJobb}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t("timer.attestering.registrering.redigerJobben")}
            </button>
          )}
          <button type="button" onClick={onLukk} aria-label={t("handling.lukk")} title={t("handling.lukk")} className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </span>
      </div>

      {/* Underprosjekt for hele jobben (bilde 7, B11) */}
      {/* C7: et kort med bare reise har ikke valget — reisens underprosjekt rettes i «Rett reisen» (w15f). */}
      {kort.projectId !== null && !kort.reise && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
          <span className="font-medium text-gray-900">{t("timer.attestering.registrering.underprosjekt")}</span>
          <UnderprosjektValg
            eco={ecoListe}
            valgt={naaEco}
            disabled={!kanFlytte || flytt.isPending}
            onVelg={velgEco}
          />
          {!kanFlytte && kanAttestere && !alleVenter && (
            <span className="text-xs text-gray-500">{t("timer.attestering.registrering.ikkeAlleVenter")}</span>
          )}
        </div>
      )}

      <Del nr={1} navn={t("timer.attestering.registrering.fraTil")} hoyre={kanRette && tidsrom && kort.projectId !== null && forste?.kortId ? (
        <button
          type="button"
          onClick={() => setDelOpp((v) => !v)}
          aria-expanded={delOpp}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Scissors className="h-3.5 w-3.5" />
          {t("timer.attestering.registrering.delOpp")}
        </button>
      ) : undefined}>
        {tidsrom ? (
          <span>
            {tidsrom.fra}–{tidsrom.til}
            <span className="text-gray-500"> · {t("timer.attestering.registrering.pause", { min: sumPause })} · </span>
            <span className="font-semibold">{t("timer.attestering.registrering.timer", { timer: formaterNorsk(sumTimer) })}</span>
          </span>
        ) : timerLinjer.length > 0 ? (
          <span className="font-semibold">{t("timer.attestering.registrering.timer", { timer: formaterNorsk(sumTimer) })}</span>
        ) : tom}
      </Del>

      {delOpp && tidsrom && kort.projectId !== null && forste?.kortId && (
        <DelOppSkjema
          sheetId={kort.sheetId}
          kortId={forste.kortId}
          tidsrom={tidsrom}
          eco={ecoListe}
          naaEco={naaEco}
          onAvbryt={() => setDelOpp(false)}
          onDelt={(kortIdB) => { setDelOpp(false); onEndret(); onDelt?.(kortIdB); }}
        />
      )}

      <Del nr={2} navn={t("timer.attestering.registrering.lonnsart")}>
        {timerLinjer.length === 0 ? tom : (
          <div className="flex flex-col gap-1.5">
            {timerLinjer.map(timeLinje)}
          </div>
        )}
      </Del>

      <Del nr={3} navn={t("timer.attestering.registrering.hvaGjordeDu")}>
        <div data-beskrivelse="" className="flex flex-col gap-1">
          {beskrivelser.length > 0 ? (
            beskrivelser.map((b) => <p key={b} className="whitespace-pre-wrap">{b}</p>)
          ) : kort.reise ? (
            // Reisen har ingen «Hva gjorde du?» (plan § 4.9 punkt 8); telefonen skriver ingen tekst der.
            tom
          ) : (
            <span className="font-semibold text-amber-700">{t("timer.attestering.registrering.ikkeUtfylt")}</span>
          )}
          {kommentar && (
            <p data-kommentar-dagen="" className="mt-1 whitespace-pre-wrap text-gray-700">
              <span className="font-medium text-gray-900">{t("timer.attestering.registrering.kommentarTilDagen")}: </span>
              {kommentar}
            </p>
          )}
        </div>
      </Del>

      <Del nr={4} navn={t("timer.attestering.registrering.maskiner")}>
        {maskiner.length === 0 ? tom : (
          <div className="flex flex-col gap-1.5">
            {maskiner.map(({ m, navn, linje }) => {
              const kan = kanRette && linje.ventende;
              return (
                <div key={m.id} data-maskinlinje={m.id} className="flex flex-wrap items-center gap-3">
                  <span className="w-48 truncate">{navn ?? "—"}</span>
                  <span className="tabular-nums">{m.timer == null ? "—" : `${formaterNorsk(Number(m.timer))} t`}</span>
                  {m.mengde != null && <span className="text-gray-600">{formaterNorsk(Number(m.mengde))} {m.enhet ?? ""}</span>}
                  <span className="ml-auto flex items-center gap-1.5">
                    {/* S1: ✂ på en maskin som står på egen linje; en maskin på timelinja deles med den. */}
                    {linje.kilde.type === "maskin" && splittKnapp(linje)}
                    {kan && flyttKnapp("maskin", m.id)}
                    {kan && pennKnapp(t("timer.korrigert.vindu.maskin"), {
                      type: "maskin",
                      radId: m.id,
                      tittel: navn ?? "—",
                      timer: m.timer == null ? null : Number(m.timer),
                      hoyst: hoystFor.get(m.id) ?? null,
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Del>

      <Del nr={5} navn={t("timer.attestering.registrering.varer")}>
        {varer.length === 0 ? tom : (
          <div className="flex flex-col gap-1">
            {varer.map((v) => (
              <div key={v.id} data-varelinje={v.id} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-48 truncate">{v.navn ?? "—"}</span>
                  <span className="tabular-nums">{formaterNorsk(Number(v.antall))} {v.enhet ?? ""}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {kanRette && !v.attestert && (
                      <FlyttKnapp
                        maal={flyttMaal}
                        parRolle={parRolle}
                        disabled={flyttLinje.isPending}
                        onVelg={(m) => setVareFlytt({ v, maal: m, tekst: tallTekst(Math.min(1, Number(v.antall))) })}
                      />
                    )}
                  </span>
                </div>
                {vareFlytt?.v.id === v.id && (
                  <VareFlyttSkjema
                    vare={v}
                    maalNavn={maalTekst(vareFlytt.maal, parRolle, t)}
                    kildeNavn={kildeNavn}
                    tekst={vareFlytt.tekst}
                    opptatt={flyttLinje.isPending}
                    onTekst={(tekst) => setVareFlytt({ ...vareFlytt, tekst })}
                    onAvbryt={() => setVareFlytt(null)}
                    onFlytt={(mengde) => flyttTil("vare", v.id, vareFlytt.maal, mengde)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Del>

      <Del nr={6} navn={t("timer.attestering.registrering.tillegg")}>
        {tillegg.length === 0 ? tom : (
          <div className="flex flex-col gap-1.5">
            {tillegg.map((l) => {
              return (
                <div key={l.nokkel} data-tilleggslinje={l.nokkel} className="flex flex-wrap items-center gap-3">
                  <span className="w-48 truncate">{l.linje.betegnelse}</span>
                  <span className="tabular-nums">{l.linje.antall == null ? "—" : formaterNorsk(l.linje.antall)}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {splittKnapp(l)}
                    {kanRette && l.ventende && l.kilde.type === "tillegg" && flyttKnapp("tillegg", l.kilde.rad.id)}
                    {kanRette && l.ventende && l.kilde.type === "tillegg" && pennKnapp(t("timer.korrigert.vindu.tillegg"), {
                      type: "tillegg",
                      radId: l.kilde.rad.id,
                      tittel: l.linje.betegnelse ?? "—",
                      antall: l.linje.antall,
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Del>

      <Del nr={7} navn={t("timer.attestering.registrering.utlegg")} sist={!visReise}>
        {utlegg.length === 0 ? tom : (
          <div className="flex flex-col gap-1">
            {utlegg.map((l) => (
              <div key={l.nokkel} data-utleggslinje={l.nokkel} className="flex items-center gap-3">
                <span className="w-48 truncate">{l.linje.betegnelse}</span>
                <span className="tabular-nums">{l.linje.belop == null ? "—" : `${formaterNorsk(l.linje.belop)} kr`}</span>
                {/* w10a (A8, B31 B): kvitteringen også i kortet, samme komponent som på linja. */}
                {l.kilde.type === "utlegg" && <span className="flex items-center gap-1"><Kvitteringer vedlegg={l.kilde.rad.vedlegg ?? []} /></span>}
                {/* Lesning 3: utlegg flyttes bare når alle linjene i kortet venter. */}
                {kanRette && alleVenter && l.kilde.type === "utlegg" && <span className="ml-auto flex items-center gap-1.5">{flyttKnapp("utlegg", l.kilde.rad.id)}</span>}
              </div>
            ))}
          </div>
        )}
      </Del>

      {visReise && (
        <Del nr={8} navn={t("timer.attestering.registrering.reise")} sist>
          {reiseLinjer.length === 0 ? tom : (
          <div className="flex flex-col gap-3">
            {reiseLinjer.map((l) => {
              const r = l.kilde.rad;
              // w15f: reiselinja er tekst; tid, prosjekt, byggeplass og underprosjekt rettes i
              // «Rett reisen» bak ✎ — bare på en reise som venter, der attestanten kan attestere.
              // Lønnsarten rettes i «✎ Rediger jobben».
              const kanRetteReise = kanAttestere && l.ventende && l.harHandling && !sedel.egneTimer;
              const prosjekt = r.project ? [r.project.internalProjectNumber, r.project.name].filter(Boolean).join(" ") : kort.prosjekt;
              const tekst = [
                l.linje.fraTid && l.linje.tilTid ? `${l.linje.fraTid}–${l.linje.tilTid}` : t("timer.attestering.registrering.timer", { timer: formaterNorsk(l.linje.timer ?? 0) }),
                l.linje.betegnelse,
                prosjekt,
                r.byggeplassNavn ?? null,
                l.linje.underprosjekt ?? t("timer.prosjektkort.utenUnderprosjekt"),
              ].filter(Boolean).join(" · ");
              return (
                <div key={l.nokkel} data-reiselinje={l.nokkel} className="flex flex-col gap-1.5">
                  <ReiseRadMerke rad={r} sedelDato={sedel.dato} />
                  <div className="flex flex-wrap items-center gap-3">
                    <span data-reise-tekst="" className="tabular-nums text-gray-900">{tekst}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {splittKnapp(l)}
                      {kanRette && l.ventende && l.harHandling && flyttKnapp("reise", r.id)}
                      {kanRetteReise && (
                        <button
                          type="button"
                          onClick={() => setReiseRett(r)}
                          aria-label={t("timer.attestering.reiseRett.tittel")}
                          title={t("timer.attestering.reiseRett.tittel")}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </Del>
      )}

      {reiseRett && (
        <ReiseRettVindu
          rad={reiseRett}
          sedel={sedel}
          orgId={orgId}
          lonnsarter={lonnsarter}
          reiseKtx={reiseKtx}
          prosjektKontekst={prosjektKontekst}
          tidsrunding={tidsrunding}
          onLagret={() => { setReiseRett(null); onEndret(); }}
          onAvbryt={() => setReiseRett(null)}
        />
      )}

      {linjeRett && (
        <LinjeRettVindu
          linje={linjeRett}
          arbeiderNavn={sedel.ansatt?.name ?? null}
          tidsrunding={tidsrunding}
          onLagret={() => { setLinjeRett(null); onEndret(); }}
          onAvbryt={() => setLinjeRett(null)}
        />
      )}

      {feil && <p className="border-t border-gray-100 px-4 py-2 text-sm text-red-600">{feil}</p>}
      {!kanRette && kanAttestere && !sedel.redigerTillatt && (
        <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">{t("timer.attestering.registrering.rettingAv")}</p>
      )}
      {/* w7 (B15): egen sedel — knappene er borte; si hvorfor og hvor timene rettes. */}
      {sedel.egneTimer && (
        <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">{t("timer.attestering.egneTimer.forklaring")}</p>
      )}
    </div>
  );
}

function Del({ nr, navn, hoyre, sist, children }: { nr: number; navn: string; hoyre?: ReactNode; sist?: boolean; children: ReactNode }) {
  return (
    <div data-del={nr} className={`flex items-start gap-3 px-4 py-2 ${sist ? "" : "border-b border-gray-100"}`}>
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">{nr}</span>
      <span className="w-36 shrink-0 font-medium text-gray-900">{navn}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {hoyre && <div className="shrink-0">{hoyre}</div>}
    </div>
  );
}

const KL = /^([01]\d|2[0-3]):[0-5]\d$/;
// O19 pkt 23: del 1 av en reise delt ved midnatt slutter 24:00 — gyldig til-tid, aldri fra-tid.
const KL_TIL = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
type TidLagret = { fraTid: string | null; tilTid: string | null; pauseMin: number; timer: number | null };

/** Utfallet av fra, til og pause slik de står i feltene (w15g: samme regel i kortet og i vinduet). */
export type TidRetting =
  | { type: "uendret" }
  | { type: "feil"; nokkel: string }
  | { type: "ok"; felter: { fraTid: string; tilTid: string; timer: number; pauseMin: number } };

/**
 * Fra og til rundes med firmaets tidsrunding; urørt → «uendret». Ugyldig tid eller til før fra →
 * `ugyldigTid`, timer ≤ 0 → `pauseForLang`. Ellers timene som `(til − fra − pause) / 60`.
 */
export function tidRetting(lagret: TidLagret, felt: { fra: string; til: string; pause: string }, tidsrunding: number | null): TidRetting {
  const f = rundTilNarmeste(felt.fra, tidsrunding);
  const ti = rundTilNarmeste(felt.til, tidsrunding);
  if (f === (lagret.fraTid ?? "") && ti === (lagret.tilTid ?? "") && felt.pause === String(lagret.pauseMin)) return { type: "uendret" };
  if (!KL.test(f) || !KL_TIL.test(ti) || ti <= f) return { type: "feil", nokkel: "timer.attestering.registrering.ugyldigTid" };
  const p = Number.parseInt(felt.pause, 10);
  if (Number.isNaN(p) || p < 0) return { type: "feil", nokkel: "timer.attestering.registrering.ugyldigTid" };
  const timer = effektiveTimerFraSpenn(f, ti, f, p);
  if (timer <= 0) return { type: "feil", nokkel: "timer.attestering.registrering.pauseForLang" };
  return { type: "ok", felter: { fraTid: f, tilTid: ti, timer, pauseMin: p } };
}

/**
 * Fra, til og pause på én timelinje (w10a A1). Pausefeltet står bare på linja som bærer pausen.
 * Lagres når et felt forlates eller ved Enter: fra og til rundes med firmaets tidsrunding, timene
 * regnes ut som `(til − fra − pause) / 60` (`effektiveTimerFraSpenn` med pausen lagt fra fra-tida —
 * den formelen serveren godtar for en rad som bærer pausen, `vurderRadTimer`), og fra, til, timer og
 * pause sendes i ett kall. Ugyldig tid avvises før kallet; avviser serveren, settes feltene tilbake.
 * Timetallet ved siden av viser lagret `timer` til et felt er endret. Brukes bare på timebaserte
 * lønnsarter (`erTimebasertLonnsart`).
 *
 * w15g: med `onEndre` (vinduet bak ✎) lagres ingenting når et felt forlates eller ved Enter; hver
 * endring meldes som `TidRetting`, og «Lagre» i vinduet sender. Uten `onEndre` som før.
 */
export function TidFelter({ lagret, tidsrunding, onLagre, onFeil, onEndre }: {
  lagret: TidLagret;
  tidsrunding: number | null;
  onLagre?: (felter: { fraTid: string; tilTid: string; timer: number; pauseMin: number }, tilbake: () => void) => void;
  onFeil?: (tekst: string) => void;
  onEndre?: (r: TidRetting) => void;
}) {
  const { t } = useTranslation();
  const startFra = lagret.fraTid ?? "";
  const startTil = lagret.tilTid ?? "";
  const startPause = String(lagret.pauseMin);
  const [fra, setFra] = useState(startFra);
  const [til, setTil] = useState(startTil);
  const [pause, setPause] = useState(startPause);
  // Ny verdi fra serveren (lagret retting, ✂, del opp) erstatter feltene.
  useEffect(() => { setFra(startFra); setTil(startTil); setPause(startPause); }, [startFra, startTil, startPause]);
  const tilbake = () => { setFra(startFra); setTil(startTil); setPause(startPause); };
  const visPause = lagret.pauseMin > 0;
  const pauseTall = Number.parseInt(pause, 10);
  const gyldig = KL.test(fra) && KL_TIL.test(til) && !Number.isNaN(pauseTall) && pauseTall >= 0;
  // RETUR 1 vilkår 1: urørte felt viser lagret `timer` (kan være justert for hånd eller etter
  // eldre formel); den utregnede verdien vises først når fra, til eller pause er endret.
  const endret = fra !== startFra || til !== startTil || pause !== startPause;
  const utregnet = endret && gyldig ? effektiveTimerFraSpenn(fra, til, fra, pauseTall) : null;

  function lagre() {
    setFra(rundTilNarmeste(fra, tidsrunding));
    setTil(rundTilNarmeste(til, tidsrunding));
    if (onEndre) return;
    const r = tidRetting(lagret, { fra, til, pause }, tidsrunding);
    if (r.type === "uendret") return;
    if (r.type === "feil") { tilbake(); onFeil?.(t(r.nokkel)); return; }
    onLagre?.(r.felter, tilbake);
  }
  // w15g: vindu-modus — feltet endres, utfallet meldes, ingenting lagres.
  const endre = (ny: { fra?: string; til?: string; pause?: string }) => {
    const felt = { fra: ny.fra ?? fra, til: ny.til ?? til, pause: ny.pause ?? pause };
    if (ny.fra !== undefined) setFra(ny.fra);
    if (ny.til !== undefined) setTil(ny.til);
    if (ny.pause !== undefined) setPause(ny.pause);
    onEndre?.(tidRetting(lagret, felt, tidsrunding));
  };
  const tast = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); lagre(); }
    if (e.key === "Escape") { e.preventDefault(); tilbake(); onEndre?.({ type: "uendret" }); }
  };
  const klasse = "rounded border border-gray-300 px-1.5 py-0.5 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input aria-label={t("timer.attestering.registrering.fra")} value={fra} placeholder="07:00" inputMode="numeric" onChange={(e) => endre({ fra: e.target.value })} onBlur={lagre} onKeyDown={tast} className={`w-16 ${klasse}`} />
      <span className="text-gray-500">–</span>
      <input aria-label={t("timer.attestering.registrering.til")} value={til} placeholder="15:00" inputMode="numeric" onChange={(e) => endre({ til: e.target.value })} onBlur={lagre} onKeyDown={tast} className={`w-16 ${klasse}`} />
      {visPause && (
        <span className="inline-flex items-center gap-1 text-gray-600">
          <span>{t("timer.attestering.registrering.pauseFelt")}</span>
          <input aria-label={t("timer.attestering.registrering.pauseFelt")} value={pause} inputMode="numeric" onChange={(e) => endre({ pause: e.target.value })} onBlur={lagre} onKeyDown={tast} className={`w-12 text-right ${klasse}`} />
        </span>
      )}
      <span data-utregnet-timer="" className="w-14 font-medium tabular-nums text-gray-900">
        {t("timer.attestering.registrering.timer", { timer: formaterNorsk(utregnet ?? lagret.timer ?? 0) })}
      </span>
    </span>
  );
}

/** Utfallet av et tallfelt (w15g: samme regel i kortet og i vinduet). */
export type TallRetting = { type: "uendret" } | { type: "feil" } | { type: "over" } | { type: "ok"; verdi: number | null };

/** Urørt → «uendret»; ikke et tall → «feil»; over «høyst» (w9 2c) → «over»; ellers verdien (tomt = null). */
export function tallRetting(verdi: number | null, tekst: string, hoyst: number | null): TallRetting {
  const start = verdi == null ? "" : String(verdi).replace(".", ",");
  if (tekst === start) return { type: "uendret" };
  const tolket = tekst.trim() === "" ? null : Number(tekst.replace(",", "."));
  if (tolket !== null && Number.isNaN(tolket)) return { type: "feil" };
  if (tolket !== null && overMaskinHoyst(tolket, hoyst)) return { type: "over" };
  return { type: "ok", verdi: tolket };
}

/**
 * Tallfelt som lagres ved Enter, Tab eller når feltet forlates (hver retting lagres med en gang).
 * w15g: med `onEndre` (vinduet bak ✎) lagres ingenting; hver endring meldes som `TallRetting`.
 */
export function TallFelt({ etikett, verdi, enhet, hoyst = null, onLagre, onEndre }: { etikett: string; verdi: number | null; enhet?: string; hoyst?: number | null; onLagre?: (v: number | null, tilbake: () => void) => void; onEndre?: (r: TallRetting) => void }) {
  const { t } = useTranslation();
  const start = verdi == null ? "" : String(verdi).replace(".", ",");
  const [tekst, setTekst] = useState(start);
  // Ny verdi fra serveren (lagret retting, del opp) erstatter feltet.
  useEffect(() => setTekst(start), [start]);
  const tolket = tekst.trim() === "" ? null : Number(tekst.replace(",", "."));
  // w9 (2c): over «høyst» blir teksten rød og rettingen lagres ikke.
  const over = tolket !== null && !Number.isNaN(tolket) && overMaskinHoyst(tolket, hoyst);
  const lagre = () => {
    if (onEndre) return;
    if (tekst === start) return;
    const v = tolket;
    if (v !== null && Number.isNaN(v)) { setTekst(start); return; }
    if (over) return;
    onLagre?.(v, () => setTekst(start));
  };
  const endre = (ny: string) => {
    setTekst(ny);
    onEndre?.(tallRetting(verdi, ny, hoyst));
  };
  const tast = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); lagre(); }
    if (e.key === "Escape") { e.preventDefault(); setTekst(start); onEndre?.({ type: "uendret" }); }
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input
        aria-label={etikett}
        value={tekst}
        inputMode="decimal"
        onChange={(e) => endre(e.target.value)}
        onBlur={lagre}
        onKeyDown={tast}
        aria-invalid={over || undefined}
        className={`w-16 rounded border px-1.5 py-0.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 ${over ? "border-red-500 text-red-600 focus:ring-red-500" : "border-gray-300 focus:border-blue-400 focus:ring-blue-500"}`}
      />
      {enhet && <span className="text-gray-600">{enhet}</span>}
      {hoyst !== null && (
        <span data-testid="maskin-hoyst" className={`text-xs ${over ? "font-medium text-red-600" : "text-gray-500"}`}>
          {t("timer.maskin.hoyst", { timer: formaterNorsk(hoyst) })}
        </span>
      )}
    </span>
  );
}

/** Underprosjekt: «Uten» + knapper til og med 6, ellers søkbar nedtrekk (B11). */
export function UnderprosjektValg({ eco, valgt, disabled, onVelg }: { eco: readonly Eco[]; valgt: string | null; disabled?: boolean; onVelg: (id: string | null) => void }) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");
  const knapp = (id: string | null, tekst: string) => {
    const aktiv = valgt === id;
    return (
      <button
        key={id ?? "uten"}
        type="button"
        disabled={disabled}
        aria-pressed={aktiv}
        onClick={() => onVelg(id)}
        className={`rounded-full border px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
          aktiv ? "border-blue-700 bg-blue-700 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        {tekst}
      </button>
    );
  };
  if (eco.length <= UNDERPROSJEKT_KNAPPER_MAKS) {
    return <span className="flex flex-wrap items-center gap-1.5">{knapp(null, t("timer.attestering.registrering.uten"))}{eco.map((e) => knapp(e.id, ecoTekst(e)))}</span>;
  }
  const treff = eco.filter((e) => ecoTekst(e).toLowerCase().includes(sok.trim().toLowerCase()));
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <input
        value={sok}
        onChange={(e) => setSok(e.target.value)}
        placeholder={t("handling.sok")}
        aria-label={t("timer.attestering.registrering.sokUnderprosjekt")}
        disabled={disabled}
        className="w-36 rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <select
        aria-label={t("timer.attestering.registrering.underprosjekt")}
        value={valgt ?? ""}
        disabled={disabled}
        onChange={(e) => onVelg(e.target.value || null)}
        className="max-w-xs rounded border border-gray-300 bg-white px-2 py-1 text-xs"
      >
        <option value="">{t("timer.attestering.registrering.uten")}</option>
        {/* Valgt underprosjekt står alltid i lista, også når søket ikke treffer det. */}
        {eco.filter((e) => e.id === valgt && !treff.includes(e)).map((e) => <option key={e.id} value={e.id}>{ecoTekst(e)}</option>)}
        {treff.map((e) => <option key={e.id} value={e.id}>{ecoTekst(e)}</option>)}
      </select>
    </span>
  );
}

type MaskinVisning = { id: string; navn: string; timer: number; timerA: number; timerB: number };
type Forhandsvisning = { timerA: number; timerB: number; maskinPaaA: number; maskiner: MaskinVisning[] };
type DelingTekst = Record<string, { a: string; b: string }>;

const tallTekst = (n: number) => formaterNorsk(n);
const lesTall = (tekst: string): number | null => {
  const t = tekst.trim();
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return null;
  return Number(t.replace(",", "."));
};

/**
 * «Del opp» ved klokkeslett (bilde 8): del A er jobben som var, del B et eget kort.
 * O15 pkt 1 (plan § 4.16 «s2.ja»): hver maskin står med felt for A og B, fylt ut med serverens
 * forslag. A + B er maskinens timer — retter du den ene, regnes den andre. Varer, tillegg,
 * utlegg og reise blir i A («s3.nei»). O15 pkt 3 (K4): klokkeslettet tolkes (`tolkKlokkeslett`).
 */
function DelOppSkjema({ sheetId, kortId, tidsrom, eco, naaEco, onAvbryt, onDelt }: {
  sheetId: string; kortId: string; tidsrom: { fra: string; til: string }; eco: readonly Eco[]; naaEco: string | null; onAvbryt: () => void; onDelt: (kortIdB: string) => void;
}) {
  const { t } = useTranslation();
  const [klTekst, setKlTekst] = useState("");
  const [klFeil, setKlFeil] = useState(false);
  const [ecoB, setEcoB] = useState<string | null>(naaEco);
  const [feil, setFeil] = useState<string | null>(null);
  const [visning, setVisning] = useState<Forhandsvisning | null>(null);
  const [deling, setDeling] = useState<DelingTekst>({});
  const del = trpc.timer.dagsseddel.delJobb.useMutation();
  const kl = tolkKlokkeslett(klTekst);
  const gyldig = kl !== null;

  const maskinDeling = (d: DelingTekst) =>
    (visning?.maskiner ?? []).map((m) => ({ id: m.id, timerA: lesTall(d[m.id]?.a ?? "") ?? -1, timerB: lesTall(d[m.id]?.b ?? "") ?? -1 }));
  const delingGyldig = maskinDeling(deling).every((d) => d.timerA >= 0 && d.timerB >= 0);

  function forhandsvis(ny: string, medDeling?: DelingTekst) {
    setFeil(null);
    if (!medDeling) setVisning(null);
    del.mutate(
      { sheetId, kortId, kl: ny, externalCostObjectIdB: ecoB, forhandsvis: true, ...(medDeling ? { maskinDeling: maskinDeling(medDeling) } : {}) },
      {
        onSuccess: (d: unknown) => {
          const v = (d as { forhandsvisning: Forhandsvisning | null }).forhandsvisning;
          setVisning(v);
          if (v && !medDeling) setDeling(Object.fromEntries(v.maskiner.map((m) => [m.id, { a: tallTekst(m.timerA), b: tallTekst(m.timerB) }])));
        },
        onError: (e: { message: string }) => setFeil(e.message),
      },
    );
  }

  // Forhåndsvisningen kommer når tolkeren gir en gyldig tid (ikke ved 5 tegn), litt etter siste tast.
  useEffect(() => {
    // Ugyldig klokkeslett: forhåndsvisningen av forrige tid står ikke igjen.
    if (!kl) {
      setVisning(null);
      setDeling({});
      return;
    }
    const tid = setTimeout(() => forhandsvis(kl), 400);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- forhandsvis leser state ved kall
  }, [kl]);

  /** Retter du A, blir B resten — og omvendt (beslutning a: A + B = maskinens timer). */
  function settDel(m: MaskinVisning, side: "a" | "b", tekst: string) {
    const tall = lesTall(tekst);
    const rest = tall === null ? "" : tallTekst(Math.max(0, Math.round((m.timer - tall) * 100) / 100));
    setDeling((d) => ({ ...d, [m.id]: side === "a" ? { a: tekst, b: rest } : { a: rest, b: tekst } }));
  }

  function utfor() {
    if (!kl || !delingGyldig) return;
    setFeil(null);
    del.mutate(
      { sheetId, kortId, kl, externalCostObjectIdB: ecoB, maskinDeling: maskinDeling(deling) },
      { onSuccess: (d: unknown) => onDelt((d as { kortIdB: string }).kortIdB), onError: (e: { message: string }) => setFeil(e.message) },
    );
  }

  const maskinFelt = (m: MaskinVisning, side: "a" | "b") => (
    <input
      value={deling[m.id]?.[side] ?? ""}
      inputMode="decimal"
      aria-label={t(side === "a" ? "timer.attestering.registrering.maskinTimerA" : "timer.attestering.registrering.maskinTimerB", { maskin: m.navn })}
      onChange={(e) => settDel(m, side, e.target.value)}
      // Tomt eller ugyldig felt: ingenting sendes (ingen −1 til serveren), «Del opp» er sperret.
      onBlur={() => { if (kl && delingGyldig) forhandsvis(kl, deling); }}
      className="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums"
    />
  );

  return (
    <div data-del-opp="" className="mx-4 my-2 flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <label className="flex items-center gap-2">
        <span className="font-medium text-gray-900">{t("timer.attestering.registrering.delVed")}</span>
        <input
          autoFocus
          value={klTekst}
          placeholder="11:00"
          aria-label={t("timer.attestering.registrering.klokkeslett")}
          onChange={(e) => { setKlTekst(e.target.value); setKlFeil(false); }}
          onBlur={() => { if (kl) setKlTekst(kl); else setKlFeil(klTekst.trim() !== ""); }}
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm tabular-nums"
        />
        <span className="text-xs text-gray-500">{t("timer.attestering.registrering.timeneRegnes")}</span>
      </label>
      {klFeil && <p data-kl-feil="" className="text-sm text-red-600">{t("timer.attestering.registrering.klokkeslettFeil")}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-16 font-medium text-gray-900">{t("timer.attestering.registrering.jobbA")}</span>
        <span className="tabular-nums">
          {tidsrom.fra}–{kl ?? "…"}
          {visning && ` · ${formaterNorsk(visning.timerA)} t`}
        </span>
        <span className="text-xs text-gray-500">{t("timer.attestering.registrering.somFor")}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-16 font-medium text-gray-900">{t("timer.attestering.registrering.jobbB")}</span>
        <span className="tabular-nums">
          {kl ?? "…"}–{tidsrom.til}
          {visning && ` · ${formaterNorsk(visning.timerB)} t`}
        </span>
        <UnderprosjektValg eco={eco} valgt={ecoB} onVelg={setEcoB} />
      </div>
      {visning && visning.maskiner.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-gray-200 pt-2">
          {visning.maskiner.map((m) => (
            <div key={m.id} data-maskin-deling={m.id} className="flex flex-wrap items-center gap-3">
              <span className="min-w-[8rem] font-medium text-gray-900">{m.navn}</span>
              <span className="tabular-nums text-gray-500">{t("timer.attestering.registrering.timer", { timer: formaterNorsk(m.timer) })}</span>
              <span className="flex items-center gap-1.5">{t("timer.attestering.registrering.jobbA")} {maskinFelt(m, "a")} t</span>
              <span className="flex items-center gap-1.5">{t("timer.attestering.registrering.jobbB")} {maskinFelt(m, "b")} t</span>
            </div>
          ))}
        </div>
      )}
      {feil && <p className="text-sm text-red-600">{feil}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onAvbryt}>{t("handling.avbryt")}</Button>
        <Button type="button" size="sm" disabled={!gyldig || !delingGyldig || del.isPending || !!feil} onClick={utfor}>
          <Scissors className="mr-1 h-3.5 w-3.5" />
          {t("timer.attestering.registrering.delOpp")}
        </Button>
      </div>
    </div>
  );
}

type T = (k: string, o?: Record<string, unknown>) => string;

/** D2b: teksten på knappen for ett mål — partneren i paret, ellers «underprosjekt · fra–til». */
function maalTekst(m: FlyttMaal, parRolle: "a" | "b" | undefined, t: T): string {
  if (parRolle === "a") return t("timer.attestering.registrering.kortB");
  if (parRolle === "b") return t("timer.attestering.registrering.kortA");
  return m.navn;
}

/**
 * D2b: flytteknappen på en linje. I paret «→ Kort B» / «← Kort A»; alene «→ navn» for ett mål,
 * «→ Flytt til ▾» med liste for flere. Ingen mål → ingen knapp.
 */
function FlyttKnapp({ maal, parRolle, disabled, onVelg }: { maal: readonly FlyttMaal[]; parRolle?: "a" | "b"; disabled?: boolean; onVelg: (m: FlyttMaal) => void }) {
  const { t } = useTranslation();
  const [aapen, setAapen] = useState(false);
  if (maal.length === 0) return null;
  const stil = "inline-flex h-7 items-center rounded border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";
  const tittel = t("timer.attestering.registrering.flytt.tittel");
  if (maal.length === 1) {
    const m = maal[0]!;
    const tekst = parRolle === "a" ? t("timer.attestering.registrering.flytt.tilKortB")
      : parRolle === "b" ? t("timer.attestering.registrering.flytt.tilKortA")
      : t("timer.attestering.registrering.flytt.til", { navn: m.navn });
    return <button type="button" data-flytt-knapp="" title={tittel} disabled={disabled} onClick={() => onVelg(m)} className={stil}>{tekst}</button>;
  }
  return (
    <span className="relative">
      <button type="button" data-flytt-knapp="" title={tittel} aria-expanded={aapen} disabled={disabled} onClick={() => setAapen((v) => !v)} className={stil}>
        {t("timer.attestering.registrering.flytt.flyttTil")} ▾
      </button>
      {aapen && (
        <span role="menu" data-flytt-liste="" className="absolute right-0 top-full z-20 mt-1 flex min-w-[12rem] flex-col rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {maal.map((m) => (
            <button key={m.kortId} type="button" role="menuitem" onClick={() => { setAapen(false); onVelg(m); }} className="px-3 py-1.5 text-left text-xs text-gray-800 hover:bg-gray-50">
              {m.navn}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** D2b: «Til kort B: [1,00] av 3,00 sekk · 2,00 sekk blir i kort A» med Avbryt og Flytt. */
function VareFlyttSkjema({ vare, maalNavn, kildeNavn, tekst, opptatt, onTekst, onAvbryt, onFlytt }: {
  vare: AttVare; maalNavn: string; kildeNavn: string; tekst: string; opptatt: boolean;
  onTekst: (tekst: string) => void; onAvbryt: () => void; onFlytt: (mengde: number) => void;
}) {
  const { t } = useTranslation();
  const antall = Number(vare.antall);
  const mengde = lesTall(tekst);
  const gyldig = mengde !== null && mengde > 0 && mengde <= antall;
  const enhet = vare.enhet ?? "";
  return (
    <div data-vare-flytt="" className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <span className="font-medium text-gray-900">{t("timer.attestering.registrering.flytt.vareTil", { maal: maalNavn })}</span>
      <input
        autoFocus
        value={tekst}
        inputMode="decimal"
        aria-label={t("timer.attestering.registrering.flytt.mengde")}
        onChange={(e) => onTekst(e.target.value)}
        className="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums"
      />
      <span className="tabular-nums text-gray-700">{t("timer.attestering.registrering.flytt.vareAv", { antall: tallTekst(antall), enhet })}</span>
      {gyldig && (
        <span className="tabular-nums text-gray-500">
          · {t("timer.attestering.registrering.flytt.vareBlir", { rest: tallTekst(Math.round((antall - mengde) * 100) / 100), enhet, kilde: kildeNavn })}
        </span>
      )}
      <span className="ml-auto flex gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onAvbryt}>{t("handling.avbryt")}</Button>
        <Button type="button" size="sm" disabled={!gyldig || opptatt} onClick={() => gyldig && onFlytt(mengde)}>
          {t("timer.attestering.registrering.flytt.flytt")}
        </Button>
      </span>
    </div>
  );
}
