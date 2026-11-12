import { useMemo, useState, type ReactNode } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useTranslation } from "react-i18next";
import {
  beregnMaskinBrudd,
  overstigerMaskinTak,
  visVareforbrukKnapp,
  hhmmTilMin,
  pauseOverlappMin,
} from "@sitedoc/shared";
import {
  matpauseKontekst,
  matpauseRegelTrigget,
  radKrysserPause,
} from "../../../services/matpause";
import { hentDatabase } from "../../../db/database";
import { useAuth } from "../../../providers/AuthProvider";
import { trpc } from "../../../lib/trpc";
import { finnLonnsartLokalt } from "../../../services/timerKatalog";
import { finnEquipmentLokalt } from "../../../services/maskinKatalog";
import { erReiseRadVisning } from "../../../utils/reiseRad";
import { formatNorskDato } from "../../../utils/dato";
import {
  linjerForProsjekt,
  statusOrd,
  dagsoversiktSum,
  type OversiktTimerRad,
  type OversiktMaskinRad,
  type ProsjektLinjer,
} from "../../../utils/dagsoversikt";
import {
  formatKortTall,
  kortNokkel,
  kortValgFor,
  lagretByggeplassForKort,
  vareByggeplassForKort,
  sendKnappTekst,
  type KortValg,
  type SedelKortKontekst,
} from "../../../lib/prosjektkortMobil";
import { TimerRadModal } from "../TimerSeksjon";
import { MaskinRadModal } from "../MaskinSeksjon";
import { SplittRadModal } from "../SplittRadModal";
import { KortVareforbrukModal } from "../KortVareforbrukModal";
import type { VisVarelinje } from "../VareforbrukLesListe";
import { ProsjektkortKontekst, type KortLaas } from "../prosjektkortKontekst";
import {
  leggTilTimerRad,
  oppdaterTimerRad,
  fjernTimerRad,
  oppdaterMaskinRad,
  fjernMaskinRad,
  type RadKontekst,
} from "./radLagring";
import {
  flyttMaskinRad,
  flyttTimerRad,
  flyttVareLokalt,
  foelgKobletMaskin,
  loftByggeplassArv,
  trengerByggeplassLoft,
  type FlyttMaal,
} from "./kortRadFlytt";
import { KortValgModal } from "./KortValgModal";
import type { Sedel, TimerRad, MaskinRad } from "../../../types/timer-detalj";

/**
 * ORDRE 36b (spec `dagsoversikt-beskrivelse-spec.md` § 2): dagsoversikten i
 * prosjektkort-modus. Erstatter samlesiden på `timer/[id]/prosjektkort` og
 * redigeringen på kortskjermen (`enkeltProsjekt`). Faste linjer pr. prosjekt,
 * bare grått og amber, to skriftstørrelser, ingen ikoner. Linjene åpner de
 * delte rad-modalene; ALL skriving går via `radLagring` (lagring C).
 *
 * Revidert plan RETUR 3: ett kort = (prosjekt, byggeplass, underprosjekt).
 * Prosjektnavnet står én gang, kortene under med «byggeplass · underprosjekt».
 * Rad-modalene åpnes med kortlås (byggeplass og underprosjekt grå); retting
 * går via «Flytt raden» (`kortRadFlytt.ts`). Reise, tillegg og utlegg hører
 * til dagen (`dagSeksjon`), ikke kortene.
 */

type TimerModal = {
  radId: string | null;
  kort: KortValg;
  fokusBeskrivelse: boolean;
};

type Flytt =
  | { radType: "timer"; rad: TimerRad; fra: KortValg }
  | { radType: "maskin"; rad: MaskinRad; fra: KortValg }
  | { radType: "vare"; vare: VisVarelinje; fra: KortValg };

type KortBlokk = { valg: KortValg; linjer: ProsjektLinjer<VisVarelinje> };

/** Effektiv byggeplass i kortlåsen — modalen viser kortets byggeplass. */
const laasFor = (k: KortValg): KortLaas => ({ byggeplassId: k.byggeplassId, ecoId: k.ecoId });

type Splitt =
  | { radType: "timer"; original: TimerRad }
  | { radType: "maskin"; original: MaskinRad };

export function ProsjektkortDagsoversikt({
  sheetId,
  sedel,
  sedelKontekst,
  kort,
  timerRader,
  maskinRader,
  varer,
  reiseLonnsartId,
  harEquipmentCache,
  varelagerProsjekter,
  normTimer,
  ramme,
  rammeByggeplassNavn,
  prosjektNavn,
  byggeplassNavn,
  ecoNavn,
  dagSeksjon,
  redigerbar,
  enkeltProsjekt = false,
  onAapneKort,
  onNyttKort,
  onEndreRamme,
  onEndreByggeplass,
  onSend,
  onPauseToggle,
  onEndret,
  onVarerLagret,
}: {
  sheetId: string;
  sedel: Sedel;
  sedelKontekst: SedelKortKontekst;
  /** Kortene i visningsrekkefølge (`kortNokler`). */
  kort: KortValg[];
  /** Alle dagens rader (overlapp og matpause gjelder hele dagen). */
  timerRader: TimerRad[];
  maskinRader: MaskinRad[];
  varer: VisVarelinje[];
  reiseLonnsartId: string | null;
  harEquipmentCache: boolean;
  varelagerProsjekter: string[];
  normTimer: number | null;
  ramme: { fra: string; til: string; pauseMin: number };
  rammeByggeplassNavn: string | null;
  prosjektNavn: (projectId: string) => string;
  byggeplassNavn: (byggeplassId: string) => string | null;
  ecoNavn: (ecoId: string) => string;
  /** Dagens reise, tillegg og utlegg — under kortene, over sum og Send. */
  dagSeksjon?: ReactNode;
  redigerbar: boolean;
  /** Kortskjermen: ett kort, uten sum-kort, Send og «+ Nytt prosjektkort». */
  enkeltProsjekt?: boolean;
  onAapneKort?: (kort: KortValg) => void;
  onNyttKort?: () => void;
  onEndreRamme?: () => void;
  onEndreByggeplass?: () => void;
  onSend?: () => void;
  /** 36b: kortskjermens matpause-flytt (dag-nivå); avhukingen vises i rad-modalen. */
  onPauseToggle?: (radId: string, vilHa: boolean) => void;
  onEndret: () => void;
  onVarerLagret: () => void;
}) {
  const { t } = useTranslation();
  const { bruker } = useAuth();
  const k: RadKontekst = { sheetId, organizationId: sedel.organizationId };

  const [timerModal, setTimerModal] = useState<TimerModal | null>(null);
  const [maskinModal, setMaskinModal] = useState<MaskinRad | null>(null);
  const [splitt, setSplitt] = useState<Splitt | null>(null);
  const [vareKort, setVareKort] = useState<KortValg | null>(null);
  const [vareValgt, setVareValgt] = useState<{ vare: VisVarelinje; kort: KortValg } | null>(null);
  const [flytt, setFlytt] = useState<Flytt | null>(null);
  const [flyttFeil, setFlyttFeil] = useState<string | null>(null);
  const oppdaterVare = trpc.vareforbruk.oppdater.useMutation();

  // 36b: matpausen er dag-nivå — samme regel som dagskortets rad-kort.
  const { pauseFra, standardPauseMin } = useMemo(
    () => matpauseKontekst(sedel.organizationId, sedel.dato, timerRader),
    [sedel.organizationId, sedel.dato, timerRader],
  );
  const pauseRegelTrigget = useMemo(
    () => matpauseRegelTrigget(timerRader, standardPauseMin),
    [timerRader, standardPauseMin],
  );
  const matpauseFor = (rad: TimerRad) =>
    onPauseToggle && redigerbar && pauseRegelTrigget && radKrysserPause(rad, pauseFra, standardPauseMin)
      ? {
          avhuket: rad.pauseMin > 0,
          trukketMin:
            rad.fraTid && rad.tilTid
              ? pauseOverlappMin(hhmmTilMin(rad.fraTid), hhmmTilMin(rad.tilTid), hhmmTilMin(pauseFra), rad.pauseMin)
              : 0,
          // Lukker modalen: flyttet skrives med en gang, og en åpen modal ville
          // lagret radens gamle pause-bærer tilbake.
          onToggle: () => {
            setTimerModal(null);
            onPauseToggle(rad.id, !(rad.pauseMin > 0));
          },
        }
      : undefined;

  const oversiktTimer = useMemo<OversiktTimerRad[]>(
    () =>
      timerRader.map((r) => ({
        id: r.id,
        projectId: r.projectId ?? sedel.projectId,
        // Lagret verdi: null = arver dagens byggeplass (kortnøkkelen avgjør).
        byggeplassId: r.byggeplassId ?? null,
        externalCostObjectId: r.externalCostObjectId ?? null,
        timer: r.timer,
        fraTid: r.fraTid,
        tilTid: r.tilTid,
        beskrivelse: r.beskrivelse,
        erReise: erReiseRadVisning(r.erReise, r.lonnsartId, reiseLonnsartId),
        overtidsnivaa: finnLonnsartLokalt(r.lonnsartId)?.overtidsnivaa ?? null,
        // Lokale rader bærer ikke attesteringsstatus.
        attestertStatus: null,
      })),
    [timerRader, sedel.projectId, reiseLonnsartId],
  );
  const oversiktMaskin = useMemo<OversiktMaskinRad[]>(
    () =>
      maskinRader.map((r) => ({
        id: r.id,
        projectId: r.projectId ?? sedel.projectId,
        byggeplassId: r.byggeplassId ?? null,
        externalCostObjectId: r.externalCostObjectId ?? null,
        vehicleId: r.vehicleId,
        timer: r.timer,
        attestertStatus: null,
      })),
    [maskinRader, sedel.projectId],
  );
  // Kortene grupperes pr. prosjekt (kortNokler sorterer prosjektene samlet).
  // Reise hører til dagen og telles bare i sum-kortet.
  const grupper = useMemo(() => {
    const arbeidTimer = oversiktTimer.filter((r) => !r.erReise);
    const ut: { projectId: string; blokker: KortBlokk[] }[] = [];
    for (const valg of kort) {
      const linjer = linjerForProsjekt({
        projectId: valg.projectId,
        timer: arbeidTimer,
        maskin: oversiktMaskin,
        varer,
        utlegg: 0,
        harEquipmentCache,
        harVarelager: varelagerProsjekter.includes(valg.projectId),
        kort: { valg, sedel: sedelKontekst },
      });
      const siste = ut[ut.length - 1];
      if (siste?.projectId === valg.projectId) siste.blokker.push({ valg, linjer });
      else ut.push({ projectId: valg.projectId, blokker: [{ valg, linjer }] });
    }
    return ut;
  }, [kort, oversiktTimer, oversiktMaskin, varer, harEquipmentCache, varelagerProsjekter, sedelKontekst]);
  const reiseSum = oversiktTimer.filter((r) => r.erReise).reduce((a, r) => a + r.timer, 0);
  const sum = {
    ...dagsoversiktSum(grupper.flatMap((g) => g.blokker.map((b) => b.linjer))),
    reise: reiseSum,
  };
  const status = statusOrd(sedel.status);

  const timerRad = (id: string | null) => (id ? timerRader.find((r) => r.id === id) ?? null : null);
  const maskinNavn = (vehicleId: string) => {
    const e = finnEquipmentLokalt(vehicleId);
    if (!e) return vehicleId;
    return `${e.merke ?? ""} ${e.modell ?? ""}`.trim() || e.internNavn || vehicleId;
  };
  const tid = (r: { fraTid: string | null; tilTid: string | null }) =>
    r.fraTid && r.tilTid ? `${r.fraTid}–${r.tilTid} · ` : "";
  const t2 = (n: number) => `${formatKortTall(n)} ${t("timer.tEnhet")}`;

  const aapneTimer = (kortValg: KortValg, radId: string | null, fokusBeskrivelse = false) => {
    if (!redigerbar) return;
    setTimerModal({ radId, kort: kortValg, fokusBeskrivelse });
  };
  const kortForRad = (r: {
    projectId: string | null;
    byggeplassId?: string | null;
    externalCostObjectId?: string | null;
  }) =>
    kortValgFor(
      {
        projectId: r.projectId ?? sedel.projectId,
        byggeplassId: r.byggeplassId ?? null,
        externalCostObjectId: r.externalCostObjectId ?? null,
      },
      sedelKontekst,
    );
  const startFlytt = (f: Flytt) => {
    setFlyttFeil(null);
    setFlytt(f);
  };

  const db = () => hentDatabase()!;
  const redigert = timerRad(timerModal?.radId ?? null);

  // RETUR 36c-2 P1 (a2): «Uten byggeplass» på en sedel med byggeplass —
  // løft arven ut før lagring, så NULL på raden betyr ekte «uten».
  const loftArvVedBehov = (kort: KortValg) => {
    if (trengerByggeplassLoft(kort, sedelKontekst)) loftByggeplassArv(db(), sheetId, sedelKontekst);
  };

  const utforFlytt = async (til: KortValg) => {
    if (!flytt) return;
    loftArvVedBehov(til);
    const maal: FlyttMaal = {
      projectId: til.projectId,
      byggeplassId: lagretByggeplassForKort(til, sedelKontekst),
      ecoId: til.ecoId,
    };
    if (flytt.radType === "timer") {
      flyttTimerRad(db(), k, flytt.rad, maal);
    } else if (flytt.radType === "maskin") {
      // Samme bøtte-regel (prosjekt, underprosjekt) som ved ny rad og på server.
      const brudd = beregnMaskinBrudd(
        timerRader.map((r) => ({
          projectId: r.projectId ?? sedel.projectId,
          externalCostObjectId: r.externalCostObjectId ?? null,
          timer: r.timer,
        })),
        maskinRader.map((m) =>
          m.id === flytt.rad.id
            ? { projectId: til.projectId, externalCostObjectId: til.ecoId, timer: m.timer }
            : {
                projectId: m.projectId ?? sedel.projectId,
                externalCostObjectId: m.externalCostObjectId ?? null,
                timer: m.timer,
              },
        ),
        sedel.pauseMin,
      );
      if (brudd.some((b) => b.projectId === til.projectId && (b.externalCostObjectId ?? null) === til.ecoId)) {
        setFlyttFeil(t("timer.maskin.overstigerArbeid"));
        return;
      }
      flyttMaskinRad(db(), flytt.rad.id, maal);
    } else {
      const v = flytt.vare;
      // Varer har ingen sedel-arv: kortets effektive byggeplass lagres (RETUR 4).
      const vareMaal: FlyttMaal = { ...maal, byggeplassId: vareByggeplassForKort(til) };
      // Linjen finnes på server: flytt der først (vaktene sjekker prosjekt og firma).
      if (v.syncStatus !== "pending" && v.syncStatus !== "avvist") {
        try {
          await oppdaterVare.mutateAsync({
            id: v.id,
            projectId: til.projectId,
            byggeplassId: vareMaal.byggeplassId,
            externalCostObjectId: til.ecoId,
          });
        } catch (e) {
          const melding = e instanceof Error ? e.message : String(e);
          setFlyttFeil(t(melding, { defaultValue: melding }));
          return;
        }
      }
      flyttVareLokalt(db(), v.id, vareMaal);
      setFlytt(null);
      onVarerLagret();
      return;
    }
    setFlytt(null);
    onEndret();
  };

  // Kalles som funksjon (ikke komponent) så radene ikke remountes ved hver render.
  function kortBlokk({ valg, linjer }: KortBlokk, visHode: boolean) {
    const projectId = valg.projectId;
    const kanForeVare = visVareforbrukKnapp({
      prosjektIderMedVarelager: varelagerProsjekter,
      projectId,
      erRedigerbar: redigerbar,
    });
    const maskinOverTak =
      linjer.summer.maskin > 0 &&
      overstigerMaskinTak(linjer.summer.maskin, linjer.summer.arbeid, sedel.pauseMin);

    const hode = [
      valg.byggeplassId
        ? byggeplassNavn(valg.byggeplassId) ?? t("timer.byggeplass.ingenValgt")
        : t("timer.kortValg.utenByggeplass"),
      valg.ecoId ? ecoNavn(valg.ecoId) : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <View key={kortNokkel(valg)}>
        {visHode && (
          <Pressable
            onPress={() => onAapneKort?.(valg)}
            className="min-h-[44px] justify-center border-t border-gray-100 active:bg-gray-50"
          >
            <Text className="text-sm font-semibold text-gray-700">{hode}</Text>
          </Pressable>
        )}

        <Linje etikett={t("timer.prosjektkort.kolonne.arbeid")}>
          {linjer.arbeid.length === 0 ? (
            <Tom
              onPress={() => aapneTimer(valg, null)}
              leggTil={redigerbar ? t("timer.prosjektkort.leggTilArbeid") : undefined}
            />
          ) : (
            linjer.arbeid.map((r) => (
              <Verdi key={r.id} onPress={() => aapneTimer(valg, r.id)}>
                {tid(r)}
                {t2(r.timer)}
              </Verdi>
            ))
          )}
          {/* Kenneth 2026-11-12: overtidsrader rendres som alle andre rader
              (fra–til · timer), med overtidsnivået til slutt. */}
          {linjer.overtid.map((r) => (
            <Verdi key={r.id} gra onPress={() => aapneTimer(valg, r.id)}>
              {tid(r)}
              {t2(r.timer)}
              {" · "}
              {t("timer.dagsoversikt.overtid", { prosent: r.overtidsnivaa })}
            </Verdi>
          ))}
        </Linje>

        {linjer.visMaskin && (
          <Linje etikett={t("timer.prosjektkort.kolonne.maskin")}>
            {linjer.maskin.length === 0 ? (
              // Tom maskin: ny timer-rad med maskinseksjonen (P1).
              <Tom
                onPress={() => aapneTimer(valg, null)}
                leggTil={redigerbar ? t("timer.prosjektkort.leggTilMaskin") : undefined}
              />
            ) : (
              linjer.maskin.map((r) => (
                <Verdi
                  key={r.id}
                  onPress={() => {
                    if (!redigerbar) return;
                    setMaskinModal(maskinRader.find((m) => m.id === r.id) ?? null);
                  }}
                >
                  {maskinNavn(r.vehicleId)} · {t2(r.timer)}
                </Verdi>
              ))
            )}
            {maskinOverTak && (
              <Text className="text-sm text-amber-700">
                {t("timer.gruppe.maskinAvArbeid", {
                  maskin: formatKortTall(linjer.summer.maskin),
                  arbeid: formatKortTall(linjer.summer.arbeid),
                })}
              </Text>
            )}
          </Linje>
        )}

        {linjer.visVarer && (
          <Linje etikett={t("timer.prosjektkort.kolonne.varer")}>
            {linjer.varer.length === 0 ? (
              <Tom onPress={() => kanForeVare && setVareKort(valg)} />
            ) : (
              linjer.varer.map((v) => (
                <View key={v.id}>
                  <Verdi onPress={() => kanForeVare && setVareValgt({ vare: v, kort: valg })}>
                    {v.vare.navn} {formatKortTall(v.antall).replace(/,0$/, "")} {v.vare.enhet}
                    {v.syncStatus === "pending" ? ` · ${t("timer.sync.venter")}` : ""}
                  </Verdi>
                  {/* Som VareforbrukLesListe: avvist linje viser serverens grunn. */}
                  {v.syncStatus === "avvist" && v.feilmelding && (
                    <Text className="text-sm text-amber-700">
                      {t(v.feilmelding, { defaultValue: v.feilmelding })}
                    </Text>
                  )}
                </View>
              ))
            )}
          </Linje>
        )}

        <Linje
          etikett={t("timer.dagsoversikt.beskrivelse")}
          mangler={linjer.mangler}
        >
          <Pressable
            onPress={() => aapneTimer(valg, linjer.forsteArbeidsradId, true)}
            className="min-h-[44px] justify-center active:bg-gray-50"
          >
            {linjer.mangler ? (
              <Text className="text-sm" style={{ color: "#b45309" }}>
                {t("timer.dagsoversikt.mangler")}
              </Text>
            ) : linjer.beskrivelser.length > 0 ? (
              <Text className="text-sm text-gray-900">{linjer.beskrivelser.join(" · ")}</Text>
            ) : (
              <Text className="text-sm text-gray-400">–</Text>
            )}
          </Pressable>
        </Linje>
      </View>
    );
  }

  function prosjektGruppe(projectId: string, blokker: KortBlokk[]) {
    const visHode =
      !enkeltProsjekt &&
      (blokker.length > 1 || blokker.some((b) => b.valg.byggeplassId !== null || b.valg.ecoId !== null));
    return (
      <View key={projectId} className="mx-4 mt-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        {!enkeltProsjekt && (
          <Pressable
            onPress={() => blokker[0] && onAapneKort?.(blokker[0].valg)}
            className="min-h-[44px] justify-center active:bg-gray-50"
          >
            <Text className="text-base font-semibold text-gray-900">{prosjektNavn(projectId)}</Text>
          </Pressable>
        )}
        {blokker.map((b) => kortBlokk(b, visHode))}
      </View>
    );
  }

  const sendTekst = sendKnappTekst(sedel.status, sum.arbeid);

  return (
    <ProsjektkortKontekst.Provider value={true}>
      {grupper.length === 0 && !enkeltProsjekt && (
        <Text className="mx-4 mt-4 text-sm text-gray-500">{t("timer.prosjektkort.ingenKort")}</Text>
      )}
      {grupper.map((g) => prosjektGruppe(g.projectId, g.blokker))}

      {redigerbar && enkeltProsjekt && kort[0] && (
        <Pressable
          onPress={() => aapneTimer(kort[0]!, null)}
          className="mx-4 mt-2 min-h-[44px] justify-center active:bg-gray-50"
        >
          <Text className="text-sm text-gray-700">{t("timer.prosjektkort.nyTimer")}</Text>
        </Pressable>
      )}

      {!enkeltProsjekt && (
        <>
          {redigerbar && (
            <Pressable onPress={onNyttKort} className="mx-4 mt-2 min-h-[44px] justify-center active:bg-gray-50">
              <Text className="text-sm text-gray-700">{t("timer.prosjektkort.nyttKort")}</Text>
            </Pressable>
          )}

          {dagSeksjon}

          <View className="mx-4 mt-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-sm text-gray-500">{t("timer.dagsoversikt.sumIDag")}</Text>
              <Text className="text-base font-semibold text-gray-900" style={{ fontVariant: ["tabular-nums"] }}>
                {t2(sum.arbeid)}
              </Text>
            </View>
            {(sum.maskin != null && sum.maskin > 0) || sum.reise > 0 ? (
              <Text className="text-sm text-gray-500" style={{ fontVariant: ["tabular-nums"] }}>
                {[
                  sum.maskin != null && sum.maskin > 0
                    ? t("timer.prosjektkort.sumMaskin", { timer: formatKortTall(sum.maskin) })
                    : null,
                  sum.reise > 0 ? t("timer.prosjektkort.sumReise", { timer: formatKortTall(sum.reise) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
            <Pressable
              onPress={() => redigerbar && onEndreRamme?.()}
              className="min-h-[44px] justify-center active:bg-gray-50"
            >
              <Text className="text-sm text-gray-500" style={{ fontVariant: ["tabular-nums"] }}>
                {t("timer.dagsoversikt.normRamme", {
                  norm: normTimer != null ? formatKortTall(normTimer) : "–",
                  fra: ramme.fra,
                  til: ramme.til,
                  pause: ramme.pauseMin,
                })}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => redigerbar && onEndreByggeplass?.()}
              className="min-h-[44px] justify-center active:bg-gray-50"
            >
              <Text className="text-sm text-gray-500">
                {rammeByggeplassNavn ?? t("timer.byggeplass.ingenValgt")}
              </Text>
            </Pressable>
            <Text className={`py-2 text-sm ${status.amber ? "text-amber-700" : "text-gray-500"}`}>
              {status.amber ? "● " : ""}
              {t(status.nokkel, {
                dato: sedel.attestertVed ? formatNorskDato(sedel.attestertVed) : "",
              })}
            </Text>
            {redigerbar && (
              <Pressable
                onPress={onSend}
                className="mt-2 min-h-[44px] items-center justify-center rounded-lg bg-gray-900 active:bg-gray-700"
              >
                <Text className="text-base font-semibold text-white">
                  {sendTekst.nokkel === "timer.prosjektkort.sendDagen"
                    ? t(sendTekst.nokkel, { timer: formatKortTall(sendTekst.timer) })
                    : t(sendTekst.nokkel)}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      {timerModal && (
        <ProsjektkortKontekst.Provider value={laasFor(timerModal.kort)}>
        <TimerRadModal
          sheetId={sheetId}
          organizationId={sedel.organizationId}
          defaultProjectId={timerModal.kort.projectId}
          defaultEcoId={timerModal.kort.ecoId}
          dato={sedel.dato}
          sheetPauseMin={sedel.pauseMin}
          harEquipmentCache={harEquipmentCache}
          eksisterendeRader={timerRader.filter(
            (r) => (r.projectId ?? sedel.projectId) === timerModal.kort.projectId,
          )}
          alleTimerRader={timerRader}
          defaultAktivitetId={sedel.aktivitetId ?? null}
          eksisterendeRad={redigert}
          tvungetValg={null}
          sedelByggeplassId={sedel.byggeplassId ?? null}
          fokusBeskrivelse={timerModal.fokusBeskrivelse}
          // V21 (Kenneth 2026-11-12): overtidsforslaget krever begge — samme
          // som dagskortets TimerSeksjon. Normal-delen lagres via onLagre,
          // overtid-delen som ny rad på samme kort (ingen koblet maskin).
          dagsnormTimer={normTimer}
          onLeggTilOvertidDel={(
            projectId,
            _byggeplassId,
            lonnsartId,
            aktivitetId,
            timer,
            externalCostObjectId,
            fraTid,
            tilTid,
            beskrivelse,
            pauseMin,
          ) => {
            leggTilTimerRad(
              db(),
              k,
              {
                projectId,
                byggeplassId: lagretByggeplassForKort(timerModal.kort, sedelKontekst),
                lonnsartId,
                aktivitetId,
                timer,
                externalCostObjectId,
                fraTid,
                tilTid,
                beskrivelse,
                pauseMin,
              },
              null,
            );
            onEndret();
          }}
          handlinger={
            redigert
              ? {
                  onFlytt: () => {
                    setTimerModal(null);
                    startFlytt({ radType: "timer", rad: redigert, fra: timerModal.kort });
                  },
                  onDelOpp: () => {
                    setTimerModal(null);
                    setSplitt({ radType: "timer", original: redigert });
                  },
                  onSlett: () => {
                    fjernTimerRad(db(), k, redigert.id);
                    setTimerModal(null);
                    onEndret();
                  },
                  matpause: matpauseFor(redigert),
                }
              : undefined
          }
          onLagre={(
            projectId,
            _byggeplassId,
            lonnsartId,
            aktivitetId,
            timer,
            externalCostObjectId,
            fraTid,
            tilTid,
            beskrivelse,
            pauseMin,
            maskin,
          ) => {
            loftArvVedBehov(timerModal.kort);
            const felt = {
              projectId,
              // Kortlåsen gir effektiv byggeplass; lagres som null når den arves.
              byggeplassId: lagretByggeplassForKort(timerModal.kort, sedelKontekst),
              lonnsartId,
              aktivitetId,
              timer,
              externalCostObjectId,
              fraTid,
              tilTid,
              beskrivelse,
              pauseMin,
            };
            const radId = redigert
              ? (oppdaterTimerRad(db(), k, redigert.id, felt, maskin), redigert.id)
              : leggTilTimerRad(db(), k, felt, maskin);
            // Koblet maskin følger raden også på byggeplass (GO punkt 5).
            foelgKobletMaskin(db(), radId);
            setTimerModal(null);
            onEndret();
          }}
          onLukk={() => setTimerModal(null)}
        />
        </ProsjektkortKontekst.Provider>
      )}

      {maskinModal && (
        <ProsjektkortKontekst.Provider value={laasFor(kortForRad(maskinModal))}>
        <MaskinRadModal
          sheetId={sheetId}
          organizationId={sedel.organizationId}
          defaultProjectId={maskinModal.projectId ?? sedel.projectId}
          defaultEcoId={maskinModal.externalCostObjectId ?? null}
          dato={sedel.dato}
          pauseMin={sedel.pauseMin}
          eksisterendeRad={maskinModal}
          handlinger={{
            onFlytt: () => {
              setMaskinModal(null);
              startFlytt({ radType: "maskin", rad: maskinModal, fra: kortForRad(maskinModal) });
            },
            onDelOpp: () => {
              setMaskinModal(null);
              setSplitt({ radType: "maskin", original: maskinModal });
            },
            onSlett: () => {
              fjernMaskinRad(db(), k, maskinModal.id);
              setMaskinModal(null);
              onEndret();
            },
          }}
          onLagre={(projectId, ecoId, vehicleId, timer, mengde, enhet, fraTid, tilTid) => {
            oppdaterMaskinRad(db(), k, maskinModal.id, {
              projectId,
              ecoId,
              vehicleId,
              timer,
              mengde,
              enhet,
              fraTid,
              tilTid,
            });
            setMaskinModal(null);
            onEndret();
          }}
          onLukk={() => setMaskinModal(null)}
        />
        </ProsjektkortKontekst.Provider>
      )}

      {splitt && (
        <SplittRadModal
          {...splitt}
          organizationId={sedel.organizationId}
          onLagret={() => {
            setSplitt(null);
            onEndret();
          }}
          onLukk={() => setSplitt(null)}
        />
      )}

      {bruker?.id && vareKort && (
        <KortVareforbrukModal
          synlig
          userId={bruker.id}
          organizationId={sedel.organizationId}
          sheetId={sheetId}
          projectId={vareKort.projectId}
          prosjektNavn={prosjektNavn(vareKort.projectId)}
          dato={sedel.dato}
          sedelByggeplassId={sedel.byggeplassId ?? null}
          kortLaas={{ byggeplassId: vareByggeplassForKort(vareKort), ecoId: vareKort.ecoId }}
          onAvbryt={() => setVareKort(null)}
          onLagret={() => {
            setVareKort(null);
            onVarerLagret();
          }}
        />
      )}

      {/* Varelinje: ny vare (som før) eller «Flytt raden» (§ 5b). */}
      {vareValgt && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setVareValgt(null)}>
          <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setVareValgt(null)}>
            <Pressable className="rounded-t-2xl bg-white px-4 pb-8 pt-4" onPress={() => {}}>
              <Text className="mb-2 text-base font-semibold text-gray-900">
                {vareValgt.vare.vare.navn} {formatKortTall(vareValgt.vare.antall).replace(/,0$/, "")}{" "}
                {vareValgt.vare.vare.enhet}
              </Text>
              <Pressable
                onPress={() => {
                  const v = vareValgt;
                  setVareValgt(null);
                  startFlytt({ radType: "vare", vare: v.vare, fra: v.kort });
                }}
                className="min-h-[44px] justify-center border-t border-gray-100 active:bg-gray-50"
              >
                <Text className="text-base text-gray-700">{t("timer.dagsoversikt.flyttRad")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const kortValg = vareValgt.kort;
                  setVareValgt(null);
                  setVareKort(kortValg);
                }}
                className="min-h-[44px] justify-center border-t border-gray-100 active:bg-gray-50"
              >
                <Text className="text-base text-gray-700">{t("timer.prosjektkort.nyVare")}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {flytt && (
        <KortValgModal
          organizationId={sedel.organizationId}
          modus={{ type: "flytt", fra: flytt.fra }}
          sedel={sedelKontekst}
          prosjektNavn={prosjektNavn}
          feil={flyttFeil}
          onVelg={(til) => void utforFlytt(til)}
          onLukk={() => setFlytt(null)}
        />
      )}
    </ProsjektkortKontekst.Provider>
  );
}

function Linje({
  etikett,
  mangler = false,
  children,
}: {
  etikett: string;
  mangler?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      className="flex-row border-t border-gray-100"
      style={mangler ? { borderLeftWidth: 3, borderLeftColor: "#f59e0b", paddingLeft: 6 } : undefined}
    >
      <Text className="w-[72px] py-3 text-sm text-gray-500">{etikett}</Text>
      <View className="flex-1 justify-center">{children}</View>
    </View>
  );
}

function Verdi({ onPress, gra = false, children }: { onPress: () => void; gra?: boolean; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} className="min-h-[44px] justify-center active:bg-gray-50">
      <Text className={`text-sm ${gra ? "text-gray-500" : "text-gray-900"}`} style={{ fontVariant: ["tabular-nums"] }}>
        {children}
      </Text>
    </Pressable>
  );
}

/**
 * Tom celle. RETUR 36c-2 (D2): `leggTil` gir en tydelig «+ Legg til …» der
 * trykket oppretter en ny rad — «–» ble lest som en rad som kunne redigeres.
 */
function Tom({ onPress, leggTil }: { onPress: () => void; leggTil?: string }) {
  return (
    <Pressable onPress={onPress} className="min-h-[44px] justify-center active:bg-gray-50">
      {leggTil ? (
        <Text className="text-sm font-medium text-gray-700">{leggTil}</Text>
      ) : (
        <Text className="text-sm text-gray-400">–</Text>
      )}
    </Pressable>
  );
}
