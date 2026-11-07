import { useMemo, useState, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { overstigerMaskinTak, visVareforbrukKnapp } from "@sitedoc/shared";
import { hentDatabase } from "../../../db/database";
import { useAuth } from "../../../providers/AuthProvider";
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
import { formatKortTall, sendKnappTekst } from "../../../lib/prosjektkortMobil";
import { TimerRadModal, ProsjektByggeplassVelgerModal } from "../TimerSeksjon";
import { MaskinRadModal } from "../MaskinSeksjon";
import { SplittRadModal } from "../SplittRadModal";
import { KortVareforbrukModal } from "../KortVareforbrukModal";
import type { VisVarelinje } from "../VareforbrukLesListe";
import { ProsjektkortKontekst } from "../prosjektkortKontekst";
import {
  leggTilTimerRad,
  oppdaterTimerRad,
  hurtigVelgTimerRad,
  fjernTimerRad,
  oppdaterMaskinRad,
  fjernMaskinRad,
  type RadKontekst,
} from "./radLagring";
import type { Sedel, TimerRad, MaskinRad } from "../../../types/timer-detalj";

/**
 * ORDRE 36b (spec `dagsoversikt-beskrivelse-spec.md` § 2): dagsoversikten i
 * prosjektkort-modus. Erstatter samlesiden på `timer/[id]/prosjektkort` og
 * redigeringen på kortskjermen (`enkeltProsjekt`). Faste linjer pr. prosjekt,
 * bare grått og amber, to skriftstørrelser, ingen ikoner. Linjene åpner de
 * delte rad-modalene; ALL skriving går via `radLagring` (lagring C).
 */

type TimerModal = {
  radId: string | null;
  projectId: string;
  fokusBeskrivelse: boolean;
  tvungetValg: { projectId: string; byggeplassId: string | null } | null;
};

type Splitt =
  | { radType: "timer"; original: TimerRad }
  | { radType: "maskin"; original: MaskinRad };

export function ProsjektkortDagsoversikt({
  sheetId,
  sedel,
  prosjektIder,
  timerRader,
  maskinRader,
  varer,
  utleggAntall,
  reiseLonnsartId,
  harEquipmentCache,
  varelagerProsjekter,
  normTimer,
  ramme,
  rammeByggeplassNavn,
  prosjektNavn,
  byggeplassNavn,
  redigerbar,
  enkeltProsjekt = false,
  onAapneKort,
  onNyttKort,
  onEndreRamme,
  onEndreByggeplass,
  onSend,
  onEndret,
  onVarerLagret,
}: {
  sheetId: string;
  sedel: Sedel;
  prosjektIder: string[];
  /** Alle dagens rader (overlapp og matpause gjelder hele dagen). */
  timerRader: TimerRad[];
  maskinRader: MaskinRad[];
  varer: VisVarelinje[];
  utleggAntall: Map<string, number>;
  reiseLonnsartId: string | null;
  harEquipmentCache: boolean;
  varelagerProsjekter: string[];
  normTimer: number | null;
  ramme: { fra: string; til: string; pauseMin: number };
  rammeByggeplassNavn: string | null;
  prosjektNavn: (projectId: string) => string;
  byggeplassNavn: (byggeplassId: string) => string | null;
  redigerbar: boolean;
  /** Kortskjermen: ett prosjekt, uten sum-kort, Send og «+ Nytt prosjektkort». */
  enkeltProsjekt?: boolean;
  onAapneKort?: (projectId: string) => void;
  onNyttKort?: () => void;
  onEndreRamme?: () => void;
  onEndreByggeplass?: () => void;
  onSend?: () => void;
  onEndret: () => void;
  onVarerLagret: () => void;
}) {
  const { t } = useTranslation();
  const { bruker } = useAuth();
  const k: RadKontekst = { sheetId, organizationId: sedel.organizationId };

  const [timerModal, setTimerModal] = useState<TimerModal | null>(null);
  const [maskinModal, setMaskinModal] = useState<MaskinRad | null>(null);
  const [splitt, setSplitt] = useState<Splitt | null>(null);
  const [vareProsjekt, setVareProsjekt] = useState<string | null>(null);
  const [hurtigRadId, setHurtigRadId] = useState<string | null>(null);

  const oversiktTimer = useMemo<OversiktTimerRad[]>(
    () =>
      timerRader.map((r) => ({
        id: r.id,
        projectId: r.projectId ?? sedel.projectId,
        byggeplassId: r.byggeplassId ?? sedel.byggeplassId ?? null,
        timer: r.timer,
        fraTid: r.fraTid,
        tilTid: r.tilTid,
        beskrivelse: r.beskrivelse,
        erReise: erReiseRadVisning(r.erReise, r.lonnsartId, reiseLonnsartId),
        overtidsnivaa: finnLonnsartLokalt(r.lonnsartId)?.overtidsnivaa ?? null,
        // Lokale rader bærer ikke attesteringsstatus.
        attestertStatus: null,
      })),
    [timerRader, sedel.projectId, sedel.byggeplassId, reiseLonnsartId],
  );
  const oversiktMaskin = useMemo<OversiktMaskinRad[]>(
    () =>
      maskinRader.map((r) => ({
        id: r.id,
        projectId: r.projectId ?? sedel.projectId,
        byggeplassId: null,
        vehicleId: r.vehicleId,
        timer: r.timer,
        attestertStatus: null,
      })),
    [maskinRader, sedel.projectId],
  );
  const alle = useMemo(
    () =>
      prosjektIder.map((projectId) => ({
        projectId,
        linjer: linjerForProsjekt({
          projectId,
          timer: oversiktTimer,
          maskin: oversiktMaskin,
          varer,
          utlegg: utleggAntall.get(projectId) ?? 0,
          harEquipmentCache,
          harVarelager: varelagerProsjekter.includes(projectId),
        }),
      })),
    [prosjektIder, oversiktTimer, oversiktMaskin, varer, utleggAntall, harEquipmentCache, varelagerProsjekter],
  );
  const sum = dagsoversiktSum(alle.map((a) => a.linjer));
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

  const aapneTimer = (projectId: string, radId: string | null, fokusBeskrivelse = false) => {
    if (!redigerbar) return;
    setTimerModal({ radId, projectId, fokusBeskrivelse, tvungetValg: null });
  };

  const db = () => hentDatabase()!;
  const redigert = timerRad(timerModal?.radId ?? null);
  const hurtigRad = timerRad(hurtigRadId);

  // Kalles som funksjon (ikke komponent) så radene ikke remountes ved hver render.
  function prosjekt(projectId: string, linjer: ProsjektLinjer<VisVarelinje>) {
    const arbeidsrader = [...linjer.arbeid, ...linjer.overtid];
    const flereByggeplasser = new Set(arbeidsrader.map((r) => r.byggeplassId)).size > 1;
    const kanForeVare = visVareforbrukKnapp({
      prosjektIderMedVarelager: varelagerProsjekter,
      projectId,
      erRedigerbar: redigerbar,
    });
    const maskinOverTak =
      linjer.summer.maskin > 0 &&
      overstigerMaskinTak(linjer.summer.maskin, linjer.summer.arbeid, sedel.pauseMin);

    return (
      <View key={projectId} className="mx-4 mt-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        {!enkeltProsjekt && (
          <Pressable
            onPress={() => onAapneKort?.(projectId)}
            className="min-h-[44px] justify-center active:bg-gray-50"
          >
            <Text className="text-base font-semibold text-gray-900">{prosjektNavn(projectId)}</Text>
          </Pressable>
        )}

        <Linje etikett={t("timer.prosjektkort.kolonne.arbeid")}>
          {linjer.arbeid.length === 0 ? (
            <Tom onPress={() => aapneTimer(projectId, null)} />
          ) : (
            linjer.arbeid.map((r) => (
              <View key={r.id} className="flex-row flex-wrap items-center">
                <Verdi onPress={() => aapneTimer(projectId, r.id)}>
                  {tid(r)}
                  {t2(r.timer)}
                </Verdi>
                {flereByggeplasser && (
                  <Verdi gra onPress={() => redigerbar && setHurtigRadId(r.id)}>
                    {" · "}
                    {(r.byggeplassId && byggeplassNavn(r.byggeplassId)) ||
                      t("timer.byggeplass.ingenValgt")}
                  </Verdi>
                )}
              </View>
            ))
          )}
          {linjer.overtid.map((r) => (
            <Verdi key={r.id} gra onPress={() => aapneTimer(projectId, r.id)}>
              {t("timer.dagsoversikt.overtid", {
                prosent: r.overtidsnivaa,
                fra: r.fraTid ?? "–",
                timer: formatKortTall(r.timer),
              })}
            </Verdi>
          ))}
        </Linje>

        {linjer.reise.length > 0 && (
          <Linje etikett={t("timer.prosjektkort.kolonne.reise")}>
            {linjer.reise.map((r) => (
              <Verdi key={r.id} onPress={() => aapneTimer(projectId, r.id)}>
                {tid(r)}
                {t2(r.timer)}
              </Verdi>
            ))}
          </Linje>
        )}

        {linjer.visMaskin && (
          <Linje etikett={t("timer.prosjektkort.kolonne.maskin")}>
            {linjer.maskin.length === 0 ? (
              // Tom maskin: ny timer-rad med maskinseksjonen (P1).
              <Tom onPress={() => aapneTimer(projectId, null)} />
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
              <Tom onPress={() => kanForeVare && setVareProsjekt(projectId)} />
            ) : (
              linjer.varer.map((v) => (
                <View key={v.id}>
                  <Verdi onPress={() => kanForeVare && setVareProsjekt(projectId)}>
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

        {linjer.utlegg > 0 && (
          <Linje etikett={t("timer.prosjektkort.kolonne.utlegg")}>
            <Verdi onPress={() => !enkeltProsjekt && onAapneKort?.(projectId)}>{String(linjer.utlegg)}</Verdi>
          </Linje>
        )}

        <Linje
          etikett={t("timer.dagsoversikt.beskrivelse")}
          mangler={linjer.mangler}
        >
          <Pressable
            onPress={() => aapneTimer(projectId, linjer.forsteArbeidsradId, true)}
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

  const sendTekst = sendKnappTekst(sedel.status, sum.arbeid);

  return (
    <ProsjektkortKontekst.Provider value={true}>
      {alle.length === 0 && !enkeltProsjekt && (
        <Text className="mx-4 mt-4 text-sm text-gray-500">{t("timer.prosjektkort.ingenKort")}</Text>
      )}
      {alle.map((a) => prosjekt(a.projectId, a.linjer))}

      {redigerbar && enkeltProsjekt && prosjektIder[0] && (
        <Pressable
          onPress={() => aapneTimer(prosjektIder[0], null)}
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
        <TimerRadModal
          sheetId={sheetId}
          organizationId={sedel.organizationId}
          defaultProjectId={timerModal.projectId}
          defaultEcoId={redigert?.externalCostObjectId ?? null}
          dato={sedel.dato}
          sheetPauseMin={sedel.pauseMin}
          harEquipmentCache={harEquipmentCache}
          eksisterendeRader={timerRader.filter(
            (r) => (r.projectId ?? sedel.projectId) === timerModal.projectId,
          )}
          alleTimerRader={timerRader}
          defaultAktivitetId={sedel.aktivitetId ?? null}
          eksisterendeRad={redigert}
          tvungetValg={timerModal.tvungetValg}
          sedelByggeplassId={sedel.byggeplassId ?? null}
          fokusBeskrivelse={timerModal.fokusBeskrivelse}
          handlinger={
            redigert
              ? {
                  onDelOpp: () => {
                    setTimerModal(null);
                    setSplitt({ radType: "timer", original: redigert });
                  },
                  onSlett: () => {
                    fjernTimerRad(db(), k, redigert.id);
                    setTimerModal(null);
                    onEndret();
                  },
                }
              : undefined
          }
          onLagre={(
            projectId,
            byggeplassId,
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
            const felt = {
              projectId,
              byggeplassId,
              lonnsartId,
              aktivitetId,
              timer,
              externalCostObjectId,
              fraTid,
              tilTid,
              beskrivelse,
              pauseMin,
            };
            if (redigert) oppdaterTimerRad(db(), k, redigert.id, felt, maskin);
            else leggTilTimerRad(db(), k, felt, maskin);
            setTimerModal(null);
            onEndret();
          }}
          onLukk={() => setTimerModal(null)}
        />
      )}

      {maskinModal && (
        <MaskinRadModal
          sheetId={sheetId}
          organizationId={sedel.organizationId}
          defaultProjectId={maskinModal.projectId ?? sedel.projectId}
          defaultEcoId={maskinModal.externalCostObjectId ?? null}
          dato={sedel.dato}
          pauseMin={sedel.pauseMin}
          eksisterendeRad={maskinModal}
          handlinger={{
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

      {hurtigRad && (
        <ProsjektByggeplassVelgerModal
          organizationId={sedel.organizationId}
          valgtProjectId={hurtigRad.projectId ?? sedel.projectId}
          valgtByggeplassId={hurtigRad.byggeplassId ?? null}
          sedelByggeplassId={sedel.byggeplassId ?? null}
          onVelg={(nyProjectId, nyByggeplassId) => {
            setHurtigRadId(null);
            const utfall = hurtigVelgTimerRad(
              db(),
              k,
              hurtigRad,
              sedel.projectId,
              nyProjectId,
              nyByggeplassId,
            );
            if (utfall.type === "lagret") onEndret();
            if (utfall.type === "aapneModal") {
              setTimerModal({
                radId: hurtigRad.id,
                projectId: hurtigRad.projectId ?? sedel.projectId,
                fokusBeskrivelse: false,
                tvungetValg: utfall.tvungetValg,
              });
            }
          }}
          onLukk={() => setHurtigRadId(null)}
        />
      )}

      {bruker?.id && vareProsjekt && (
        <KortVareforbrukModal
          synlig
          userId={bruker.id}
          organizationId={sedel.organizationId}
          sheetId={sheetId}
          projectId={vareProsjekt}
          prosjektNavn={prosjektNavn(vareProsjekt)}
          dato={sedel.dato}
          sedelByggeplassId={sedel.byggeplassId ?? null}
          onAvbryt={() => setVareProsjekt(null)}
          onLagret={() => {
            setVareProsjekt(null);
            onVarerLagret();
          }}
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

function Tom({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="min-h-[44px] justify-center active:bg-gray-50">
      <Text className="text-sm text-gray-400">–</Text>
    </Pressable>
  );
}
