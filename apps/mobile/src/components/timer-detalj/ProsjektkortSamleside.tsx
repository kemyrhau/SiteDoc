import { View, Text, Pressable } from "react-native";
import { ChevronRight, MapPin, Plus, Send } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  beregnKortSummer,
  dagSummer,
  kortStatus,
  sumIDag,
  utledKortByggeplass,
  type KortMaskinRad,
  type KortTimerRad,
  type KortVareLinje,
} from "@sitedoc/shared";
import {
  formatKortTall,
  pauseBaererProsjekt,
  sendKnappTekst,
} from "../../lib/prosjektkortMobil";

/**
 * Prosjektkort L2 (spec § 4.2/§ 7): samlesiden for dagen i prosjektkort-modus.
 * Erstatter blå sedel-boks, «Arbeidstid i dag», prosjekt-gruppene, «+ Legg til
 * prosjekt» og Send-knappen på `timer/[id]`. Ett kort pr. prosjekt (kun tall);
 * trykk åpner kortskjermen. Tallene regnes med de delte web-funksjonene.
 */
export function ProsjektkortSamleside({
  prosjektIder,
  timer,
  maskin,
  varer,
  utleggAntall,
  sedelByggeplassId,
  sedelStatus,
  normTimer,
  ramme,
  rammeByggeplassNavn,
  prosjektNavn,
  byggeplassNavn,
  redigerbar,
  onAapneKort,
  onNyttKort,
  onEndreRamme,
  onEndreByggeplass,
  onSend,
}: {
  prosjektIder: string[];
  timer: (KortTimerRad & { pauseMin: number })[];
  maskin: KortMaskinRad[];
  varer: KortVareLinje[];
  /** Antall utlegg-rader pr. prosjekt (chip «Utlegg N»). */
  utleggAntall: Map<string, number>;
  sedelByggeplassId: string | null;
  sedelStatus: string;
  normTimer: number | null;
  ramme: { fra: string; til: string; pauseMin: number };
  rammeByggeplassNavn: string | null;
  prosjektNavn: (projectId: string) => string;
  byggeplassNavn: (byggeplassId: string) => string | null;
  redigerbar: boolean;
  onAapneKort: (projectId: string) => void;
  onNyttKort: () => void;
  onEndreRamme: () => void;
  onEndreByggeplass: () => void;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  const dagSum = sumIDag(timer);
  const dag = dagSummer(timer, maskin);
  const pauseKort = pauseBaererProsjekt(timer);
  const send = sendKnappTekst(sedelStatus, dagSum);

  return (
    <View className="mx-4 mt-4 gap-3">
      <View className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
        <Text className="text-sm text-gray-700">
          {t("timer.prosjektkort.toppTekst", {
            antall: prosjektIder.length,
            timer: formatKortTall(dagSum),
          })}
        </Text>
      </View>

      {prosjektIder.length === 0 && (
        <View className="rounded-lg border border-dashed border-gray-300 bg-white p-5">
          <Text className="text-center text-sm text-gray-500">
            {t("timer.detalj.ingenProsjektGrupper")}
          </Text>
        </View>
      )}

      {prosjektIder.map((projectId) => (
        <Pressable
          key={projectId}
          onPress={() => onAapneKort(projectId)}
          className="rounded-lg border border-gray-200 bg-white p-4 active:bg-gray-50"
        >
          <KortHode
            projectId={projectId}
            navn={prosjektNavn(projectId)}
            timer={timer}
            maskin={maskin}
            varer={varer}
            utlegg={utleggAntall.get(projectId) ?? 0}
            sedelByggeplassId={sedelByggeplassId}
            byggeplassNavn={byggeplassNavn}
            visChevron
          />
        </Pressable>
      ))}

      {redigerbar && (
        <Pressable
          onPress={onNyttKort}
          className="flex-row items-center gap-1 self-start py-1 active:opacity-60"
        >
          <Plus size={16} color="#1e40af" />
          <Text className="text-base font-semibold text-sitedoc-primary">
            {t("timer.prosjektkort.nyttKort").replace(/^\+\s*/, "")}
          </Text>
        </Pressable>
      )}

      {/* Dagens ramme — sedelens felles fra/til/pause + dagens byggeplass
          (arv-kilden for rader uten egen byggeplass, spec § 7). Nedtonet. */}
      <View className="rounded-lg border border-dashed border-gray-300 px-4 py-2.5">
        <View className="flex-row items-start gap-3">
          <Text className="flex-1 text-sm text-gray-600">
            {t("timer.prosjektkort.ramme", {
              fra: ramme.fra,
              til: ramme.til,
              pause: ramme.pauseMin,
            })}
            {pauseKort &&
              ` ${t("timer.prosjektkort.pauseBaeres", { kort: prosjektNavn(pauseKort) })}`}
          </Text>
          {redigerbar && (
            <Pressable onPress={onEndreRamme} hitSlop={10}>
              <Text className="text-sm font-medium text-sitedoc-primary">
                {t("handling.endre")}
              </Text>
            </Pressable>
          )}
        </View>
        <Pressable
          disabled={!redigerbar}
          onPress={onEndreByggeplass}
          className="mt-1.5 flex-row items-center gap-1.5"
        >
          <MapPin size={14} color="#6b7280" />
          <Text className="flex-1 text-sm text-gray-600" numberOfLines={1}>
            {t("timer.felt.byggeplass")}:{" "}
            {rammeByggeplassNavn ?? t("timer.byggeplass.ingenValgt")}
          </Text>
          {redigerbar && <ChevronRight size={14} color="#9ca3af" />}
        </Pressable>
      </View>

      <View className="rounded-lg bg-blue-50 px-4 py-2.5">
        <Text className="text-sm text-sitedoc-primary">
          {t("timer.prosjektkort.sumIDag", {
            registrert: formatKortTall(dagSum),
            total: normTimer === null ? "?" : formatKortTall(normTimer),
          })}
          {dag.maskin > 0 &&
            ` · ${t("timer.prosjektkort.sumMaskin", { timer: formatKortTall(dag.maskin) })}`}
          {dag.reise > 0 &&
            ` · ${t("timer.prosjektkort.sumReise", { timer: formatKortTall(dag.reise) })}`}
        </Text>
      </View>

      {redigerbar && (
        <>
          <Pressable
            onPress={onSend}
            className="flex-row items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 active:bg-blue-700"
          >
            <Send size={16} color="#ffffff" />
            <Text className="text-base font-semibold text-white">
              {send.nokkel === "timer.detalj.sendPaaNytt"
                ? t(send.nokkel)
                : t(send.nokkel, { timer: formatKortTall(send.timer) })}
            </Text>
          </Pressable>
          <Text className="text-center text-xs text-gray-500">
            {t("timer.sendGodkjennHint")}
          </Text>
        </>
      )}
    </View>
  );
}

/**
 * Kortets hode: prosjektnavn + kort-status, byggeplass (én / «N byggeplasser»)
 * og chips (Arbeid alltid; Maskin/Varer/Reise/Utlegg når > 0). Felles for
 * samlesiden og kortskjermen. Radene filtreres på `projectId` her.
 */
export function KortHode({
  projectId,
  navn,
  timer,
  maskin,
  varer,
  utlegg,
  sedelByggeplassId,
  byggeplassNavn,
  visChevron = false,
}: {
  projectId: string;
  navn: string;
  timer: readonly KortTimerRad[];
  maskin: readonly KortMaskinRad[];
  varer: readonly KortVareLinje[];
  utlegg: number;
  sedelByggeplassId: string | null;
  byggeplassNavn: (byggeplassId: string) => string | null;
  visChevron?: boolean;
}) {
  const { t } = useTranslation();
  const enhet = t("timer.timerEnhet");
  const kTimer = timer.filter((r) => r.projectId === projectId);
  const kMaskin = maskin.filter((r) => r.projectId === projectId);
  const kVarer = varer.filter((v) => v.projectId === projectId);
  const summer = beregnKortSummer(kTimer, kMaskin, kVarer);
  const bp = utledKortByggeplass([...kTimer, ...kMaskin], sedelByggeplassId);
  const status = kortStatus([...kTimer, ...kMaskin]);
  const chips: [string, string][] = [
    [t("timer.prosjektkort.kolonne.arbeid"), `${formatKortTall(summer.arbeid)} ${enhet}`],
  ];
  if (summer.maskin > 0) {
    chips.push([t("timer.prosjektkort.kolonne.maskin"), `${formatKortTall(summer.maskin)} ${enhet}`]);
  }
  if (summer.varer) {
    chips.push([
      t("timer.prosjektkort.kolonne.varer"),
      summer.varer.type === "mengde"
        ? `${formatKortTall(summer.varer.antall).replace(/,0$/, "")} ${summer.varer.enhet}`
        : t("timer.prosjektkort.varelinjer", { antall: summer.varer.antall }),
    ]);
  }
  if (summer.reise > 0) {
    chips.push([t("timer.prosjektkort.kolonne.reise"), `${formatKortTall(summer.reise)} ${enhet}`]);
  }
  if (utlegg > 0) {
    chips.push([t("timer.prosjektkort.kolonne.utlegg"), String(utlegg)]);
  }
  return (
    <View>
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-base font-semibold text-gray-900">{navn}</Text>
            {status === "returnert" && (
              <View className="rounded bg-orange-100 px-1.5 py-0.5">
                <Text className="text-[10px] font-semibold text-orange-700">
                  {t("timer.prosjektkort.status.returnert")}
                </Text>
              </View>
            )}
            {status === "attestert" && (
              <View className="rounded bg-green-100 px-1.5 py-0.5">
                <Text className="text-[10px] font-semibold text-green-700">
                  {t("timer.prosjektkort.status.attestert")}
                </Text>
              </View>
            )}
          </View>
          {bp.type !== "ingen" && (
            <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={1}>
              {bp.type === "en"
                ? byggeplassNavn(bp.id) ?? ""
                : t("timer.prosjektkort.flereByggeplasser", { antall: bp.antall })}
            </Text>
          )}
        </View>
        {visChevron && <ChevronRight size={18} color="#9ca3af" />}
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {chips.map(([etikett, verdi]) => (
          <View key={etikett} className="flex-row rounded-md bg-gray-100 px-2.5 py-1">
            <Text className="text-sm text-gray-700">{etikett} </Text>
            <Text className="text-sm font-semibold text-gray-900">{verdi}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
