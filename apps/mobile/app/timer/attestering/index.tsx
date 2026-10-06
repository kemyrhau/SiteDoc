import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  beregnUkeAvvik,
  avvikRetning,
  mandagIso,
  type UkeAvvik,
} from "@sitedoc/shared";
import { trpc } from "../../../src/lib/trpc";
import { useFirma } from "../../../src/kontekst/FirmaKontekst";
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
  // ORDRE 2 STEG 3 ledd 2 (D2): server-avledet dag-grunnlag + ukenorm, servert
  // av hentTilAttesteringFirma (:2547/:2549). Brukes til uke-avvik-badgen.
  overtidsgrunnlag?: {
    sumOrdinaert: number;
    sumOvertid: number;
    beregnetOvertid: number;
    avvik: boolean;
  } | null;
  ukenorm?: number;
};

/**
 * Mobil-attestering-liste — firma-kontekst. Speil av webs
 * `/dashbord/firma/timer/attestering`-side, tilpasset mobil-flate.
 *
 * Bruker organizationId fra useFirma()-konteksten. Online-only flyt —
 * krever nett.
 */
export default function AttesteringListeSide() {
  const router = useRouter();
  const { t } = useTranslation();
  const { valgtFirmaId } = useFirma();
  const orgId = valgtFirmaId;

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

  const sedler = useMemo(
    () => (rader as unknown as AttesteringRad[] | undefined) ?? [],
    [rader],
  );

  // ORDRE 2 STEG 3 ledd 2 (D2): uke-avvik pr. (ansatt + uke). Lista er ikke
  // uke-filtrert (mobil sender ingen dato-range), så nøkkelen MÅ bære uken —
  // ellers blandes flere ukers rader. Samme funksjon som web (delt kilde).
  const avvikPerNokkel = useMemo(() => {
    const bøtter = new Map<
      string,
      { totaltimer: number; ukenorm: number; sumOvertid: number }[]
    >();
    for (const s of sedler) {
      const ansattId = s.ansatt?.id;
      if (!ansattId) continue;
      const nokkel = `${ansattId}-${mandagIso(s.dato)}`;
      const liste = bøtter.get(nokkel) ?? [];
      liste.push({
        totaltimer: s.totaltimer,
        ukenorm: s.ukenorm ?? 0,
        sumOvertid: s.overtidsgrunnlag?.sumOvertid ?? 0,
      });
      bøtter.set(nokkel, liste);
    }
    const ut = new Map<string, UkeAvvik>();
    for (const [nokkel, liste] of bøtter) ut.set(nokkel, beregnUkeAvvik(liste));
    return ut;
  }, [sedler]);

  const avvikFor = (s: AttesteringRad): UkeAvvik | null => {
    const ansattId = s.ansatt?.id;
    if (!ansattId) return null;
    return avvikPerNokkel.get(`${ansattId}-${mandagIso(s.dato)}`) ?? null;
  };

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
            {sedler.map((rad) => (
              <SedelKort
                key={rad.id}
                rad={rad}
                avvik={avvikFor(rad)}
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
  avvik,
  onTrykk,
}: {
  rad: AttesteringRad;
  avvik: UkeAvvik | null;
  onTrykk: () => void;
}) {
  const { t } = useTranslation();
  const retning = avvik ? avvikRetning(avvik) : null;
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
        {/* D2-attestantvarsel (ledd 2): uke-avvik-badge — kun badgen på mobil. */}
        {retning && avvik && (
          <View className="mt-1.5 flex-row items-center gap-1 self-start rounded bg-amber-50 px-1.5 py-0.5">
            <AlertTriangle size={12} color="#b45309" />
            <Text className="text-[11px] font-medium text-amber-700">
              {retning === "over"
                ? t("timer.attestering.pivot.avvikOver", {
                    timer: avvik.avvikTimer.toFixed(1),
                  })
                : t("timer.attestering.pivot.avvikUnder")}
            </Text>
          </View>
        )}
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
