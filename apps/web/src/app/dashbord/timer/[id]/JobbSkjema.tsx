"use client";

/**
 * Plan § 8.22 L3a (Bilde 2-jobben, skisse l3-a/b/c): jobben føres rett i kortet.
 * Rad 1–3 (Fra–til/pause, lønnsart, «Hva gjorde du?») lagres når feltet forlates — ingen
 * Lagre-knapp. Tiden går til `dagsseddel.lagreJobbTid`, som regner overtidslinja selv (delt
 * `regnJobbTid`, samme som forhåndsvisningen her). Rad 4–7 er dagens linjer med blyant,
 * vinduer og lenker, levert av siden. Ny jobb (`ny`) finnes bare på skjermen til Til er fylt.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formaterTimer } from "@/lib/tallformat";
import { lesPauseMin, type SkjemaKilde } from "@/lib/jobbSkjema";
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
  onEndreUnderprosjekt,
  rader47,
  onUlagret,
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
  /** Jobbens prosjekt og underprosjekt (navnet slås opp som i korthodet). */
  projectId: string;
  ecoId: string | null;
  organizationId: string | undefined;
  /** Blyanten: dagens vindu for linje 1 (underprosjekt, byggeplass, aktivitet). L3b flytter det i hodet. */
  onEndreUnderprosjekt?: () => void;
  rader47: readonly SkjemaRad47[];
  /** Noe i skjemaet er ikke lagret (ugyldig felt eller feilet lagring). */
  onUlagret: (kortId: string, ulagret: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const utils = trpc.useUtils();
  const lagreTid = trpc.timer.dagsseddel.lagreJobbTid.useMutation();
  const tilfoy = trpc.timer.dagsseddel.tilfoyTimerRad.useMutation();
  const oppdater = trpc.timer.dagsseddel.oppdaterTimerRad.useMutation();
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery(
    { projectId, organizationId },
    { enabled: !!ecoId },
  );
  const eco = ecoId ? (ecoer ?? []).find((e) => e.id === ecoId) : undefined;
  const underprosjektNavn = ecoId ? (eco ? `${eco.proAdmId} ${eco.kortNavn}` : "…") : null;

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

  const provIgjen = () => {
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
    sett(e.target.value);
  };
  const fmt = (n: number) => formaterTimer(n, i18n.language);
  const visTidFeil = (visFeil && !!tidFeil) || tilMangler;
  const etikett = "w-28 shrink-0 text-xs font-medium text-gray-500";
  const rad = "flex flex-wrap items-start gap-2 py-2";
  const tom = <span className="text-sm text-gray-400">—</span>;

  return (
    <div className="divide-y divide-gray-100" data-testid="jobb-skjema">
      {kilde && (
        <div className="pb-2">
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800" data-testid="skjema-kilde">
            {kilde === "firma" ? t("timer.jobbSkjema.kildeFirma") : t("timer.jobbSkjema.kildeForrige")}
          </span>
        </div>
      )}

      <div className={rad}>
        <span className={etikett}>{t("timer.jobbSkjema.underprosjekt")}</span>
        <span className="text-sm text-gray-800">
          {underprosjektNavn ?? t("timer.jobbSkjema.utenUnderprosjekt")}
        </span>
        {onEndreUnderprosjekt && (
          <button
            type="button"
            onClick={onEndreUnderprosjekt}
            className="text-gray-400 hover:text-gray-700"
            aria-label={t("timer.jobbSkjema.endreUnderprosjekt")}
            title={t("timer.jobbSkjema.endreUnderprosjekt")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className={rad}>
        <span className={etikett}>1 · {t("timer.jobbSkjema.fraTil")}</span>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label={t("timer.jobbSkjema.fra")}
              value={fra}
              onChange={endre(setFra)}
              onBlur={lagreTiden}
              placeholder="--:--"
              className={`w-20 ${felt(visFeil && (tidFeil === "format" || tidFeil === "fraForTil") && !tilMangler)}`}
            />
            <span className="text-gray-400">–</span>
            <input
              aria-label={t("timer.jobbSkjema.til")}
              value={til}
              onChange={endre(setTil)}
              onBlur={lagreTiden}
              placeholder="--:--"
              className={`w-20 ${felt(tilMangler || (visFeil && (tidFeil === "format" || tidFeil === "fraForTil")))}`}
            />
            <span className="text-xs text-gray-500">{t("timer.jobbSkjema.pause")}</span>
            <input
              aria-label={t("timer.jobbSkjema.pause")}
              value={pause}
              onChange={endre(setPause)}
              onBlur={lagreTiden}
              inputMode="numeric"
              className={`w-14 ${felt(visFeil && tidFeil === "pause")}`}
            />
            {regnet?.ok && <span className="text-sm text-gray-700">= {fmt(regnet.timer)} t</span>}
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
