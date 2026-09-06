import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from "react-native";
// eslint-disable-next-line no-restricted-imports -- pageSheet — simulator-målt 2026-08-31 (strukturell tvilling ProsjektByggeplassVelgerModal, edges=top): SafeAreaView anvender arkets egen topp-inset (~10 pt), X truffbar på første tapp. fullScreen-feilen gjelder ikke pageSheet.
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Check, Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  hentByggeplasserForProsjektLokalt,
  refreshByggeplassKatalog,
} from "../../services/byggeplassKatalog";
import { finnProsjektLokalt } from "../../services/prosjektKatalog";
import { useByggeplass } from "../../kontekst/ByggeplassKontekst";
import { useNettverk } from "../../providers/NettverkProvider";
import { trpc } from "../../lib/trpc";

/**
 * Byggeplass-velger-modal for sedel-nivå byggeplass (L1, B6 sedel-nivå-runde).
 * Leser byggeplassLocal filtrert på sedelens prosjekt — offline-trygt etter
 * R4-sync. Sedel-nivå (én byggeplass per dag, jf. @@unique(userId, dato));
 * per-rad/«splitt dagen» er Beslutning 6-oppfølger.
 */
export function ByggeplassVelgerModal({
  projectId,
  valgtId,
  gpsForeslagId,
  tillatIngen = false,
  ingenLabel,
  eksterneByggeplasser,
  onVelg,
  onLukk,
}: {
  projectId: string;
  valgtId: string | null;
  /** F3: GPS-foreslått byggeplass — badges «du er her» på raden. */
  gpsForeslagId?: string | null;
  /**
   * Prosjekt-scopet byggeplass-liste levert av kalleren (den globale
   * `ByggeplassChip` sender `bygning.hentForProsjekt`-dataene). Når satt bruker
   * modalen den DIREKTE og hopper over hele den interne timer-SQLite-/org-veien.
   * Rotårsak (device-funn 2026-09-06): den interne veien resolver `organizationId`
   * fra timer-cachen `prosjektLocal`, som ved design (prosjektKatalog.ts:45,
   * `if (!p.primaryOrganizationId) continue`) UTELATER standalone-prosjekter —
   * velgeren fikk da aldri en kilde. Timer-sedelen lar proppen være udefinert og
   * beholder offline-first-SQLite-veien.
   */
  eksterneByggeplasser?: Array<{
    id: string;
    navn: string | null;
    number: number | null;
  }>;
  /** Vis en rad som nullstiller byggeplass-valget. Sedel-velgeren (dagsseddel)
   *  bruker den som «Ingen byggeplass»; den globale byggeplass-chipen bruker den
   *  som «Hele prosjektet»-utvei (default false → ikke vist). */
  tillatIngen?: boolean;
  /** Etikett på nullstill-raden. Default «Ingen byggeplass» (sedel). Den globale
   *  chipen sender «Hele prosjektet». */
  ingenLabel?: string;
  /** Funn #2: `null` = «Ingen byggeplass» (nullstill). Sendes kun når
   *  `tillatIngen` er satt — ellers får kalleren aldri null. */
  onVelg: (id: string | null) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const { favorittIder, toggleFavoritt } = useByggeplass();
  const { erPaaNettet } = useNettverk();
  const utils = trpc.useUtils();
  const [sok, setSok] = useState("");
  // F2 tri-tilstand: skill «henter» / «offline» / «bekreftet tomt» fra hverandre.
  const [laster, setLaster] = useState(false);
  const [refreshFullført, setRefreshFullført] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  // Re-entry-vakt for det interne refreshet. ERSTATTER `laster`-i-dep-array +
  // avbrutt-cleanup, som ga evig spinner (se fetch-effekten under).
  const henterRef = useRef(false);
  // Generasjonsvakt: `.finally` skal ikke markere «fullført» for et prosjekt som
  // ble byttet under henting (F3 inline-bytte). `laster` nullstilles uansett.
  const aktivtProsjektRef = useRef(projectId);

  const byggeplasser = useMemo(() => {
    // Prop-drevet (chip): kalleren eier lista → bruk den direkte.
    if (eksterneByggeplasser) return eksterneByggeplasser;
    if (!projectId) return [];
    return hentByggeplasserForProsjektLokalt(projectId);
    // refreshNonce tvinger re-lesing etter at et byggeplass-refresh fullførte.
  }, [eksterneByggeplasser, projectId, refreshNonce]);

  // F3-forberedelse (fabels catch): når modalen tillater prosjektbytte inline
  // endres `projectId` uten remount → nullstill refresh-tilstand + søk, ellers
  // ville et nytt prosjekt vist «bekreftet tomt» basert på FORRIGE prosjekts
  // fullførte refresh. Kjører også ved mount (verdiene er allerede default).
  useEffect(() => {
    aktivtProsjektRef.current = projectId;
    henterRef.current = false;
    setLaster(false);
    setRefreshFullført(false);
    setSok("");
  }, [projectId]);

  // F2: tom cache + online → hent byggeplasser ved åpning. Rotårsak: sync er
  // online-gated + async (TimerSyncProvider), så cachen kan være tom i et
  // LEGITIMT vindu (offline / før første sync). «Bekreftet tomt» (tilstand 3)
  // vises kun ETTER at et refresh har fullført tomt — aldri før.
  useEffect(() => {
    // Prop-drevet (global byggeplass-chip): kalleren eier den prosjekt-scopede
    // lista → ingen intern henting. Fjerner orgId-avhengigheten helt.
    if (eksterneByggeplasser) return;
    if (
      !projectId ||
      byggeplasser.length > 0 ||
      !erPaaNettet ||
      refreshFullført ||
      henterRef.current
    ) {
      return;
    }
    const orgId = finnProsjektLokalt(projectId)?.organizationId;
    if (!orgId) {
      // Ingen firma-kontekst i timer-cachen (standalone-prosjekt, eller ikke
      // synket ennå). Marker som fullført → forklart «prosjektMangler»-tekst,
      // ALDRI evig spinner. (Chip-veien treffer aldri hit — den er prop-drevet;
      // dette er sedel-velgerens sikkerhetsnett.)
      setRefreshFullført(true);
      return;
    }
    // `laster` er BEVISST ute av dep-arrayet. Tidligere var den med: setLaster(true)
    // re-kjørte effekten, cleanup satte `avbrutt=true` FØR nett-promiset resolverte,
    // og `.finally` hoppet da over setLaster(false) → evig spinner (device-funn
    // 2026-09-06). `henterRef` vokter re-entry i stedet, og `.finally` nullstiller
    // ALLTID `laster` — spinneren kan ikke lenger henge.
    henterRef.current = true;
    setLaster(true);
    refreshByggeplassKatalog(utils.client, orgId)
      .catch(() => {
        // Feil svelges (samme som TimerSyncProvider) — velgeren faller tilbake
        // til «prosjektMangler»/eksisterende cache; ikke kritisk sti.
      })
      .finally(() => {
        henterRef.current = false;
        setLaster(false);
        // Prosjektet ble byttet under henting (F3) → dropp markering; men laster
        // er alt nullstilt over, så ingen spinner blir hengende.
        if (aktivtProsjektRef.current !== projectId) return;
        setRefreshFullført(true);
        setRefreshNonce((n) => n + 1);
      });
  }, [
    projectId,
    byggeplasser.length,
    erPaaNettet,
    refreshFullført,
    utils.client,
    eksterneByggeplasser,
  ]);

  const filtrert = useMemo(() => {
    const q = sok.trim().toLowerCase();
    const treff = q
      ? byggeplasser.filter(
          (b) =>
            (b.navn ?? "").toLowerCase().includes(q) ||
            String(b.number ?? "").includes(q),
        )
      : byggeplasser;
    // F6: sortér favoritter → GPS-forslag → resten (stabil innen hver gruppe).
    const rang = (id: string) =>
      favorittIder.includes(id) ? 0 : id === gpsForeslagId ? 1 : 2;
    return [...treff].sort((a, b) => rang(a.id) - rang(b.id));
  }, [byggeplasser, sok, favorittIder, gpsForeslagId]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("byggeplassVelger.velg")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {byggeplasser.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("byggeplassVelger.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        {/* Funn #2 (device 2026-08-08): «Ingen byggeplass» nullstiller sedelen —
            uten dette kunne en feilvalgt byggeplass ikke angres (velgeren gikk
            bare én vei). Kun sedel-velgeren (tillatIngen); den globale chipen
            skal ikke kunne tømme aktiv byggeplass herfra. */}
        {tillatIngen && (
          <Pressable
            onPress={() => onVelg(null)}
            className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
              valgtId == null ? "bg-blue-50" : ""
            }`}
          >
            <Text className="flex-1 text-base text-gray-700">
              {ingenLabel ?? t("timer.byggeplass.ingenValgt")}
            </Text>
            {valgtId == null && <Check size={18} color="#1e40af" />}
          </Pressable>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base text-gray-900">
                  {item.navn ?? item.id}
                </Text>
                {item.id === gpsForeslagId ? (
                  <Text className="text-xs text-green-600">
                    {t("byggeplassVelger.gpsForeslarHer")}
                  </Text>
                ) : favorittIder.includes(item.id) ? (
                  <Text className="text-xs text-amber-600">
                    {t("byggeplassVelger.favoritt")}
                  </Text>
                ) : (
                  item.number != null && (
                    <Text className="text-xs text-gray-500">#{item.number}</Text>
                  )
                )}
              </View>
              {/* F6: stjerne-toggle (egen trykk-flate — velger ikke byggeplass) */}
              <Pressable
                onPress={() => toggleFavoritt(item.id)}
                hitSlop={10}
                className="px-1"
              >
                <Star
                  size={18}
                  color="#d97706"
                  fill={favorittIder.includes(item.id) ? "#d97706" : "none"}
                />
              </Pressable>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => {
            // Søk uten treff (cachen HAR data) → egen tilstand, ikke tri-tilstand.
            if (sok.trim() && byggeplasser.length > 0) {
              return (
                <View className="px-4 py-8">
                  <Text className="text-center text-gray-500">
                    {t("byggeplassVelger.ingenTreff")}
                  </Text>
                </View>
              );
            }
            // Tom cache — tri-tilstand (F2).
            if (laster) {
              return (
                <View className="items-center px-4 py-8">
                  <ActivityIndicator color="#1e40af" />
                  <Text className="mt-3 text-center text-gray-500">
                    {t("byggeplassVelger.lastes")}
                  </Text>
                </View>
              );
            }
            if (!erPaaNettet && !refreshFullført) {
              return (
                <View className="px-4 py-8">
                  <Text className="text-center text-gray-500">
                    {t("byggeplassVelger.offline")}
                  </Text>
                </View>
              );
            }
            if (refreshFullført) {
              return (
                <View className="px-4 py-8">
                  <Text className="text-center text-gray-500">
                    {t("byggeplassVelger.prosjektMangler")}
                  </Text>
                </View>
              );
            }
            // Initial (før effekten rakk å kjøre) — nøytral melding.
            return (
              <View className="px-4 py-8">
                <Text className="text-center text-gray-500">
                  {t("byggeplassVelger.ingen")}
                </Text>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
