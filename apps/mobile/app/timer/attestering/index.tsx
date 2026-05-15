import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, ChevronRight, AlertCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/providers/AuthProvider";
import { trpc } from "../../../src/lib/trpc";
import { formatNorskDato } from "../../../src/utils/dato";

type AttesteringRad = {
  id: string;
  dato: Date | string;
  status: string;
  totaltimer: number;
  antallRader: number;
  aktivitet: { id: string; navn: string; kode: string | null } | null;
  ansatt: {
    id: string;
    name: string | null;
    email: string;
    ansattnummer: string | null;
  } | null;
  prosjekt: {
    id: string;
    name: string;
    projectNumber: string;
  } | null;
};

/**
 * Mobil-attestering-liste — firma-kontekst. Speil av webs
 * `/dashbord/firma/timer/attestering`-side, tilpasset mobil-flate.
 *
 * Bruker organizationId fra første treff fra `hentMine`-prosjekt-katalog
 * via brukerens session. Online-only flyt — krever nett.
 */
export default function AttesteringListeSide() {
  const router = useRouter();
  const { t } = useTranslation();
  const { bruker } = useAuth();

  // Hent organizationId via prosjekt.hentMine — første prosjekt med firma-
  // tilhørighet brukes som proxy. Brukeren tilhører ett firma.
  const { data: prosjekter } = trpc.prosjekt.hentMine.useQuery(undefined, {
    enabled: !!bruker?.id,
    staleTime: 60 * 1000,
  });

  const orgId = (prosjekter as unknown as Array<{ primaryOrganizationId: string | null }> | undefined)
    ?.map((p) => p.primaryOrganizationId)
    .find((id): id is string => !!id);

  const { data: tilgang, isLoading: tilgangLaster } =
    trpc.timer.dagsseddel.kanAttestereFirma.useQuery(
      { organizationId: orgId ?? "" },
      { enabled: !!orgId },
    );
  const kanAttestere = tilgang?.kanAttestere ?? false;

  const { data: rader, isLoading } =
    trpc.timer.dagsseddel.hentTilAttesteringFirma.useQuery(
      { organizationId: orgId ?? "" },
      { enabled: !!orgId && kanAttestere },
    );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#1f2937" />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-gray-900">
          {t("timer.attestering.tittel")}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        <Text className="px-4 pt-4 text-sm text-gray-600">
          {t("firma.timer.attesteringBeskrivelse")}
        </Text>

        {tilgangLaster || isLoading ? (
          <View className="flex-1 items-center justify-center py-12">
            <ActivityIndicator size="large" color="#1e40af" />
          </View>
        ) : !orgId ? (
          <BannerInfo>{t("firma.timer.attesteringIngenFirma")}</BannerInfo>
        ) : !kanAttestere ? (
          <BannerInfo>{t("timer.attestering.ingenTilgang")}</BannerInfo>
        ) : !rader || rader.length === 0 ? (
          <View className="mx-4 mt-6 rounded-lg border border-gray-200 bg-white p-12">
            <Text className="text-center text-sm text-gray-500">
              {t("timer.attestering.ingenSedler")}
            </Text>
          </View>
        ) : (
          <View className="mt-4">
            {(rader as unknown as AttesteringRad[]).map((rad) => (
              <SedelKort
                key={rad.id}
                rad={rad}
                onTrykk={() => router.push(`/timer/attestering/${rad.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SedelKort({
  rad,
  onTrykk,
}: {
  rad: AttesteringRad;
  onTrykk: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onTrykk}
      className="mx-4 mb-2 flex-row items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 active:bg-gray-50"
    >
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900">
          {formatNorskDato(
            typeof rad.dato === "string" ? rad.dato : rad.dato.toISOString(),
          )}
        </Text>
        {rad.ansatt && (
          <Text className="mt-0.5 text-sm text-gray-600">
            {rad.ansatt.name ?? rad.ansatt.email}
            {rad.ansatt.ansattnummer ? (
              <Text className="text-xs text-gray-500">
                {"  #"}
                {rad.ansatt.ansattnummer}
              </Text>
            ) : null}
          </Text>
        )}
        {rad.prosjekt && (
          <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
            {rad.prosjekt.projectNumber
              ? `${rad.prosjekt.projectNumber} — `
              : ""}
            {rad.prosjekt.name}
          </Text>
        )}
        <Text className="mt-1 text-xs text-gray-500">
          {rad.totaltimer.toFixed(2)} {t("timer.timerEnhet")}
          {" · "}
          {rad.antallRader} rader
        </Text>
      </View>
      <ChevronRight size={20} color="#9ca3af" />
    </Pressable>
  );
}

function BannerInfo({ children }: { children: string }) {
  return (
    <View className="mx-4 mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <View className="flex-row items-center gap-2">
        <AlertCircle size={16} color="#b45309" />
        <Text className="flex-1 text-sm text-amber-900">{children}</Text>
      </View>
    </View>
  );
}
