import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
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
import { MalVelger } from "../../src/components/MalVelger";
import { OpprettDokumentModal } from "../../src/components/OpprettDokumentModal";
import { ByggeplassChip } from "../../src/components/ByggeplassChip";

// i18n-nøkler (data utenfor komponent → labelKey, t() ved rendering)
const PRIORITETS_NOKKEL: Record<string, string> = {
  low: "prioritet.lav",
  medium: "prioritet.middels",
  high: "prioritet.hoey",
  critical: "prioritet.kritisk",
};

const PRIORITETS_FARGE: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-blue-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

interface MalData {
  id: string;
  name: string;
  prefix: string | null;
  category: string;
  // Flytresolusjon: bæres fra mal-lista til opprett-modalen (delt opprett-regel).
  opprettbareFlytIder?: string[];
}

// Cast-type for å unngå TS2589 (excessively deep type instantiation)
interface OppgaveRad {
  id: string;
  title: string;
  status: string;
  priority: string;
  number?: number | null;
  description: string | null;
  dueDate: Date | string | null;
  updatedAt: Date | string;
  createdAt: Date | string;
  template?: { name: string; prefix?: string | null } | null;
  bestillerFaggruppe?: { name: string } | null;
  utforerFaggruppe?: { name: string } | null;
  creator?: { name: string | null } | null;
}

function formaterNummer(prefix: string | null | undefined, nummer: number | null | undefined): string | null {
  if (!prefix || nummer == null) return null;
  return `${prefix}${nummer}`;
}

export default function OppgaveListe() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [visVelger, settVisVelger] = useState(false);
  const [valgtMal, settValgtMal] = useState<MalData | null>(null);
  const [statusFilter, settStatusFilter] = useState<string | null>(null);

  // Byggeplass serverside via global aktiv byggeplass (myk filter). Status klientside.
  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId!, byggeplassId: valgtBygningId ?? undefined },
    { enabled: !!valgtProsjektId },
  );

  const oppgaver = oppgaveQuery.data as OppgaveRad[] | undefined;

  const tilgjengeligeStatuser = useMemo(
    () => Array.from(new Set((oppgaver ?? []).map((o) => o.status))),
    [oppgaver],
  );

  const effektivStatus =
    statusFilter && tilgjengeligeStatuser.includes(statusFilter) ? statusFilter : null;

  const synlige = useMemo(
    () =>
      effektivStatus
        ? (oppgaver ?? []).filter((o) => o.status === effektivStatus)
        : oppgaver ?? [],
    [oppgaver, effektivStatus],
  );

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const renderElement = useCallback(
    ({ item }: { item: OppgaveRad }) => {
      const nummer = formaterNummer(item.template?.prefix, item.number);
      const undertekst = [
        item.utforerFaggruppe?.name,
        item.dueDate
          ? new Date(item.dueDate).toLocaleDateString("nb-NO", {
              day: "numeric",
              month: "short",
            })
          : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return (
        <Pressable
          onPress={() => {
            router.push(`/oppgave/${item.id}`);
          }}
          className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3"
        >
          <View className="flex-1">
            <Text className="text-sm text-gray-900" numberOfLines={1}>
              {nummer ? <Text className="font-bold">{nummer} </Text> : null}{item.title}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-2">
              <Text className={`text-xs font-medium ${PRIORITETS_FARGE[item.priority] ?? "text-gray-500"}`}>
                {PRIORITETS_NOKKEL[item.priority] ? t(PRIORITETS_NOKKEL[item.priority]) : item.priority}
              </Text>
              {undertekst ? (
                <Text className="text-xs text-gray-500" numberOfLines={1}>
                  · {undertekst}
                </Text>
              ) : null}
            </View>
          </View>
          <StatusMerkelapp status={item.status} />
        </Pressable>
      );
    },
    [router, t],
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={22} color="#ffffff" />
          </Pressable>
          <Text className="ml-3 text-lg font-semibold text-white">
            {t("nav.oppgaver")}
          </Text>
        </View>
        <Pressable onPress={() => settVisVelger(true)} hitSlop={12}>
          <Plus size={24} color="#ffffff" />
        </Pressable>
      </View>

      {/* F2: global byggeplass-chip (filtrerer lista serverside) */}
      <ByggeplassChip />

      {/* Status-filter — kun statuser som finnes i lista */}
      <StatusFilterRad
        statuser={tilgjengeligeStatuser}
        valgt={effektivStatus}
        onVelg={settStatusFilter}
      />

      {oppgaveQuery.isLoading ? (
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
            <RefreshControl
              refreshing={oppgaveQuery.isRefetching}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={
            <View className="items-center px-4 pt-20">
              <Text className="text-base text-gray-500">
                {effektivStatus ? t("tom.ingenMatcherFilter") : t("tom.ingenOppgaver")}
              </Text>
            </View>
          }
        />
      )}

      {/* Malvelger */}
      <MalVelger
        synlig={visVelger && !valgtMal}
        kategori="oppgave"
        onVelg={(mal) => {
          settVisVelger(false);
          settValgtMal(mal);
        }}
        onLukk={() => settVisVelger(false)}
      />

      {/* Opprett oppgave */}
      <OpprettDokumentModal
        synlig={!!valgtMal}
        kategori="oppgave"
        mal={valgtMal ?? { id: "", name: "", prefix: null, category: "" }}
        onOpprettet={(id) => {
          settValgtMal(null);
          queryClient.invalidateQueries();
          router.push(`/oppgave/${id}`);
        }}
        onLukk={() => settValgtMal(null)}
      />
    </SafeAreaView>
  );
}
