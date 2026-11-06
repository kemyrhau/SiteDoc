import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Modal, TextInput, ScrollView } from "react-native";
import { Package } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import { hentVarerLokalt } from "../../services/vareKatalog";
import {
  lagreLokalVarelinje,
  fullforVarelinje,
  type VarelinjeValg,
} from "../../services/vareforbrukSync";
import { TastaturScrollView } from "./TastaturScrollView";
import { TastaturFerdig, TASTATUR_FERDIG_ID } from "./TastaturFerdig";
import { hentByggeplasserForProsjektLokalt } from "../../services/byggeplassKatalog";

/**
 * Prosjektkort L3 (2026-11-06): «+ Vareforbruk» fra kortskjermen. Prosjektet
 * er låst til kortets, dato er sedelens. Varene kommer fra lokal katalog-cache
 * og linjen skrives lokalt (offline-trygt) — sendes ved neste synk.
 * Hele flaten ruller over tastaturet (TastaturScrollView), som raddialogene.
 *
 * L3-D: med `onVelgLinje` (bekreft-dag) lagres ingenting — linja gis tilbake og
 * skrives på start-sedelen ved Bekreft. Da finnes ingen sedel ennå (`sheetId` null).
 */
export function KortVareforbrukModal({
  synlig,
  userId,
  organizationId,
  sheetId,
  projectId,
  prosjektNavn,
  dato,
  sedelByggeplassId,
  onAvbryt,
  onLagret,
  onVelgLinje,
}: {
  synlig: boolean;
  userId: string;
  organizationId: string;
  sheetId: string | null;
  projectId: string;
  prosjektNavn: string;
  dato: string;
  sedelByggeplassId: string | null;
  onAvbryt: () => void;
  onLagret: () => void;
  onVelgLinje?: (valg: VarelinjeValg) => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");
  const [vareId, setVareId] = useState<string | null>(null);
  const [antall, setAntall] = useState("");
  const byggeplasser = useMemo(
    () => (synlig ? hentByggeplasserForProsjektLokalt(projectId) : []),
    [synlig, projectId],
  );
  const [byggeplassId, setByggeplassId] = useState<string | null>(null);
  // Modalen er alltid montert (mobil.md: aldri `{betingelse && <Modal>}`) —
  // skjemaet nullstilles og forhåndsvalg settes ved hver åpning, ikke ved montering.
  useEffect(() => {
    if (!synlig) return;
    setSok("");
    setVareId(null);
    setAntall("");
    setByggeplassId(byggeplasser.some((b) => b.id === sedelByggeplassId) ? sedelByggeplassId : null);
  }, [synlig, byggeplasser, sedelByggeplassId]);
  const varer = useMemo(
    () => (synlig ? hentVarerLokalt(organizationId) : []),
    [synlig, organizationId],
  );
  const treff = useMemo(() => {
    const q = sok.trim().toLowerCase();
    if (!q) return varer;
    return varer.filter(
      (v) => v.navn.toLowerCase().includes(q) || (v.varenummer ?? "").toLowerCase().includes(q),
    );
  }, [varer, sok]);
  const valgt = varer.find((v) => v.id === vareId);
  const tall = Number(antall.replace(",", "."));
  const kanLagre = !!valgt && Number.isFinite(tall) && tall > 0;

  function lagre() {
    if (!valgt || !kanLagre) return;
    fullforVarelinje(
      { vareId: valgt.id, vareNavn: valgt.navn, enhet: valgt.enhet, antall: tall, byggeplassId },
      {
        onVelgLinje,
        lagre: (v) => {
          if (!sheetId) return;
          lagreLokalVarelinje({ id: randomUUID(), userId, organizationId, sheetId, projectId, dato, ...v });
        },
      },
    );
    onLagret();
  }

  return (
    <Modal visible={synlig} transparent animationType="fade" onRequestClose={onAvbryt}>
      <TastaturScrollView
        className="flex-1 bg-black/40"
        contentContainerClassName="flex-grow items-center justify-center px-6 py-10"
      >
        <View className="w-full max-w-md rounded-2xl bg-white p-5">
          <View className="mb-3 flex-row items-center gap-2">
            <Package size={20} color="#1e40af" />
            <Text className="flex-1 text-base font-semibold text-gray-900">
              {t("vareforbruk.modal.opprett")}
            </Text>
          </View>

          <Text className="text-xs font-medium text-gray-500">{t("timer.felt.prosjekt")}</Text>
          <Text className="mb-3 text-sm text-gray-900">{prosjektNavn}</Text>

          {byggeplasser.length > 0 && (
            <>
              <Text className="mb-1 text-xs font-medium text-gray-500">
                {t("vareforbruk.felt.byggeplass")}
              </Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {[{ id: null, navn: t("vareforbruk.felt.byggeplassIngen") }, ...byggeplasser].map(
                  (b) => {
                    const aktiv = byggeplassId === b.id;
                    return (
                      <Pressable
                        key={b.id ?? "ingen"}
                        onPress={() => setByggeplassId(b.id)}
                        className={`rounded-full border px-3 py-1.5 ${aktiv ? "border-blue-700 bg-blue-50" : "border-gray-300"}`}
                      >
                        <Text className={`text-sm ${aktiv ? "text-blue-800" : "text-gray-700"}`}>
                          {b.navn}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </>
          )}

          <Text className="mb-1 text-xs font-medium text-gray-500">{t("vareforbruk.felt.vare")}</Text>
          <TextInput
            value={sok}
            onChangeText={setSok}
            placeholder={t("handling.sok")}
            className="mb-2 rounded-lg border border-gray-300 px-3 py-2 text-base"
          />
          <ScrollView nestedScrollEnabled className="mb-3 max-h-48 rounded-lg border border-gray-200">
            {treff.length === 0 ? (
              <Text className="p-3 text-sm text-gray-500">{t("felles.ingenTreff")}</Text>
            ) : (
              treff.map((v) => {
                const aktiv = v.id === vareId;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => setVareId(v.id)}
                    className={`flex-row justify-between border-b border-gray-100 px-3 py-2.5 ${aktiv ? "bg-blue-50" : ""}`}
                  >
                    <Text className={`flex-1 text-sm ${aktiv ? "font-semibold text-blue-800" : "text-gray-800"}`}>
                      {v.navn}
                      {v.varenummer ? ` (${v.varenummer})` : ""}
                    </Text>
                    <Text className="text-sm text-gray-500">{v.enhet}</Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Text className="mb-1 text-xs font-medium text-gray-500">
            {t("vareforbruk.felt.antall") + (valgt ? ` (${valgt.enhet})` : "")}
          </Text>
          <TextInput
            value={antall}
            onChangeText={setAntall}
            keyboardType="decimal-pad"
            inputAccessoryViewID={TASTATUR_FERDIG_ID}
            className="mb-4 rounded-lg border border-gray-300 px-3 py-2 text-base"
          />

          <View className="flex-row justify-end gap-2">
            <Pressable onPress={onAvbryt} className="rounded-lg px-4 py-2.5 active:bg-gray-100">
              <Text className="text-base font-medium text-gray-700">{t("handling.avbryt")}</Text>
            </Pressable>
            <Pressable
              onPress={lagre}
              disabled={!kanLagre}
              className={`rounded-lg px-4 py-2.5 ${kanLagre ? "bg-blue-700 active:bg-blue-800" : "bg-gray-300"}`}
            >
              <Text className="text-base font-semibold text-white">
                {t("timer.prosjektkort.vareLagre")}
              </Text>
            </Pressable>
          </View>
        </View>
      </TastaturScrollView>
      <TastaturFerdig />
    </Modal>
  );
}
