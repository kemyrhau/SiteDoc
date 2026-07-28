import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { StatusMerkelapp } from "../../src/components/StatusMerkelapp";
import { StatusFilterRad } from "../../src/components/StatusFilterRad";
import { ByggeplassChip } from "../../src/components/ByggeplassChip";
import { HmsMalVelger, type HmsMal, type HmsSubdomain } from "../../src/components/HmsMalVelger";

const FANER: HmsSubdomain[] = ["avvik", "sja", "ruh"];

// Cast-type for å unngå TS2589 (excessively deep type instantiation)
interface HmsRad {
  id: string;
  title: string;
  status: string;
  number?: number | null;
  updatedAt: Date | string;
  template?: { name: string; prefix?: string | null } | null;
  bestillerFaggruppe?: { name: string } | null;
}

interface HmsDokumenter {
  avvik: HmsRad[];
  sja: HmsRad[];
  ruh: HmsRad[];
}

function formaterNummer(prefix: string | null | undefined, nummer: number | null | undefined): string | null {
  if (!prefix || nummer == null) return null;
  return `${prefix}${nummer}`;
}

export default function HmsListe() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [fane, settFane] = useState<HmsSubdomain>("avvik");
  const [statusFilter, settStatusFilter] = useState<string | null>(null);
  const [visMalVelger, settVisMalVelger] = useState(false);

  // Byggeplass serverside via global aktiv byggeplass. Fane + status klientside.
  const dokQuery = trpc.hms.hentDokumenter.useQuery(
    { projectId: valgtProsjektId!, byggeplassId: valgtBygningId ?? undefined },
    { enabled: !!valgtProsjektId },
  );

  const dok = dokQuery.data as HmsDokumenter | undefined;

  const aktivListe = useMemo<HmsRad[]>(() => {
    if (!dok) return [];
    return dok[fane] ?? [];
  }, [dok, fane]);

  const tilgjengeligeStatuser = useMemo(
    () => Array.from(new Set(aktivListe.map((d) => d.status))),
    [aktivListe],
  );

  const effektivStatus =
    statusFilter && tilgjengeligeStatuser.includes(statusFilter) ? statusFilter : null;

  const synlige = useMemo(
    () => (effektivStatus ? aktivListe.filter((d) => d.status === effektivStatus) : aktivListe),
    [aktivListe, effektivStatus],
  );

  const opprettOppgave = trpc.oppgave.opprett.useMutation({
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries();
      router.push(`/oppgave/${(data as { id: string }).id}`);
    },
    onError: (feil: { message?: string }) => {
      Alert.alert(t("felles.ukjentFeil"), feil.message ?? "");
    },
  });

  const opprettSjekkliste = trpc.sjekkliste.opprett.useMutation({
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries();
      router.push(`/sjekkliste/${(data as { id: string }).id}`);
    },
    onError: (feil: { message?: string }) => {
      Alert.alert(t("felles.ukjentFeil"), feil.message ?? "");
    },
  });

  // HMS-opprett: subdomain avstyrer tabell (avvik/RUH=oppgave, SJA=sjekkliste).
  // Ingen faggruppe — serveren auto-ruter HMS-dokumenter (speiler web).
  const håndterMal = useCallback(
    (mal: HmsMal) => {
      settVisMalVelger(false);
      if (mal.subdomain === "sja") {
        opprettSjekkliste.mutate({ templateId: mal.id, title: mal.name });
      } else {
        opprettOppgave.mutate({ templateId: mal.id, title: mal.name });
      }
    },
    [opprettOppgave, opprettSjekkliste],
  );

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const renderElement = useCallback(
    ({ item }: { item: HmsRad }) => {
      const nummer = formaterNummer(item.template?.prefix, item.number);
      const undertekst = [item.template?.name, item.bestillerFaggruppe?.name]
        .filter(Boolean)
        .join(" · ");
      // SJA er sjekkliste, avvik/RUH er oppgave.
      const rute = fane === "sja" ? "sjekkliste" : "oppgave";

      return (
        <Pressable
          onPress={() => router.push(`/${rute}/${item.id}`)}
          className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3"
        >
          <View className="flex-1 pr-2">
            <Text className="text-sm text-gray-900" numberOfLines={1}>
              {nummer ? <Text className="font-bold">{nummer} </Text> : null}
              {item.title}
            </Text>
            {undertekst ? (
              <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                {undertekst}
              </Text>
            ) : null}
          </View>
          <StatusMerkelapp status={item.status} />
        </Pressable>
      );
    },
    [router, fane],
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={22} color="#ffffff" />
          </Pressable>
          <Text className="ml-3 text-lg font-semibold text-white">{t("hms.tittel")}</Text>
        </View>
        <Pressable onPress={() => settVisMalVelger(true)} hitSlop={12}>
          <Plus size={24} color="#ffffff" />
        </Pressable>
      </View>

      {/* Global byggeplass-chip (filtrerer lista serverside) */}
      <ByggeplassChip />

      {/* Subdomain-faner */}
      <View className="flex-row gap-2 border-b border-gray-200 bg-white px-4 py-2">
        {FANER.map((f) => {
          const aktiv = fane === f;
          return (
            <Pressable
              key={f}
              onPress={() => {
                settFane(f);
                settStatusFilter(null);
              }}
              className={`min-h-[44px] flex-1 items-center justify-center rounded ${
                aktiv ? "bg-sitedoc-blue" : "bg-gray-100"
              }`}
            >
              <Text
                className={`text-sm font-medium ${aktiv ? "text-white" : "text-gray-700"}`}
              >
                {t(`hms.tabs.${f}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Status-filter — kun statuser som finnes i aktiv fane */}
      <StatusFilterRad
        statuser={tilgjengeligeStatuser}
        valgt={effektivStatus}
        onVelg={settStatusFilter}
      />

      {dokQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
          <Text className="mt-3 text-sm text-gray-500">{t("handling.laster")}</Text>
        </View>
      ) : (
        <FlatList
          data={synlige}
          keyExtractor={(item) => item.id}
          renderItem={renderElement}
          refreshControl={
            <RefreshControl refreshing={dokQuery.isRefetching} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center px-8 pt-20">
              <Text className="text-base text-gray-500">
                {effektivStatus ? t("tom.ingenMatcherFilter") : t(`hms.tom.${fane}`)}
              </Text>
              {!effektivStatus ? (
                <Text className="mt-1 text-center text-sm text-gray-400">
                  {t(`hms.tom.${fane}Beskrivelse`)}
                </Text>
              ) : null}
            </View>
          }
        />
      )}

      <HmsMalVelger
        synlig={visMalVelger}
        onVelg={håndterMal}
        onLukk={() => settVisMalVelger(false)}
      />
    </SafeAreaView>
  );
}
