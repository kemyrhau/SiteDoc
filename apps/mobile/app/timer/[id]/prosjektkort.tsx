import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Trash2,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Sparkles,
  Split,
  Info,
  X,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { DagskortSammenligning } from "../../../src/components/timer-detalj/DagskortSammenligning";
import { TimerStatusMerkelapp } from "../../../src/components/TimerStatusMerkelapp";
import { DagstotalBanner } from "../../../src/components/DagstotalBanner";
import { RedigerArbeidstidModal } from "../../../src/components/timer-detalj/ArbeidstidSeksjon";
import { ProsjektkortDagsoversikt } from "../../../src/components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt";
import { useProsjektkortSedel } from "../../../src/components/timer-detalj/prosjektkort/useProsjektkortSedel";
import { ProsjektVelgerModal } from "../../../src/components/timer-detalj/ProsjektVelger";
import { ByggeplassVelgerModal } from "../../../src/components/timer-detalj/ByggeplassVelger";
import { formatNorskDato, formatTidspunkt, isoTidspunktTilHHMM } from "../../../src/utils/dato";
import { kanGjenaapneDagsseddel } from "../../../src/utils/gjenaapne-tilgang";

/**
 * ORDRE 35 (I2): prosjektkortets samleside, flyttet ut av `app/timer/[id].tsx`
 * så dagskortet ikke påvirkes av endringer her. `[id].tsx` sender hit (Redirect)
 * når firmaet er i prosjektkort-modus; denne sender tilbake hvis ikke.
 * Datalaget er `useProsjektkortSedel` (kopi av dagskortets glue).
 */
export default function ProsjektkortSkjerm() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; aapnetEksisterende?: string }>();
  const sheetId = params.id ?? "";
  const s = useProsjektkortSedel(sheetId);
  const { sedel } = s;

  const [visLeggTilProsjekt, setVisLeggTilProsjekt] = useState(false);
  const [visByggeplassVelger, setVisByggeplassVelger] = useState(false);
  const [visRammeModal, setVisRammeModal] = useState(false);
  const [visAapnetNotis, setVisAapnetNotis] = useState(
    params.aapnetEksisterende === "1",
  );

  if (!sedel) {
    return (
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color="#1f2937" />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.dagsseddel")}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">{t("timer.ikkeFunnet")}</Text>
        </View>
      </View>
    );
  }

  if (!s.kortModus) {
    return <Redirect href={{ pathname: "/timer/[id]", params: { id: sheetId } }} />;
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#1f2937" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">
            {formatNorskDato(sedel.dato)}
          </Text>
        </View>
        <TimerStatusMerkelapp
          status={sedel.status}
          syncStatus={sedel.syncStatus}
        />
      </View>

      <DagstotalBanner
        userId={sedel.userId}
        dato={sedel.dato}
        ekskluderSheetId={sedel.id}
      />

      {s.normStatus !== "server" && (
        <View className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <Text className="text-xs text-amber-800">
            {s.normStatus === "ukjent"
              ? t("timer.normMarkor.ukjent.banner")
              : t("timer.normMarkor.cachet.banner")}
          </Text>
        </View>
      )}

      <ScrollView className="flex-1" contentContainerClassName="pb-24">
        {s.byggeplassInfo.mismatch && (
          <View className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b45309" />
              <Text className="text-sm font-semibold text-amber-900">
                {t("timer.byggeplassMismatch.tittel")}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-amber-800">
              {t("timer.byggeplassMismatch.tekst", {
                byggeplass: s.byggeplassInfo.mismatch.byggeplass,
                gpsProsjekt: s.byggeplassInfo.mismatch.gpsProsjekt,
                sedelProsjekt: s.byggeplassInfo.mismatch.sedelProsjekt,
              })}
            </Text>
          </View>
        )}

        {visAapnetNotis && (
          <View className="mx-4 mt-4 flex-row items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <Info size={14} color="#6b7280" />
            <Text className="flex-1 text-xs text-gray-600">
              {t("timer.dagFinnes.notis")}
            </Text>
            <Pressable onPress={() => setVisAapnetNotis(false)} hitSlop={8}>
              <X size={14} color="#9ca3af" />
            </Pressable>
          </View>
        )}

        {sedel.status === "returned" && (
          <View className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b45309" />
              <Text className="text-sm font-semibold text-amber-900">
                {t("timer.detalj.returnertTittel")}
              </Text>
            </View>
            {sedel.lederKommentar && (
              <Text className="mt-1 text-sm text-amber-800">
                {sedel.lederKommentar}
              </Text>
            )}
            <Text className="mt-1 text-xs text-amber-700">
              {t("timer.detalj.returnertHjelp")}
            </Text>
          </View>
        )}

        {sedel.status === "accepted" && (
          <View className="mx-4 mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
            <View className="flex-row items-center gap-2">
              <CheckCircle size={16} color="#15803d" />
              <Text className="text-sm font-semibold text-green-900">
                {t("timer.status.attestert")}
              </Text>
            </View>
            {sedel.attestertVed && (
              <Text className="mt-1 text-xs text-green-800">
                {formatTidspunkt(sedel.attestertVed)}
              </Text>
            )}
          </View>
        )}

        {sedel.syncStatus === "avvist" && (
          <View className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b91c1c" />
              <Text className="text-sm font-semibold text-red-900">
                {t("timer.sync.avvist")}
              </Text>
            </View>
            <Text className="mt-1 text-sm text-red-800">
              {sedel.feilmelding ?? t("timer.sync.avvistBeskrivelse")}
            </Text>
          </View>
        )}

        {sedel.syncStatus === "conflict" && (
          <>
            {s.erOverlapp && (
              <View className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <View className="flex-row items-start gap-2">
                  <AlertTriangle size={16} color="#b45309" style={{ marginTop: 1 }} />
                  <Text className="flex-1 text-sm text-amber-900">
                    {t("timer.sammenlign.overlappBanner")}
                  </Text>
                </View>
              </View>
            )}
            <DagskortSammenligning
              resultat={s.sammenligning}
              valg={s.effektivtValg}
              onVelg={(nokkel, side) =>
                s.setValgOverstyr((forrige) => ({ ...forrige, [nokkel]: side }))
              }
              onVelgAlle={s.erOverlapp ? s.håndterVelgAlle : undefined}
              onBekreft={s.håndterBekreft}
              bekrefter={s.bekrefter}
            />
            {s.bekreftFeilTekst && (
              <View className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
                <Text className="text-sm text-red-800">{s.bekreftFeilTekst}</Text>
              </View>
            )}
          </>
        )}

        {sedel.syncStatus === "pending" && (
          <View className="mx-4 mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2">
            <View className="flex-row items-center gap-2">
              <RotateCcw size={14} color="#a16207" />
              <Text className="flex-1 text-sm text-yellow-800">
                {sedel.feilmelding
                  ? t("timer.sync.venterFeil", { feilmelding: sedel.feilmelding })
                  : t("timer.sync.venterEn")}
              </Text>
            </View>
            <Pressable
              onPress={() => void s.triggerSync()}
              className="mt-2 self-start rounded-md border border-yellow-300 bg-white px-3 py-1.5"
              accessibilityRole="button"
            >
              <Text className="text-sm font-medium text-yellow-900">
                {t("timer.sync.proevIgjenNaa")}
              </Text>
            </Pressable>
          </View>
        )}

        {sedel.status === "draft" &&
        sedel.autoGenerert &&
        sedel.sluttTidKilde === "system" ? (
          <View className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b45309" />
              <Text className="text-sm font-semibold text-amber-900">
                {t("timer.glemtDag.tittel")}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-amber-800">
              {t("timer.glemtDag.hjelp", {
                sluttTid: isoTidspunktTilHHMM(sedel.endAt),
                timer: s.totaltimer.toFixed(1),
                antall: s.timerRader.length,
              })}
            </Text>
          </View>
        ) : sedel.status === "draft" && sedel.autoGenerert ? (
          <View className="mx-4 mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <View className="flex-row items-center gap-2">
              <Sparkles size={16} color="#1e40af" />
              <Text className="text-sm font-semibold text-blue-900">
                {t("timer.autoFyll.tittel")}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-blue-700">
              {t("timer.autoFyll.hjelp")}
            </Text>
          </View>
        ) : null}

        {s.ikkeAnsatt && (
          <View className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b91c1c" />
              <Text className="flex-1 text-sm text-red-900">
                {t("timer.ikkeAnsatt", { firma: s.ikkeAnsattFirmanavn })}
              </Text>
            </View>
          </View>
        )}

        {s.manglerStandardLonnsart && s.erRedigerbar && !s.ikkeAnsatt && (
          <View className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b91c1c" />
              <Text className="text-sm font-semibold text-red-900">
                {t("timer.manglerLonnsart.tittel")}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-red-800">
              {t("timer.manglerLonnsart.hjelp")}
            </Text>
          </View>
        )}

        {s.manglerOvertidLonnsart && s.erRedigerbar && !s.ikkeAnsatt && (
          <View className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b45309" />
              <Text className="text-sm font-semibold text-amber-900">
                {t("timer.manglerOvertid.tittel")}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-amber-800">
              {t("timer.manglerOvertid.hjelp")}
            </Text>
          </View>
        )}

        {sedel.deltVedMidnatt && (
          <View className="mx-4 mt-4 flex-row items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
            <Split size={14} color="#4338ca" />
            <Text className="flex-1 text-xs text-indigo-800">
              <Text className="font-semibold">{t("timer.deltMidnatt.tittel")}</Text>
              {" — "}
              {t("timer.deltMidnatt.hjelp")}
            </Text>
          </View>
        )}

        <ProsjektkortDagsoversikt
          sheetId={sheetId}
          sedel={sedel}
          prosjektIder={s.kortIder}
          timerRader={s.timerRader}
          maskinRader={s.maskinRader}
          varer={s.kortVarer}
          utleggAntall={s.utleggAntall}
          reiseLonnsartId={s.reiseLonnsartId}
          harEquipmentCache={s.harEquipmentCache}
          varelagerProsjekter={s.varelagerProsjekter}
          normTimer={s.normTimer}
          ramme={{
            fra: isoTidspunktTilHHMM(sedel.startAt),
            til: isoTidspunktTilHHMM(sedel.endAt),
            pauseMin: sedel.pauseMin ?? 0,
          }}
          rammeByggeplassNavn={s.byggeplassInfo.navn}
          prosjektNavn={s.prosjektNavn}
          byggeplassNavn={s.byggeplassNavn}
          redigerbar={s.erRedigerbar}
          onAapneKort={(pid) => router.push(`/timer/${sheetId}/kort/${pid}`)}
          onNyttKort={() => setVisLeggTilProsjekt(true)}
          onEndreRamme={() => setVisRammeModal(true)}
          onEndreByggeplass={() => setVisByggeplassVelger(true)}
          onSend={s.sendTilAttestering}
          onEndret={s.markerEndretOgLes}
          onVarerLagret={s.markerEndretOgLes}
        />

        {s.feil && (
          <Text className="mx-4 mt-4 text-sm text-red-600">{s.feil}</Text>
        )}

        {/* Send ligger i dagsoversikten; her kun gjenåpne og slett. */}
        <View className="mx-4 mt-6 gap-2">
          {sedel.status === "sent" &&
            (kanGjenaapneDagsseddel(sedel.status, sedel.syncStatus) ? (
              <>
                <Pressable
                  onPress={s.gjenaapne}
                  disabled={s.gjenaapnerPending}
                  className="flex-row items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white py-3 active:bg-blue-50 disabled:opacity-50"
                >
                  <RotateCcw size={16} color="#1e40af" />
                  <Text className="text-base font-medium text-sitedoc-primary">
                    {t("timer.gjenaapne.knapp")}
                  </Text>
                </Pressable>
                <Text className="text-center text-xs text-gray-500">
                  {t("timer.gjenaapne.hjelp")}
                </Text>
              </>
            ) : (
              /* Gjenåpne er sperret i conflict (datatap-ordre 2026-09-30). */
              <>
                <Pressable
                  disabled
                  className="flex-row items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-3 opacity-50"
                >
                  <RotateCcw size={16} color="#9ca3af" />
                  <Text className="text-base font-medium text-gray-400">
                    {t("timer.gjenaapne.knapp")}
                  </Text>
                </Pressable>
                <Text className="text-center text-xs text-gray-500">
                  {t("timer.gjenaapne.sperretKonflikt")}
                </Text>
              </>
            ))}
          {(sedel.status === "draft" || sedel.status === "returned") && (
            <Pressable
              onPress={s.slettSedel}
              className="flex-row items-center justify-center gap-2 rounded-lg border border-red-300 bg-white py-3 active:bg-red-50"
            >
              <Trash2 size={16} color="#dc2626" />
              <Text className="text-base font-medium text-red-600">
                {t("timer.slettDagsseddel")}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {visLeggTilProsjekt && (
        <ProsjektVelgerModal
          organizationId={sedel.organizationId}
          valgtId={null}
          ekskluderIder={s.kortIder}
          onVelg={(id) => {
            setVisLeggTilProsjekt(false);
            // Nytt kort åpnes direkte; lagres når første rad legges til.
            router.push(`/timer/${sheetId}/kort/${id}`);
          }}
          onLukk={() => setVisLeggTilProsjekt(false)}
        />
      )}

      {visRammeModal && (
        <RedigerArbeidstidModal
          sheetId={sheetId}
          dato={sedel.dato}
          startAt={sedel.startAt}
          endAt={sedel.endAt}
          beskrivelse={sedel.beskrivelse ?? null}
          onLukk={() => setVisRammeModal(false)}
          onLagret={() => {
            setVisRammeModal(false);
            s.markerEndretOgLes();
          }}
        />
      )}

      {visByggeplassVelger && (
        <ByggeplassVelgerModal
          projectId={sedel.projectId}
          valgtId={sedel.byggeplassId ?? null}
          tillatIngen
          onVelg={(id) => {
            setVisByggeplassVelger(false);
            s.velgByggeplass(id);
          }}
          onLukk={() => setVisByggeplassVelger(false)}
        />
      )}
    </View>
  );
}
