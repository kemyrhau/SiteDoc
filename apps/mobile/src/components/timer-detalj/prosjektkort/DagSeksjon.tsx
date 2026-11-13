import { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { hentDatabase } from "../../../db/database";
import { erReiseRadVisning } from "../../../utils/reiseRad";
import { formatKortTall } from "../../../lib/prosjektkortMobil";
import { TimerRadModal } from "../TimerSeksjon";
import { SplittRadModal } from "../SplittRadModal";
import { leggTilTimerRad, oppdaterTimerRad, fjernTimerRad, type RadKontekst } from "./radLagring";
import type { Sedel, TimerRad } from "../../../types/timer-detalj";

/**
 * ORDRE 36b (revidert plan § 2): reise hører til dagen, ikke kortene.
 * Seksjonen ligger under kortene og over sum/Send. Tillegg og utlegg føres
 * på prosjektkortet (spec tillegg-utlegg-prosjektkort § 3) — ikke her.
 *
 * Prosjekt: forslaget er prosjektet med flest arbeidstimer i dag (ellers
 * dagens prosjekt). Reise velger bare prosjekt; byggeplass/underprosjekt
 * vises i modalen kun når prosjektet har flere (K3).
 */
export function DagSeksjon({
  sheetId,
  sedel,
  timerRader,
  reiseLonnsartId,
  prosjektNavn,
  harEquipmentCache,
  redigerbar,
  onEndret,
}: {
  sheetId: string;
  sedel: Sedel;
  timerRader: TimerRad[];
  reiseLonnsartId: string | null;
  prosjektNavn: (projectId: string) => string;
  harEquipmentCache: boolean;
  redigerbar: boolean;
  onEndret: () => void;
}) {
  const { t } = useTranslation();
  const enhet = t("timer.timerEnhet");
  const k: RadKontekst = { sheetId, organizationId: sedel.organizationId };
  const [reiseModal, setReiseModal] = useState<{ rad: TimerRad | null } | null>(null);
  const [splitt, setSplitt] = useState<TimerRad | null>(null);

  const erReise = (r: TimerRad) => erReiseRadVisning(r.erReise, r.lonnsartId, reiseLonnsartId);
  const reiseRader = timerRader.filter(erReise);

  const forslagProsjekt = useMemo(() => {
    const sum = new Map<string, number>();
    for (const r of timerRader) {
      if (erReiseRadVisning(r.erReise, r.lonnsartId, reiseLonnsartId)) continue;
      const pid = r.projectId ?? sedel.projectId;
      sum.set(pid, (sum.get(pid) ?? 0) + (r.timer ?? 0));
    }
    let best = sedel.projectId;
    let bestTimer = -1;
    for (const [pid, timer] of sum) {
      if (timer > bestTimer) {
        best = pid;
        bestTimer = timer;
      }
    }
    return best;
  }, [timerRader, reiseLonnsartId, sedel.projectId]);

  const db = () => hentDatabase()!;

  return (
    <View className="mt-4">
      <Text className="mb-2 px-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
        {t("timer.dagsoversikt.dagen")}
      </Text>

      {/* Reise */}
      <View className="mx-4 rounded-lg border border-gray-200 bg-white">
        {reiseRader.map((r) => (
          <Pressable
            key={r.id}
            disabled={!redigerbar}
            onPress={() => setReiseModal({ rad: r })}
            className="min-h-[44px] flex-row items-center gap-3 border-b border-gray-100 px-4 py-2 active:bg-gray-50"
          >
            <Text className="w-16 text-sm text-gray-500">
              {t("timer.prosjektkort.kolonne.reise")}
            </Text>
            <Text className="text-sm text-gray-900">
              {formatKortTall(r.timer ?? 0)} {enhet}
            </Text>
            <Text className="flex-1 text-right text-sm text-gray-500" numberOfLines={1}>
              {prosjektNavn(r.projectId ?? sedel.projectId)}
            </Text>
          </Pressable>
        ))}
        {redigerbar && (
          <Pressable
            onPress={() => setReiseModal({ rad: null })}
            className="min-h-[44px] justify-center px-4 active:bg-gray-50"
          >
            <Text className="text-sm font-medium text-gray-700">
              + {t("timer.prosjektkort.kolonne.reise")}
            </Text>
          </Pressable>
        )}
      </View>

      {reiseModal && (
        <TimerRadModal
          sheetId={sheetId}
          organizationId={sedel.organizationId}
          defaultProjectId={forslagProsjekt}
          defaultEcoId={null}
          dato={sedel.dato}
          sheetPauseMin={sedel.pauseMin}
          harEquipmentCache={harEquipmentCache}
          eksisterendeRader={reiseRader}
          alleTimerRader={timerRader}
          defaultAktivitetId={sedel.aktivitetId ?? null}
          eksisterendeRad={reiseModal.rad}
          tvungetValg={null}
          sedelByggeplassId={sedel.byggeplassId ?? null}
          reise={{ lonnsartId: reiseLonnsartId }}
          handlinger={
            reiseModal.rad
              ? {
                  onDelOpp: () => {
                    setSplitt(reiseModal.rad);
                    setReiseModal(null);
                  },
                  onSlett: () => {
                    fjernTimerRad(db(), k, reiseModal.rad!.id);
                    setReiseModal(null);
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
            if (reiseModal.rad) oppdaterTimerRad(db(), k, reiseModal.rad.id, felt, maskin);
            else leggTilTimerRad(db(), k, felt, maskin.linjer);
            setReiseModal(null);
            onEndret();
          }}
          onLukk={() => setReiseModal(null)}
        />
      )}

      {splitt && (
        <SplittRadModal
          radType="timer"
          original={splitt}
          organizationId={sedel.organizationId}
          onLagret={() => {
            setSplitt(null);
            onEndret();
          }}
          onLukk={() => setSplitt(null)}
        />
      )}
    </View>
  );
}
