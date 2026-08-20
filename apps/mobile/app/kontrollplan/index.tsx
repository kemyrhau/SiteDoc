import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, MapPin, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../../src/lib/trpc";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { ByggeplassChip } from "../../src/components/ByggeplassChip";

// Kontrollplan-punkt-status → i18n-nøkkel + farge. Lesevisning (ingen mutasjon).
const PUNKT_STATUS: Record<string, { noekkel: string; bg: string; tekstFarge: string }> = {
  planlagt: { noekkel: "kontrollplan.statusPlanlagt", bg: "bg-gray-100", tekstFarge: "text-gray-700" },
  pagar: { noekkel: "kontrollplan.statusPagar", bg: "bg-blue-100", tekstFarge: "text-blue-700" },
  utfort: { noekkel: "kontrollplan.statusUtfort", bg: "bg-green-100", tekstFarge: "text-green-700" },
  godkjent: { noekkel: "kontrollplan.statusGodkjent", bg: "bg-emerald-100", tekstFarge: "text-emerald-700" },
};

// Plan-status (utkast|aktiv|godkjent|arkivert)
const PLAN_STATUS: Record<string, string> = {
  utkast: "kontrollplan.statusUtkast",
  aktiv: "kontrollplan.statusAktiv",
  godkjent: "kontrollplan.statusGodkjent",
  arkivert: "kontrollplan.statusArkivert",
};

// Cast-typer for å unngå TS2589 (excessively deep type instantiation)
interface PunktRad {
  id: string;
  status: string;
  milepelId: string | null;
  fristUke: number | null;
  fristAar: number | null;
  sjekklisteMal?: { name: string; prefix: string | null; kontrollomrade: string | null } | null;
  faggruppe?: { name: string; color: string | null } | null;
  omrade?: { navn: string } | null;
}

interface MilepelRad {
  id: string;
  navn: string;
}

interface KontrollplanData {
  navn: string;
  status: string;
  punkter: PunktRad[];
  milepeler: MilepelRad[];
}

function StatusBadge({ noekkel, bg, tekstFarge }: { noekkel: string; bg: string; tekstFarge: string }) {
  const { t } = useTranslation();
  return (
    <View className={`rounded-full px-2.5 py-0.5 ${bg}`}>
      <Text className={`text-xs font-medium ${tekstFarge}`}>{t(noekkel)}</Text>
    </View>
  );
}

function PunktKort({ punkt }: { punkt: PunktRad }) {
  const { t } = useTranslation();
  const status = PUNKT_STATUS[punkt.status] ?? {
    noekkel: punkt.status,
    bg: "bg-gray-100",
    tekstFarge: "text-gray-700",
  };
  const prefix = punkt.sjekklisteMal?.prefix;
  const undertekst = [
    punkt.omrade?.navn,
    punkt.faggruppe?.name,
    punkt.fristUke != null ? `${t("kontrollplan.fristUke")} ${punkt.fristUke}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3">
      <View className="flex-1 pr-2">
        <Text className="text-sm text-gray-900" numberOfLines={2}>
          {prefix ? <Text className="font-bold">{prefix} </Text> : null}
          {punkt.sjekklisteMal?.name ?? t("kontrollplan.tittel")}
        </Text>
        {undertekst ? (
          <View className="mt-0.5 flex-row items-center gap-1.5">
            {punkt.faggruppe?.color ? (
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: punkt.faggruppe.color }}
              />
            ) : null}
            <Text className="text-xs text-gray-500" numberOfLines={1}>
              {undertekst}
            </Text>
          </View>
        ) : null}
      </View>
      <StatusBadge noekkel={status.noekkel} bg={status.bg} tekstFarge={status.tekstFarge} />
    </View>
  );
}

export default function KontrollplanLese() {
  const { t } = useTranslation();
  const { valgtBygningId, settBygning } = useByggeplass();
  const router = useRouter();
  const queryClient = useQueryClient();

  const planQuery = trpc.kontrollplan.hentForByggeplass.useQuery(
    { byggeplassId: valgtBygningId! },
    { enabled: !!valgtBygningId },
  );

  const plan = planQuery.data as KontrollplanData | null | undefined;
  const harPunkter = !!plan && plan.punkter.length > 0;

  // Er gjeldende byggeplass tom? Finn om punktene ligger på en annen byggeplass i
  // prosjektet — skiller «ingen punkter på prosjektet» fra «ligger på X» (med hopp).
  const andreQuery = trpc.kontrollplan.andreByggeplasserMedPunkter.useQuery(
    { byggeplassId: valgtBygningId! },
    { enabled: !!valgtBygningId && !planQuery.isLoading && !harPunkter },
  );
  const andrePlasser = andreQuery.data ?? [];

  // Grupper punkter på milepæl (rekkefølge fra milepeler-lista, deretter «uten»).
  const grupper = useMemo(() => {
    if (!plan) return [];
    const perMilepel = new Map<string | null, PunktRad[]>();
    for (const p of plan.punkter) {
      const key = p.milepelId ?? null;
      const liste = perMilepel.get(key) ?? [];
      liste.push(p);
      perMilepel.set(key, liste);
    }
    const rekker: { id: string | null; navn: string; punkter: PunktRad[] }[] = [];
    for (const m of plan.milepeler) {
      const punkter = perMilepel.get(m.id);
      if (punkter && punkter.length > 0) rekker.push({ id: m.id, navn: m.navn, punkter });
    }
    const utenMilepel = perMilepel.get(null);
    if (utenMilepel && utenMilepel.length > 0) {
      rekker.push({ id: null, navn: t("kontrollplan.utenMilepel"), punkter: utenMilepel });
    }
    return rekker;
  }, [plan, t]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center bg-sitedoc-blue px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#ffffff" />
        </Pressable>
        <Text className="ml-3 text-lg font-semibold text-white">
          {t("kontrollplan.tittel")}
        </Text>
      </View>

      {/* Global byggeplass — kontrollplan er per byggeplass */}
      <ByggeplassChip />

      {!valgtBygningId ? (
        <View className="flex-1 items-center justify-center px-8">
          <MapPin size={32} color="#9ca3af" />
          <Text className="mt-3 text-center text-base text-gray-500">
            {t("kontrollplan.velgByggeplass")}
          </Text>
        </View>
      ) : planQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
          <Text className="mt-3 text-sm text-gray-500">{t("handling.laster")}</Text>
        </View>
      ) : !harPunkter ? (
        andreQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1e40af" />
          </View>
        ) : andrePlasser.length > 0 ? (
          // Tom byggeplass, men punktene ligger på en annen — vis hopp-til-handling.
          <View className="flex-1 px-6 pt-10">
            <View className="items-center">
              <MapPin size={32} color="#9ca3af" />
              <Text className="mt-3 text-center text-base font-medium text-gray-700">
                {t("kontrollplan.ingenPunkterByggeplass")}
              </Text>
              <Text className="mt-1 text-center text-sm text-gray-500">
                {t("kontrollplan.punkterPaaAnnenByggeplass")}
              </Text>
            </View>
            <View className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {andrePlasser.map((b) => (
                <Pressable
                  key={b.byggeplassId}
                  onPress={() => settBygning(b.byggeplassId)}
                  className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3 active:bg-gray-50"
                >
                  <View className="flex-row items-center gap-2">
                    <MapPin size={16} color="#1e40af" />
                    <Text className="text-base font-medium text-gray-900">{b.navn}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <View className="rounded-full bg-blue-50 px-2 py-0.5">
                      <Text className="text-xs font-semibold text-sitedoc-blue">{b.antall}</Text>
                    </View>
                    <ChevronRight size={18} color="#9ca3af" />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          // Ingen byggeplass i prosjektet har punkter — dagens tekst er riktig her.
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-base text-gray-500">
              {t("kontrollplan.ingenPunkter")}
            </Text>
          </View>
        )
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={planQuery.isRefetching}
              onRefresh={() => queryClient.invalidateQueries()}
            />
          }
        >
          {/* Plan-tittel + status */}
          <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
            <Text className="flex-1 pr-2 text-base font-semibold text-gray-900" numberOfLines={1}>
              {plan.navn}
            </Text>
            <StatusBadge
              noekkel={PLAN_STATUS[plan.status] ?? plan.status}
              bg="bg-blue-50"
              tekstFarge="text-sitedoc-blue"
            />
          </View>

          {grupper.map((g) => (
            <View key={g.id ?? "uten"}>
              <View className="bg-gray-100 px-4 py-2">
                <Text className="text-xs font-semibold uppercase text-gray-500">
                  {g.navn}
                </Text>
              </View>
              {g.punkter.map((p) => (
                <PunktKort key={p.id} punkt={p} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
