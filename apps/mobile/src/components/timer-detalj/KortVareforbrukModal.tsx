import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Modal, TextInput, ScrollView, Keyboard } from "react-native";
import { Package } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import { hentVarerLokalt } from "../../services/vareKatalog";
import {
  lagreLokalVarelinje,
  fullforVarelinje,
  vareModalEtterLagre,
  type FortVarelinje,
  type VarelinjeValg,
} from "../../services/vareforbrukSync";
import { TastaturScrollView } from "./TastaturScrollView";
import { TastaturFerdig, TASTATUR_FERDIG_ID } from "./TastaturFerdig";
import { hentByggeplasserForProsjektLokalt } from "../../services/byggeplassKatalog";
import { formatKortTall } from "../../lib/prosjektkortMobil";
import { lagVaresokFokus, varesokRullMal } from "../../utils/varesokRulling";

/**
 * Prosjektkort L3 (2026-11-06): «+ Vareforbruk» fra kortskjermen. Prosjektet
 * er låst til kortets, dato er sedelens. Varene kommer fra lokal katalog-cache
 * og linjen skrives lokalt (offline-trygt) — sendes ved neste synk.
 * Hele flaten ruller over tastaturet (TastaturScrollView), som raddialogene.
 *
 * L3-D: med `onVelgLinje` (bekreft-dag) lagres ingenting — linja gis tilbake og
 * skrives på start-sedelen ved Bekreft. Da finnes ingen sedel ennå (`sheetId` null).
 *
 * ORDRE 34: `forblirApen` (kun Bekreft dag) holder dialogen åpen etter hver linje
 * og viser `fortIDag` øverst; [Ferdig] lukker. Default = dagens atferd (lukker).
 *
 * ORDRE 37: med fokus i søkefeltet og tastaturet oppe rulles «Vare»-blokka til
 * toppen, så treffene vises over tastaturet (`utils/varesokRulling.ts`).
 *
 * ORDRE 36b: med `kortLaas` arver linja kortets byggeplass og underprosjekt —
 * ingen byggeplass-velger (retting går via «Flytt raden»). `byggeplassId` er
 * lagret verdi (`null` = arver dagens). Uten `kortLaas`: som før.
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
  forblirApen = false,
  fortIDag = [],
  kortLaas,
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
  forblirApen?: boolean;
  fortIDag?: FortVarelinje[];
  kortLaas?: { byggeplassId: string | null; ecoId: string | null };
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
  // Primitiver i dep-lista: kalleren kan sende et nytt `kortLaas`-objekt pr. render.
  const laast = !!kortLaas;
  const laastByggeplassId = kortLaas?.byggeplassId ?? null;
  // Modalen er alltid montert (mobil.md: aldri `{betingelse && <Modal>}`) —
  // skjemaet nullstilles og forhåndsvalg settes ved hver åpning, ikke ved montering.
  useEffect(() => {
    if (!synlig) return;
    setSok("");
    setVareId(null);
    setAntall("");
    setByggeplassId(
      laast
        ? laastByggeplassId
        : byggeplasser.some((b) => b.id === sedelByggeplassId)
          ? sedelByggeplassId
          : null,
    );
  }, [synlig, byggeplasser, sedelByggeplassId, laast, laastByggeplassId]);
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

  const rulleRef = useRef<ScrollView>(null);
  const kortY = useRef(0);
  const vareY = useRef(0);
  const [varesokFokus] = useState(() =>
    lagVaresokFokus({
      tastaturSynlig: () => Keyboard.isVisible(),
      lyttVist: (fn) => Keyboard.addListener("keyboardDidShow", fn),
      rull: () =>
        rulleRef.current?.scrollTo({
          y: varesokRullMal({ kortY: kortY.current, feltY: vareY.current, marg: 12 }),
          animated: true,
        }),
    }),
  );
  useEffect(() => () => varesokFokus.rydd(), [varesokFokus]);

  function lagre() {
    if (!valgt || !kanLagre) return;
    fullforVarelinje(
      { vareId: valgt.id, vareNavn: valgt.navn, enhet: valgt.enhet, antall: tall, byggeplassId },
      {
        onVelgLinje,
        lagre: (v) => {
          if (!sheetId) return;
          lagreLokalVarelinje({
            id: randomUUID(),
            userId,
            organizationId,
            sheetId,
            projectId,
            dato,
            ...v,
            externalCostObjectId: kortLaas?.ecoId ?? null,
          });
        },
      },
    );
    if (vareModalEtterLagre(forblirApen) === "nullstill") {
      setSok("");
      setVareId(null);
      setAntall("");
      return;
    }
    onLagret();
  }

  return (
    <Modal visible={synlig} transparent animationType="fade" onRequestClose={onAvbryt}>
      <TastaturScrollView
        ref={rulleRef}
        className="flex-1 bg-black/40"
        contentContainerClassName="flex-grow items-center justify-center px-6 py-10"
      >
        <View
          onLayout={(e) => {
            kortY.current = e.nativeEvent.layout.y;
          }}
          className="w-full max-w-md rounded-2xl bg-white p-5"
        >
          <View className="mb-3 flex-row items-center gap-2">
            <Package size={20} color="#1e40af" />
            <Text className="flex-1 text-base font-semibold text-gray-900">
              {t("vareforbruk.modal.opprett")}
            </Text>
          </View>

          {forblirApen && fortIDag.length > 0 && (
            <View className="mb-3 rounded-lg bg-gray-50 p-2">
              <Text className="mb-1 text-xs font-medium text-gray-500">
                {t("timer.bekreftDag.vareFortIDag")}
              </Text>
              {fortIDag.map((l, i) => (
                <Text key={i} className="text-sm text-gray-900">
                  {`${l.navn} · ${formatKortTall(l.antall).replace(/,0$/, "")} ${l.enhet}`}
                </Text>
              ))}
            </View>
          )}

          <Text className="text-xs font-medium text-gray-500">{t("timer.felt.prosjekt")}</Text>
          <Text className="mb-3 text-sm text-gray-900">{prosjektNavn}</Text>

          {!kortLaas && byggeplasser.length > 0 && (
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

          <View
            onLayout={(e) => {
              vareY.current = e.nativeEvent.layout.y;
            }}
          >
            <Text className="mb-1 text-xs font-medium text-gray-500">{t("vareforbruk.felt.vare")}</Text>
            <TextInput
              value={sok}
              onChangeText={setSok}
              onFocus={varesokFokus.onFocus}
              onBlur={varesokFokus.onBlur}
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
          </View>

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
              <Text className="text-base font-medium text-gray-700">
                {forblirApen ? t("timer.bekreftDag.vareFerdig") : t("handling.avbryt")}
              </Text>
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
