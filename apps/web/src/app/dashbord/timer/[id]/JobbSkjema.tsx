"use client";

/**
 * Plan § 8.22 L3a (Bilde 2-jobben, skisse l3-a/b/c): jobben føres rett i kortet.
 * Rad 1–3 (Fra–til/pause, lønnsart, «Hva gjorde du?») lagres når feltet forlates — ingen
 * Lagre-knapp. Tiden går til `dagsseddel.lagreJobbTid`, som regner overtidslinja selv (delt
 * `regnJobbTid`, samme som forhåndsvisningen her). Rad 4–7 er dagens linjer med blyant,
 * vinduer og lenker, levert av siden. Ny jobb (`ny`) finnes bare på skjermen til Til er fylt.
 *
 * O2: timer redigeres der de står («= X t»): skrevne timer gir Til = Fra + timer + pause (delt
 * `tilFraAntall`); endres Til eller pause, regnes timer på nytt. Fra/Til er klokkefelt
 * (`type="time"`) med timevinduets steg, rundes ved blur som timevinduet; feilmelding først ved blur.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useFaarPlassPaaEnLinje } from "@/hooks/useFaarPlassPaaEnLinje";
import { formaterTimer } from "@/lib/tallformat";
import { rundTilNarmeste } from "@/lib/tidsrunding";
import { klokkeSteg, lesPauseMin, tilFraTimer, type SkjemaKilde } from "@/lib/jobbSkjema";
import { byggeplasserForProsjekt, velgStandardByggeplass, type ByggeplassValg } from "@/lib/timerByggeplass";
import {
  regnJobbTid,
  validerJobbTid,
  type JobbTidFeil,
  type OvertidForslagRad,
} from "@sitedoc/shared";

export type SkjemaLonnsart = {
  id: string;
  navn: string;
  overtidsnivaa: number | null;
  aktiv: boolean;
  type: string;
  rekkefolge: number;
};

export type SkjemaLinje = {
  id: string;
  fraTid: string;
  tilTid: string;
  pauseMin: number;
  lonnsartId: string;
  timer: number;
  beskrivelse: string | null;
};

export type SkjemaRad47 = { nr: number; etikett: string; innhold: ReactNode };

type Lagring = "ingen" | "lagrer" | "lagret" | "feil";

export function JobbSkjema({
  sheetId,
  kortId,
  linjer,
  ny,
  kilde,
  startLagret = false,
  lonnsarter,
  velgbareLonnsarter,
  andreRader,
  norm,
  pauseEtterTimer,
  fastPauseFra,
  datoTekst,
  projectId,
  ecoId,
  organizationId,
  onAapneVindu,
  rader47,
  onUlagret,
  tidsrundingMinutter = null,
  byggeplassId = null,
  stedValg,
}: {
  sheetId: string;
  kortId: string;
  /** Jobbens 1–2 arbeidslinjer (sortert). Tom for en ny jobb. */
  linjer: readonly SkjemaLinje[];
  /** Ny jobb: stedet og forslaget. Raden lages ved første gyldige lagring (Til fylt). */
  ny?: {
    projectId: string;
    aktivitetId: string;
    byggeplassId: string | null;
    fraTid: string;
    tilTid: string;
    pauseMin: number;
    lonnsartId: string;
  };
  /** Gule felt og merke: forslaget kom fra firmaets arbeidstid eller forrige jobb. */
  kilde: SkjemaKilde | null;
  /** Jobben ble nettopp lagret fra utkastet (skjemaet er montert på nytt i kortet). */
  startLagret?: boolean;
  lonnsarter: readonly SkjemaLonnsart[];
  /** Arbeids-lønnsartene i nedtrekket (ikke reise). */
  velgbareLonnsarter: readonly SkjemaLonnsart[];
  /** Dagens andre timerader (uten jobbens arbeidslinjer). */
  andreRader: readonly OvertidForslagRad[];
  norm: number | null;
  pauseEtterTimer: number;
  fastPauseFra: string | null;
  datoTekst: string;
  /** Jobbens prosjekt og underprosjekt (valgene i hodet, L3b). */
  projectId: string;
  ecoId: string | null;
  organizationId: string | undefined;
  /**
   * Blyanten: dagens vindu for linje 1 (byggeplass, aktivitet m.m.). Underprosjektet velges i
   * hodet (L3b). Ny jobb (retur O8 tillegg): vinduet for ny rad, med tidene som står i skjemaet.
   */
  onAapneVindu?: (nyTider?: { fraTid: string; tilTid: string }) => void;
  rader47: readonly SkjemaRad47[];
  /** Noe i skjemaet er ikke lagret (ugyldig felt eller feilet lagring). */
  onUlagret: (kortId: string, ulagret: boolean) => void;
  /** Firmaets tidsrunding (som timevinduet): Fra/Til rundes ved blur, klokkevelgerens steg. */
  tidsrundingMinutter?: number | null;
  /** Jobbens byggeplass (hodet). */
  byggeplassId?: string | null;
  /**
   * O8 D (§ 8.22): prosjekt og byggeplass som nedtrekk på en lagret jobb. Endres de, flyttes hele
   * jobben dit (`dagsseddel.flyttJobb`) — reisen blir stående. Jobben får ny kort-id (`onFlyttet`).
   */
  stedValg?: {
    prosjekter: readonly { id: string; navn: string }[];
    byggeplasser: readonly ByggeplassValg[];
    onFlyttet: (nyKortId: string) => void;
  };
}) {
  const { t, i18n } = useTranslation();
  const utils = trpc.useUtils();
  const lagreTid = trpc.timer.dagsseddel.lagreJobbTid.useMutation();
  const tilfoy = trpc.timer.dagsseddel.tilfoyTimerRad.useMutation();
  const oppdater = trpc.timer.dagsseddel.oppdaterTimerRad.useMutation();
  const flyttEco = trpc.timer.dagsseddel.flyttJobbEco.useMutation();
  const flyttSted = trpc.timer.dagsseddel.flyttJobb.useMutation();
  // L3b: prosjektets underprosjekter. Lukkede hentes også, bare for å kunne vise navnet når
  // jobben står på et underprosjekt som er lukket siden — valgene er de åpne.
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery(
    { projectId, organizationId, inkluderLukket: true },
    { enabled: !!projectId },
  );
  const apneEcoer = (ecoer ?? []).filter((e) => e.status === "aktiv" && e.timerregistreringApen);
  const ecoNavn = (e: { proAdmId: string; kortNavn: string }) => `${e.proAdmId} · ${e.kortNavn}`;
  // Ny jobb: valget sendes med når raden lages (Til fylt). Lagret jobb: hele jobben flyttes.
  const [nyEcoId, setNyEcoId] = useState<string | null>(null);
  const valgtEcoId = linjer.length > 0 ? ecoId : nyEcoId;
  const lukketValgt =
    valgtEcoId && !apneEcoer.some((e) => e.id === valgtEcoId)
      ? ((ecoer ?? []).find((e) => e.id === valgtEcoId) ?? null)
      : null;
  const visUnderprosjekt = apneEcoer.length > 0 || !!valgtEcoId;
  const [ecoSok, setEcoSok] = useState("");
  // O8 (§ 8.22 punkt 3): knapper så lenge «Uten» og alle underprosjektene får plass på én
  // linje; ellers søkbar nedtrekk. Kan ikke bredden måles: som før (≤ 6 gir knapper).
  const ecoValg = [
    { id: null as string | null, navn: t("timer.jobbSkjema.utenUnderprosjekt"), lukket: false },
    ...apneEcoer.map((e) => ({ id: e.id as string | null, navn: ecoNavn(e), lukket: false })),
    ...(lukketValgt ? [{ id: lukketValgt.id as string | null, navn: ecoNavn(lukketValgt), lukket: true }] : []),
  ];
  const ecoPlass = useFaarPlassPaaEnLinje(`${visUnderprosjekt}|${ecoValg.map((v) => v.navn).join("|")}`);
  const ecoKnapper = ecoPlass.faarPlass ?? apneEcoer.length <= 6;
  // Feilet flytting: «Prøv igjen» sender samme valg på nytt.
  const ventendeEco = useRef<{ id: string | null } | null>(null);

  const l1 = linjer[0];
  const l2 = linjer[1];
  const lagretVerdi = l1
    ? {
        fra: l1.fraTid,
        til: (l2 ?? l1).tilTid,
        pause: String(l1.pauseMin),
        art1: l1.lonnsartId,
        art2: l2?.lonnsartId ?? null,
        beskrivelse: l1.beskrivelse ?? "",
      }
    : {
        fra: ny?.fraTid ?? "",
        til: ny?.tilTid ?? "",
        pause: String(ny?.pauseMin ?? 0),
        art1: ny?.lonnsartId ?? "",
        art2: null as string | null,
        beskrivelse: "",
      };
  const lagretNokkel = JSON.stringify(lagretVerdi);

  const [fra, setFra] = useState(lagretVerdi.fra);
  const [til, setTil] = useState(lagretVerdi.til);
  const [pause, setPause] = useState(lagretVerdi.pause);
  const [art1, setArt1] = useState(lagretVerdi.art1);
  const [art2, setArt2] = useState<string | null>(lagretVerdi.art2);
  const [beskrivelse, setBeskrivelse] = useState(lagretVerdi.beskrivelse);
  const [beroert, setBeroert] = useState(false);
  const [lagring, setLagring] = useState<Lagring>(startLagret ? "lagret" : "ingen");
  const [serverFeil, setServerFeil] = useState<string | null>(null);
  const [visFeil, setVisFeil] = useState(false);
  // O2: arbeideren skriver i et tidsfelt — ingen feilmelding før feltet forlates.
  const [skriver, setSkriver] = useState(false);
  // O2: timefeltet mens det redigeres (null = viser regnet timer).
  const [timerTekst, setTimerTekst] = useState<string | null>(null);
  // O2: blur tolker feltet først; lagringen kjøres etter at de tolkede verdiene er rendret.
  const [lagreSignal, setLagreSignal] = useState(0);

  // Nye verdier fra serveren (etter lagring, eller endret et annet sted) tas inn når feltene
  // står som sist lagret — en pågående endring overskrives ikke.
  const forrige = useRef(lagretVerdi);
  useEffect(() => {
    const f = forrige.current;
    forrige.current = lagretVerdi;
    if (fra === f.fra) setFra(lagretVerdi.fra);
    if (til === f.til) setTil(lagretVerdi.til);
    if (pause === f.pause) setPause(lagretVerdi.pause);
    if (art1 === f.art1) setArt1(lagretVerdi.art1);
    if (art2 === f.art2) setArt2(lagretVerdi.art2);
    if (beskrivelse === f.beskrivelse) setBeskrivelse(lagretVerdi.beskrivelse);
    // Bare når serverens verdier endres (nøkkelen), ikke ved hver tastetrykk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lagretNokkel]);

  const pauseMin = lesPauseMin(pause);
  const tidFeil: JobbTidFeil | null = validerJobbTid({ fraTid: fra, tilTid: til, pauseMin });
  const tilMangler = !!ny && til.trim() === "";
  const artFor = (id: string | null) => lonnsarter.find((l) => l.id === id) ?? null;
  const regnet = tidFeil
    ? null
    : regnJobbTid({
        fraTid: fra,
        tilTid: til,
        pauseMin,
        linje1Overtidsnivaa: artFor(art1)?.overtidsnivaa ?? null,
        andreRader,
        norm,
        lonnsarter,
        pauseEtterTimer,
        fastPauseFra,
      });

  const tidsfeltEndret = !l1 || fra !== lagretVerdi.fra || til !== lagretVerdi.til || pause !== lagretVerdi.pause;
  // Gate 129 V1: lønnsarten som lagres på linje 1. Flyttes tiden slik at hele jobben ligger
  // over normen, blir det firmaets overtidsart — samme regel som serveren (`lagreJobbTid`).
  // Et bytte på uendret tid beholdes. Nedtrekket viser denne verdien.
  const art1Lagres =
    tidsfeltEndret && regnet?.ok && regnet.helOvertid && regnet.overtidLonnsart ? regnet.overtidLonnsart.id : art1;
  const tidEndret =
    tidsfeltEndret ||
    art1 !== lagretVerdi.art1 ||
    (!!l2 && art2 !== lagretVerdi.art2);
  // Gate 129 V2: skjemaet viser regnet linjedeling. Avviker den fra de lagrede linjene (antall,
  // fra/til eller timer) uten at noe er endret her — feilet lagring, en annen jobb endret, eldre
  // data — er lønnsgrunnlaget ikke det skjemaet viser: kortet står som ulagret til det lagres.
  const avvik =
    !!l1 &&
    !tidEndret &&
    !!regnet?.ok &&
    (regnet.linjer.length !== linjer.length ||
      regnet.linjer.some((r, i) => {
        const l = linjer[i];
        return !l || r.fraTid !== l.fraTid || r.tilTid !== l.tilTid || Math.abs(r.timer - l.timer) > 0.005;
      }));
  const beskrivelseEndret = !!l1 && beskrivelse.trim() !== (lagretVerdi.beskrivelse ?? "").trim();
  // Ulagret = lagring pågår eller feilet, eller et endret felt er ugyldig. En ny jobb uten Til
  // er ingen ulagret endring: den forsvinner når kortet forlates (§ 2e).
  const ulagret =
    lagring === "feil" || lagring === "lagrer" || avvik || (!tilMangler && !!tidFeil && tidEndret);
  // Ny jobb: raden fra kall 1 (`tilfoyTimerRad`). Feiler kall 2, tar «Prøv igjen» bare kall 2.
  const nyRadId = useRef<string | null>(null);
  useEffect(() => {
    onUlagret(kortId, ulagret);
  }, [kortId, ulagret, onUlagret]);
  useEffect(() => () => onUlagret(kortId, false), [kortId, onUlagret]);

  const ferdig = async (oppdatert: Promise<unknown>) => {
    setLagring("lagrer");
    setServerFeil(null);
    try {
      await oppdatert;
      await utils.timer.dagsseddel.hentMedId.invalidate({ id: sheetId });
      setLagring("lagret");
    } catch (e) {
      setServerFeil((e as { message?: string }).message ?? null);
      setLagring("feil");
    }
  };

  const lagreTiden = () => {
    if (lagring === "lagrer") return;
    if (tilMangler) return;
    if (tidFeil) {
      setVisFeil(true);
      return;
    }
    setVisFeil(false);
    if (!tidEndret && !avvik && lagring !== "feil") return;
    if (!l1) {
      if (!ny) return;
      // Ny jobb: raden lages med hele spennet, så regner serveren linjene (lagreJobbTid).
      // Ligger hele jobben over normen, får den firmaets overtidsart med en gang (`art1Lagres`).
      const art = art1Lagres;
      void ferdig(
        (async () => {
          const radId =
            nyRadId.current ??
            (await tilfoy.mutateAsync({
            sheetId,
            projectId: ny.projectId,
            byggeplassId: ny.byggeplassId,
            lonnsartId: art,
            aktivitetId: ny.aktivitetId,
            externalCostObjectId: nyEcoId,
            timer: regnet?.ok ? regnet.timer : 0,
            fraTid: fra,
            tilTid: til,
            pauseMin,
            kortId,
          })).id;
          nyRadId.current = radId;
          await lagreTid.mutateAsync({
            sheetId,
            kortId,
            fraTid: fra,
            tilTid: til,
            pauseMin,
            linjer: [{ radId, lonnsartId: art }],
          });
        })(),
      );
      return;
    }
    void ferdig(
      lagreTid.mutateAsync({
        sheetId,
        kortId,
        fraTid: fra,
        tilTid: til,
        pauseMin,
        linjer: [
          { radId: l1.id, lonnsartId: art1Lagres },
          ...(l2 ? [{ radId: l2.id, lonnsartId: art2 ?? l2.lonnsartId }] : []),
        ],
      }),
    );
  };

  useEffect(() => {
    if (lagreSignal > 0) lagreTiden();
    // Bare når et tidsfelt er forlatt (signalet), med verdiene etter tolkingen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lagreSignal]);

  const lagreBeskrivelse = () => {
    if (!l1 || !beskrivelseEndret || lagring === "lagrer") return;
    const tekst = beskrivelse.trim() === "" ? null : beskrivelse;
    // «Hva gjorde du?» gjelder jobben: alle linjene får teksten. Tid og pause sendes uendret.
    void ferdig(
      (async () => {
        for (const l of linjer) {
          await oppdater.mutateAsync({
            id: l.id,
            beskrivelse: tekst,
            fraTid: l.fraTid,
            tilTid: l.tilTid,
            pauseMin: l.pauseMin,
            timer: l.timer,
          });
        }
      })(),
    );
  };

  // L3b: underprosjekt for hele jobben (timer, maskin, vare, tillegg, utlegg — ikke reise).
  const velgEco = (nyId: string | null) => {
    if (lagring === "lagrer") return;
    if (!l1) {
      setNyEcoId(nyId);
      return;
    }
    if (nyId === ecoId && !ventendeEco.current) return;
    ventendeEco.current = { id: nyId };
    void ferdig(
      (async () => {
        await flyttEco.mutateAsync({ sheetId, kortId, externalCostObjectId: nyId });
        ventendeEco.current = null;
      })(),
    );
  };

  // O8 D: prosjekt eller byggeplass endret på lagret jobb — hele jobben flyttes. Nytt prosjekt:
  // byggeplassen velges som for en ny rad (eneste kandidat, ellers ingen).
  const ventendeSted = useRef<{ projectId: string; byggeplassId: string | null } | null>(null);
  const velgSted = (endring: { projectId?: string; byggeplassId?: string | null }) => {
    if (lagring === "lagrer" || !l1 || !stedValg) return;
    const nyttProsjekt = endring.projectId ?? projectId;
    const nyByggeplass =
      endring.byggeplassId !== undefined
        ? endring.byggeplassId
        : velgStandardByggeplass({
            gjeldende: nyttProsjekt === projectId ? byggeplassId : null,
            kandidater: byggeplasserForProsjekt(stedValg.byggeplasser, nyttProsjekt),
            toppbar: null,
          });
    if (nyttProsjekt === projectId && nyByggeplass === byggeplassId && !ventendeSted.current) return;
    ventendeSted.current = { projectId: nyttProsjekt, byggeplassId: nyByggeplass };
    void ferdig(
      (async () => {
        const svar = await flyttSted.mutateAsync({
          sheetId,
          kortId,
          projectId: nyttProsjekt,
          byggeplassId: nyByggeplass,
        });
        ventendeSted.current = null;
        await utils.vareforbruk.hentMineForDato.invalidate();
        if (svar.kortId !== kortId) stedValg.onFlyttet(svar.kortId);
      })(),
    );
  };

  const provIgjen = () => {
    if (ventendeSted.current) {
      velgSted(ventendeSted.current);
      return;
    }
    if (ventendeEco.current) {
      velgEco(ventendeEco.current.id);
      return;
    }
    if (tidEndret || avvik || !l1) lagreTiden();
    if (beskrivelseEndret) lagreBeskrivelse();
  };

  const gul = !!kilde && !beroert;
  const felt = (feil: boolean) =>
    `rounded border px-2 py-1 text-sm tabular-nums ${
      feil ? "border-red-500" : gul ? "border-yellow-300 bg-yellow-50" : "border-gray-300"
    }`;
  const endre = (sett: (v: string) => void) => (e: { target: { value: string } }) => {
    setBeroert(true);
    setSkriver(true);
    sett(e.target.value);
  };
  // Fra/Til forlates: klokkefeltet gir "" eller HH:MM; rund som timevinduet, og lagre.
  const forlatKlokke = (verdi: string, sett: (v: string) => void) => {
    sett(verdi === "" ? "" : rundTilNarmeste(verdi, tidsrundingMinutter));
    setSkriver(false);
    setLagreSignal((n) => n + 1);
  };
  const forlatTid = () => {
    setSkriver(false);
    setTimerTekst(null);
    setLagreSignal((n) => n + 1);
  };
  const endreTimer = (v: string) => {
    setBeroert(true);
    setSkriver(true);
    setTimerTekst(v);
    const nyTil = tilFraTimer(fra, v, pauseMin);
    if (nyTil) setTil(nyTil);
  };
  // Samme steg som timevinduets `timeStep` (sekunder).
  const stegSek = klokkeSteg(tidsrundingMinutter) * 60;
  const fmt = (n: number) => formaterTimer(n, i18n.language);
  const visTidFeil = !skriver && ((visFeil && !!tidFeil) || tilMangler);
  const feilFelt = (feil: boolean) => !skriver && feil;
  const etikett = "w-28 shrink-0 text-xs font-medium text-gray-500";
  const rad = "flex flex-wrap items-start gap-2 py-2";
  const tom = <span className="text-sm text-gray-400">—</span>;

  return (
    <div className="divide-y divide-gray-100" data-testid="jobb-skjema">
      {(kilde || onAapneVindu) && (
        <div className="flex items-center gap-2 pb-2">
          {kilde && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800" data-testid="skjema-kilde">
              {kilde === "firma" ? t("timer.jobbSkjema.kildeFirma") : t("timer.jobbSkjema.kildeForrige")}
            </span>
          )}
          {onAapneVindu && (
            <button
              type="button"
              onClick={() => onAapneVindu(ny ? { fraTid: fra, tilTid: til } : undefined)}
              className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
              title={t(ny ? "timer.jobbSkjema.aapneVinduHintNy" : "timer.jobbSkjema.aapneVinduHint")}
            >
              <Pencil className="h-3.5 w-3.5" />
              {t("timer.jobbSkjema.aapneVindu")}
            </button>
          )}
        </div>
      )}

      {l1 && stedValg && (
        <div className={rad} data-testid="skjema-prosjekt">
          <span className={etikett}>{t("timer.felt.prosjekt")}</span>
          <select
            aria-label={t("timer.felt.prosjekt")}
            value={projectId}
            disabled={lagring === "lagrer"}
            onChange={(e) => velgSted({ projectId: e.target.value })}
            className="min-w-0 max-w-xs flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {stedValg.prosjekter.map((p) => (
              <option key={p.id} value={p.id}>
                {p.navn}
              </option>
            ))}
          </select>
        </div>
      )}
      {l1 && stedValg && byggeplasserForProsjekt(stedValg.byggeplasser, projectId).length > 0 && (
        <div className={rad} data-testid="skjema-byggeplass">
          <span className={etikett}>{t("timer.felt.byggeplass")}</span>
          <select
            aria-label={t("timer.felt.byggeplass")}
            value={byggeplassId ?? ""}
            disabled={lagring === "lagrer"}
            onChange={(e) => velgSted({ byggeplassId: e.target.value || null })}
            className="min-w-0 max-w-xs flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">{t("timer.byggeplass.ingenValgt")}</option>
            {byggeplasserForProsjekt(stedValg.byggeplasser, projectId).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {visUnderprosjekt && (
        <div className={rad} data-testid="skjema-underprosjekt">
          <span className={etikett}>{t("timer.jobbSkjema.underprosjekt")}</span>
          {/* O8: flaten har fast bredde (basis-0) — bytte mellom knapper og nedtrekk endrer den
              ikke, så grensen flimrer ikke. Målet er en usynlig kopi av knappene på én linje. */}
          <div ref={ecoPlass.plassRef} className="min-w-0 flex-1 basis-0" data-testid="underprosjekt-plass">
          <div aria-hidden="true" className="pointer-events-none invisible h-0 overflow-hidden">
            <div ref={ecoPlass.maalRef} className="flex w-max gap-2" data-underprosjekt-maal="">
              {ecoValg.map((v) => (
                <span key={v.id ?? "uten"} className="shrink-0 rounded-full border px-3 py-1 text-sm">
                  {v.navn}
                </span>
              ))}
            </div>
          </div>
          {ecoKnapper ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("timer.jobbSkjema.underprosjekt")}>
              {ecoValg.map((v) => {
                const valgt = v.id === valgtEcoId;
                return (
                  <button
                    key={v.id ?? "uten"}
                    type="button"
                    aria-pressed={valgt}
                    disabled={v.lukket || lagring === "lagrer"}
                    onClick={() => velgEco(v.id)}
                    title={v.lukket ? t("timer.jobbSkjema.underprosjektLukket") : undefined}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      valgt
                        ? "border-blue-700 bg-blue-700 text-white"
                        : "border-gray-300 bg-white text-gray-800 hover:border-gray-400"
                    } disabled:cursor-default`}
                  >
                    {v.navn}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={ecoSok}
                onChange={(e) => setEcoSok(e.target.value)}
                placeholder={t("timer.jobbSkjema.sokUnderprosjekt")}
                aria-label={t("timer.jobbSkjema.sokUnderprosjekt")}
                className="w-40 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <select
                aria-label={t("timer.jobbSkjema.underprosjekt")}
                value={valgtEcoId ?? ""}
                disabled={lagring === "lagrer"}
                onChange={(e) => velgEco(e.target.value === "" ? null : e.target.value)}
                className="max-w-xs rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">{t("timer.jobbSkjema.utenUnderprosjekt")}</option>
                {lukketValgt && (
                  <option value={lukketValgt.id} disabled>
                    {ecoNavn(lukketValgt)}
                  </option>
                )}
                {apneEcoer
                  .filter((e) => {
                    const s = ecoSok.trim().toLowerCase();
                    return e.id === valgtEcoId || s === "" || ecoNavn(e).toLowerCase().includes(s);
                  })
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {ecoNavn(e)}
                    </option>
                  ))}
              </select>
            </div>
          )}
          </div>
        </div>
      )}

      <div className={rad}>
        <span className={etikett}>1 · {t("timer.jobbSkjema.fraTil")}</span>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label={t("timer.jobbSkjema.fra")}
              value={fra}
              onChange={endre(setFra)}
              onBlur={(e) => forlatKlokke(e.target.value, setFra)}
              type="time"
              step={stegSek}
              className={`w-28 ${felt(feilFelt(visFeil && (tidFeil === "format" || tidFeil === "fraForTil") && !tilMangler))}`}
            />
            <span className="text-gray-400">–</span>
            <input
              aria-label={t("timer.jobbSkjema.til")}
              value={til}
              onChange={endre(setTil)}
              onBlur={(e) => forlatKlokke(e.target.value, setTil)}
              type="time"
              step={stegSek}
              className={`w-28 ${felt(feilFelt(tilMangler || (visFeil && (tidFeil === "format" || tidFeil === "fraForTil"))))}`}
            />
            <span className="text-xs text-gray-500">{t("timer.jobbSkjema.pause")}</span>
            <input
              aria-label={t("timer.jobbSkjema.pause")}
              value={pause}
              onChange={endre(setPause)}
              onBlur={forlatTid}
              inputMode="numeric"
              className={`w-14 ${felt(feilFelt(visFeil && tidFeil === "pause"))}`}
            />
            {/* O2 (Bilde 2-pila): timer redigeres der de står. */}
            <span className="text-sm text-gray-700">=</span>
            <input
              aria-label={t("timer.jobbSkjema.timer")}
              data-testid="skjema-timer"
              value={timerTekst ?? (regnet?.ok ? fmt(regnet.timer) : "")}
              onFocus={() => setTimerTekst(regnet?.ok ? fmt(regnet.timer) : "")}
              onChange={(e) => endreTimer(e.target.value)}
              onBlur={forlatTid}
              inputMode="decimal"
              placeholder="--"
              className={`w-16 ${felt(false)}`}
            />
            <span className="text-sm text-gray-700">t</span>
          </div>
          {visTidFeil && (
            <p className="text-xs text-red-600" role="alert">
              {tilMangler
                ? t("timer.jobbSkjema.fyllTil")
                : tidFeil === "format"
                  ? t("timer.jobbSkjema.feilFormat")
                  : tidFeil === "fraForTil"
                    ? t("timer.jobbSkjema.feilFraForTil")
                    : t("timer.jobbSkjema.feilPause")}
            </p>
          )}
        </div>
      </div>

      <div className={rad}>
        <span className={etikett}>2 · {t("timer.jobbSkjema.lonnsart")}</span>
        {tilMangler || !regnet?.ok ? (
          <span className="text-sm text-gray-400">{tilMangler ? t("timer.jobbSkjema.kommerNaarTil") : "—"}</span>
        ) : (
          <div className="flex flex-col gap-1">
            {(() => {
              const [r1, r2] = regnet.linjer;
              const linje1Tekst = r1 ? t("timer.jobbSkjema.linje", { fra: r1.fraTid, til: r1.tilTid, timer: fmt(r1.timer) }) : "";
              return (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-700">{linje1Tekst}</span>
                    <select
                      aria-label={t("timer.jobbSkjema.lonnsart")}
                      value={art1Lagres}
                      onChange={(e) => {
                        setBeroert(true);
                        setArt1(e.target.value);
                      }}
                      onBlur={lagreTiden}
                      className={felt(false)}
                    >
                      {velgbareLonnsarter.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.navn}
                        </option>
                      ))}
                    </select>
                  </div>
                  {regnet.helOvertid && norm !== null && (
                    <span className="text-xs text-gray-500">
                      {t("timer.jobbSkjema.helOvertid", { dato: datoTekst, norm: fmt(norm) })}
                    </span>
                  )}
                  {r2 && (
                    <div className="flex flex-wrap items-center gap-2" data-testid="overtid-linje">
                      {l2 ? (
                        <select
                          aria-label={t("timer.jobbSkjema.lonnsart")}
                          value={art2 ?? l2.lonnsartId}
                          onChange={(e) => {
                            setBeroert(true);
                            setArt2(e.target.value);
                          }}
                          onBlur={lagreTiden}
                          className={felt(false)}
                        >
                          {velgbareLonnsarter
                            .filter((l) => l.overtidsnivaa != null)
                            .map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.navn}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <span className="text-sm font-medium text-gray-800">{regnet.overtidLonnsart?.navn}</span>
                      )}
                      <span className="text-sm text-gray-700">
                        {t("timer.jobbSkjema.overtidLinje", {
                          fra: r2.fraTid,
                          til: r2.tilTid,
                          timer: fmt(r2.timer),
                          dato: datoTekst,
                          norm: norm === null ? "?" : fmt(norm),
                        })}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div className={rad}>
        <span className={etikett}>3 · {t("timer.jobbSkjema.hvaGjorde")} *</span>
        <textarea
          aria-label={t("timer.jobbSkjema.hvaGjorde")}
          value={beskrivelse}
          disabled={!l1}
          onChange={(e) => setBeskrivelse(e.target.value)}
          onBlur={lagreBeskrivelse}
          rows={2}
          placeholder={l1 ? t("timer.jobbSkjema.hvaGjordePlassholder") : t("timer.jobbSkjema.kommerNaarTil")}
          className={`min-w-[16rem] flex-1 rounded border px-2 py-1 text-sm ${
            l1 && beskrivelse.trim() === "" ? "border-red-400" : "border-gray-300"
          } disabled:bg-gray-50`}
        />
      </div>

      {rader47.map((r) => (
        <div key={r.nr} className={rad}>
          <span className={etikett}>
            {r.nr} · {r.etikett}
          </span>
          <div className="min-w-0 flex-1">{l1 ? r.innhold : tom}</div>
        </div>
      ))}

      <div className="pt-2 text-xs" aria-live="polite">
        {lagring === "lagrer" && <span className="text-gray-500">{t("timer.jobbSkjema.lagrer")}</span>}
        {lagring === "lagret" && !ulagret && <span className="text-green-700">{t("timer.jobbSkjema.lagret")}</span>}
        {(lagring === "feil" || (avvik && lagring !== "lagrer")) && (
          <span className="text-red-600" role="alert" data-testid="ikke-lagret">
            {t("timer.jobbSkjema.ikkeLagret")}
            {serverFeil ? ` — ${serverFeil}` : ""}{" "}
            <button type="button" onClick={provIgjen} className="font-medium underline">
              {t("timer.jobbSkjema.provIgjen")}
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
