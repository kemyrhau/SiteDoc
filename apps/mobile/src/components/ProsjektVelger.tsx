import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  ScrollView,
  ActivityIndicator,
} from "react-native";
// eslint-disable-next-line no-restricted-imports -- pageSheet — simulator-målt 2026-08-31: SafeAreaView anvender arkets egen topp-inset (~10 pt), header-kontroller truffbare. fullScreen-feilen gjelder ikke pageSheet.
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Check, RefreshCw, WifiOff, MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "../kontekst/ProsjektKontekst";
import { useByggeplass } from "../kontekst/ByggeplassKontekst";
import { useAuth } from "../providers/AuthProvider";
import { useProsjektListe } from "../hooks/useProsjektListe";
import { trpc } from "../lib/trpc";
import {
  hentByggeplasserNavLokalt,
  refreshByggeplassNavKatalog,
} from "../services/tegningKatalog";
import {
  antallByggeplasser,
  erByggeplassAvhuket,
  vedByggeplassTrykk,
  vedProsjektTrykk,
  velgByggeplassKilde,
  type ByggeplassKilde,
  type ByggeplassValgRad,
} from "@sitedoc/shared";

interface ProsjektVelgerProps {
  synlig: boolean;
  onLukk: () => void;
}

interface ProsjektRadVisning {
  id: string;
  name: string;
  eierFirma?: string | null;
}

/**
 * (18) Delt prosjekt- og byggeplassvelger. Prosjektlista øverst (inkl. «Prosjekter i
 * andre firma»), byggeplassene for det MARKERTE prosjektet under. Trykk på prosjekt
 * markerer; trykk på byggeplass (eller «Hele prosjektet») velger begge og lukker.
 * Prosjekt med 0 byggeplasser, eller uten lokal katalog offline, velges direkte.
 * Ren logikk: `utils/prosjektByggeplassValg.ts`.
 */
export function ProsjektVelger({ synlig, onLukk }: ProsjektVelgerProps) {
  const { t } = useTranslation();
  const { valgtProsjektId, byttProsjekt } = useProsjekt();
  const { valgtBygningId, erHeleProsjektet, settBygning, velgHeleProsjektet, gpsByggeplassId } =
    useByggeplass();
  const { bruker } = useAuth();
  const brukerId = bruker?.id;
  const utils = trpc.useUtils();
  // Delt hook med offline-fallback til prosjekt_local (feltfunn 2026-10-04).
  const { visning, prosjekter, gjesteprosjekter, erFrakoblet, erPaaNettet, feilmelding, refetch } =
    useProsjektListe();

  // Markert prosjekt: ved åpning det aktive. Markering velger ingenting.
  const [markertId, setMarkertId] = useState<string | null>(valgtProsjektId);
  useEffect(() => {
    if (synlig) setMarkertId(valgtProsjektId);
  }, [synlig, valgtProsjektId]);

  const alleIder = useMemo(
    () => [...prosjekter.map((p) => p.id), ...gjesteprosjekter.map((p) => p.id)],
    [prosjekter, gjesteprosjekter],
  );

  // Byggeplasser pr. prosjekt (antall på raden + lista under). Kun på nett og når åpen.
  const byggeplassQueries = trpc.useQueries((tq) =>
    alleIder.map((id) =>
      tq.bygning.hentForProsjekt(
        { projectId: id },
        { enabled: synlig && erPaaNettet, staleTime: 60_000 },
      ),
    ),
  );
  const serverStatus = byggeplassQueries.map((q) => q.status).join(",");

  // Offline-kilde: byggeplass_nav_local (fylt av online-besøk + «Forbered til offline»).
  const lokalePrProsjekt = useMemo(() => {
    const ut: Record<string, ByggeplassValgRad[]> = {};
    if (!synlig || !brukerId) return ut;
    for (const id of alleIder) {
      ut[id] = hentByggeplasserNavLokalt(id, brukerId).map((b) => ({
        id: b.id,
        name: b.name,
        number: b.number ?? null,
      }));
    }
    return ut;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serverStatus: les katalogen på nytt når serverdata kommer (som ByggeplassChip)
  }, [synlig, brukerId, alleIder, serverStatus]);

  const kildePrProsjekt = useMemo(() => {
    const ut: Record<string, ByggeplassKilde> = {};
    alleIder.forEach((id, i) => {
      const q = byggeplassQueries[i];
      ut[id] = velgByggeplassKilde({
        erPaaNettet,
        // Lean cast (TS2589).
        serverData: q?.data as ByggeplassValgRad[] | undefined,
        serverLaster: !!q?.isLoading,
        lokale: lokalePrProsjekt[id] ?? [],
      });
    });
    return ut;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serverStatus dekker query-endringer
  }, [alleIder, erPaaNettet, lokalePrProsjekt, serverStatus]);

  const markertKilde: ByggeplassKilde = markertId ? kildePrProsjekt[markertId] ?? "ukjent" : "ukjent";

  // Online-data for markert prosjekt → skriv gjennom til nav-cachen (offline neste gang).
  const markertHarServerdata = Array.isArray(markertKilde) && erPaaNettet;
  useEffect(() => {
    if (synlig && markertHarServerdata && markertId && brukerId) {
      refreshByggeplassNavKatalog(utils.client, markertId, brukerId).catch(() => {});
    }
  }, [synlig, markertHarServerdata, markertId, brukerId, utils]);

  const markertNavn = useMemo(() => {
    const p =
      prosjekter.find((x) => x.id === markertId) ?? gjesteprosjekter.find((x) => x.id === markertId);
    return p?.name ?? "";
  }, [prosjekter, gjesteprosjekter, markertId]);

  function trykkProsjekt(id: string) {
    const handling = vedProsjektTrykk(id, kildePrProsjekt[id] ?? "ukjent");
    if (handling.type === "marker") {
      setMarkertId(handling.prosjektId);
      return;
    }
    byttProsjekt(handling.prosjektId);
    onLukk();
  }

  function trykkByggeplass(byggeplassId: string | null) {
    if (!markertId) return;
    const valg = vedByggeplassTrykk(markertId, byggeplassId);
    byttProsjekt(valg.prosjektId);
    // Prosjekt-id som parameter: valget lagres på det markerte prosjektet, også
    // servermirror sistBruktByggeplass — ikke på prosjektet som var aktivt.
    if (valg.byggeplassId) settBygning(valg.byggeplassId, valg.prosjektId);
    else velgHeleProsjektet(valg.prosjektId);
    onLukk();
  }

  function renderProsjektRad(item: ProsjektRadVisning) {
    const erAktiv = item.id === valgtProsjektId;
    const erMarkert = item.id === markertId;
    const antall = antallByggeplasser(kildePrProsjekt[item.id] ?? "ukjent");
    return (
      <Pressable
        key={item.id}
        onPress={() => trykkProsjekt(item.id)}
        className={`flex-row items-center justify-between border-b border-gray-100 px-4 py-3 ${
          erMarkert ? "bg-blue-50" : ""
        }`}
      >
        <View className="flex-1">
          <Text
            className={`text-base font-medium ${erMarkert ? "text-blue-700" : "text-gray-900"}`}
          >
            {item.name}
          </Text>
          {item.eierFirma ? (
            <Text className="mt-0.5 text-xs text-gray-500">{item.eierFirma}</Text>
          ) : null}
          {antall !== null && antall > 0 ? (
            <Text className="mt-0.5 text-xs text-gray-500">
              {t("prosjektVelger.antallByggeplasser", { count: antall })}
            </Text>
          ) : null}
        </View>
        {erAktiv && <Check size={20} color="#1d4ed8" />}
      </Pressable>
    );
  }

  function renderByggeplassliste() {
    if (!markertId) {
      return (
        <Text className="px-4 py-4 text-sm text-gray-500">{t("prosjektVelger.trykkProsjekt")}</Text>
      );
    }
    if (markertKilde === "laster") {
      return (
        <View className="flex-row items-center gap-2 px-4 py-4">
          <ActivityIndicator size="small" color="#1e40af" />
          <Text className="text-sm text-gray-500">{t("byggeplassVelger.lastes")}</Text>
        </View>
      );
    }
    if (markertKilde === "ukjent") {
      return <Text className="px-4 py-4 text-sm text-gray-500">{t("byggeplassVelger.offline")}</Text>;
    }
    if (markertKilde.length === 0) {
      return (
        <Text className="px-4 py-4 text-sm text-gray-500">{t("byggeplass.ingenPaaProsjekt")}</Text>
      );
    }
    const rader: Array<{ id: string | null; name: string }> = [
      ...markertKilde.map((b) => ({ id: b.id as string | null, name: b.name })),
      { id: null, name: t("kontekstChip.heleProsjektet") },
    ];
    return rader.map((b) => {
      const avhuket = erByggeplassAvhuket({
        markertProsjektId: markertId,
        valgtProsjektId,
        valgtBygningId,
        erHeleProsjektet,
        byggeplassId: b.id,
      });
      const naerDeg = b.id !== null && b.id === gpsByggeplassId;
      return (
        <Pressable
          key={b.id ?? "__hele__"}
          onPress={() => trykkByggeplass(b.id)}
          className={`flex-row items-center justify-between border-b border-gray-100 px-4 py-3 ${
            avhuket ? "bg-blue-50" : ""
          }`}
        >
          <View className="flex-1 flex-row items-center gap-2">
            <Text
              className={`text-base ${
                b.id === null ? "text-gray-600" : avhuket ? "font-medium text-blue-700" : "text-gray-900"
              }`}
            >
              {b.name}
            </Text>
            {naerDeg && (
              <View className="flex-row items-center gap-1 rounded-full bg-green-50 px-2 py-0.5">
                <MapPin size={12} color="#15803d" />
                <Text className="text-xs font-medium text-green-700">{t("prosjektVelger.naerDeg")}</Text>
              </View>
            )}
          </View>
          {avhuket && <Check size={20} color="#1d4ed8" />}
        </Pressable>
      );
    });
  }

  return (
    <Modal visible={synlig} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
          <Text className="text-lg font-semibold text-gray-900">
            {t("prosjektVelger.tittelMedByggeplass")}
          </Text>
          <Pressable onPress={onLukk} className="rounded-full p-2">
            <X size={24} color="#6b7280" />
          </Pressable>
        </View>

        {/* Innhold */}
        {visning === "spinner" ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">
              {t("prosjektVelger.henter")}
            </Text>
          </View>
        ) : visning === "feil" ? (
          // Uten nett + ingen lokale data → rolig beskjed (ikke en feil).
          // På nett + spørringen feilet → ekte feilside med «prøv igjen».
          !erPaaNettet ? (
            <View className="flex-1 items-center justify-center px-4">
              <WifiOff size={28} color="#9ca3af" />
              <Text className="mt-3 text-center text-sm text-gray-500">
                {t("prosjektVelger.ingenOffline")}
              </Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-center text-base font-medium text-gray-900">
                {t("prosjektVelger.kunneIkkeHente")}
              </Text>
              <Text className="mt-2 text-center text-sm text-gray-500">
                {feilmelding ?? t("prosjektVelger.sjekkNettverk")}
              </Text>
              <Pressable
                onPress={refetch}
                className="mt-4 flex-row items-center gap-2 rounded-lg bg-blue-600 px-6 py-3"
              >
                <RefreshCw size={16} color="#ffffff" />
                <Text className="font-medium text-white">{t("handling.provIgjen")}</Text>
              </Pressable>
            </View>
          )
        ) : prosjekter.length === 0 && gjesteprosjekter.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-center text-sm text-gray-500">
              {t("prosjektVelger.ingenBeskrivelse")}
            </Text>
          </View>
        ) : (
          <>
            {/* Frakoblet-banner — samme amber-linje som listeskjermene. */}
            {erFrakoblet && (
              <View className="flex-row items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
                <WifiOff size={14} color="#b45309" />
                <Text className="flex-1 text-xs text-amber-800">
                  {t("offline.frakobletLagret")}
                </Text>
              </View>
            )}
            {/* Øvre halvdel: prosjektene (scroll). */}
            <FlatList
              className="flex-1"
              data={prosjekter}
              keyExtractor={(item) => item.id}
              // (15) Egen gruppe «Prosjekter i andre firma» under hovedlista.
              ListFooterComponent={
                gjesteprosjekter.length > 0 ? (
                  <View>
                    <View className="border-b border-gray-200 bg-gray-50 px-4 pb-2 pt-4">
                      <Text className="text-xs font-semibold uppercase text-gray-500">
                        {t("prosjektVelger.andreFirma")}
                      </Text>
                      <Text className="mt-0.5 text-xs text-gray-400">
                        {t("prosjektVelger.andreFirmaHjelp")}
                      </Text>
                    </View>
                    {gjesteprosjekter.map((item) => renderProsjektRad(item))}
                  </View>
                ) : null
              }
              renderItem={({ item }) => renderProsjektRad(item)}
            />
            {/* Nedre halvdel: byggeplassene for markert prosjekt (scroll). */}
            <View className="flex-1 border-t border-gray-200">
              <View className="border-b border-gray-200 bg-gray-50 px-4 py-2">
                <Text className="text-xs font-semibold uppercase text-gray-500" numberOfLines={1}>
                  {t("prosjektVelger.byggeplasserFor", { prosjekt: markertNavn })}
                </Text>
              </View>
              <ScrollView className="flex-1">{renderByggeplassliste()}</ScrollView>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}
