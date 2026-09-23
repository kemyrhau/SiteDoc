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
import { ArrowLeft, Plus, Scale } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { StatusMerkelapp } from "../../src/components/StatusMerkelapp";
import { StatusFilterRad } from "../../src/components/StatusFilterRad";
import { OpprettVelger } from "../../src/components/OpprettVelger";
import { ByggeplassChip } from "../../src/components/ByggeplassChip";
import { formaterNummer } from "../../src/components/dokumentliste/DokumentRadHjelpere";

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
  // subdomain følger med tRPC-svaret (oppgave.ts bruker `include` på template). Kun lest
  // for kontraktssak-markering — mobil oppgaveliste er online-only, ingen lokal mirror/kolonne.
  template?: { name: string; prefix?: string | null; subdomain?: string | null } | null;
  bestillerFaggruppe?: { name: string } | null;
  utforerFaggruppe?: { name: string } | null;
  creator?: { name: string | null } | null;
}

export default function OppgaveListe() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [visVelger, settVisVelger] = useState(false);
  const [statusFilter, settStatusFilter] = useState<string | null>(null);
  // Kontraktssak-segment (tavle 4): økt-tilstand, ikke lokal DB.
  const [segment, settSegment] = useState<"alle" | "oppgaver" | "kontrakt">("alle");

  // Byggeplass serverside via global aktiv byggeplass (myk filter). Status klientside.
  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId!, byggeplassId: valgtBygningId ?? undefined },
    { enabled: !!valgtProsjektId },
  );

  const oppgaver = oppgaveQuery.data as OppgaveRad[] | undefined;

  // Kontraktssak-segment vises kun når prosjektet har minst én kontraktssak-mal (samme
  // vilkår som web). Egen lett mal-query — lista bruker MalVelger for oppretting, ikke maler direkte.
  const malQuery = trpc.mal.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const harKontraktMal = ((malQuery.data ?? []) as Array<{ subdomain?: string | null }>).some(
    (m) => m.subdomain === "kontrakt",
  );

  const tilgjengeligeStatuser = useMemo(
    () => Array.from(new Set((oppgaver ?? []).map((o) => o.status))),
    [oppgaver],
  );

  const effektivStatus =
    statusFilter && tilgjengeligeStatuser.includes(statusFilter) ? statusFilter : null;

  // Status-filtrert sett — grunnlaget for både segment-tall og segment-filtrering.
  const statusFiltrert = useMemo(
    () =>
      effektivStatus
        ? (oppgaver ?? []).filter((o) => o.status === effektivStatus)
        : oppgaver ?? [],
    [oppgaver, effektivStatus],
  );
  const erKontraktRad = (o: OppgaveRad) => o.template?.subdomain === "kontrakt";
  const antKontrakt = useMemo(() => statusFiltrert.filter(erKontraktRad).length, [statusFiltrert]);
  const synlige = useMemo(() => {
    if (segment === "kontrakt") return statusFiltrert.filter(erKontraktRad);
    if (segment === "oppgaver") return statusFiltrert.filter((o) => !erKontraktRad(o));
    return statusFiltrert;
  }, [statusFiltrert, segment]);

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
            <View className="flex-row items-center gap-1">
              {/* Kontraktssak (tavle 4): ⚖ Scale 14pt foran dokumentnummeret. */}
              {erKontraktRad(item) && <Scale size={14} color="#374151" />}
              <Text className="flex-1 text-sm text-gray-900" numberOfLines={1}>
                {nummer ? <Text className="font-bold">{nummer} </Text> : null}{item.title}
              </Text>
            </View>
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

      {/* Kontraktssak-segment (tavle 4): chip-rad Alle · Oppgaver · Kontrakt. Vises kun når
          prosjektet har en kontraktssak-mal. Tallene er antall etter status-filteret. */}
      {harKontraktMal && (
        <View className="flex-row gap-2 bg-gray-50 px-4 py-2" accessibilityRole="tablist">
          {([
            { id: "alle", navn: t("dokumentklasse.alle"), antall: statusFiltrert.length, ikon: false },
            { id: "oppgaver", navn: t("dokumentklasse.oppgaver"), antall: statusFiltrert.length - antKontrakt, ikon: false },
            { id: "kontrakt", navn: t("dokumentklasse.kontraktKort"), antall: antKontrakt, ikon: true },
          ] as const).map((s) => {
            const aktiv = segment === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => settSegment(s.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: aktiv }}
                className={`min-h-9 flex-row items-center gap-1 rounded-full border px-3 py-1.5 ${
                  aktiv ? "border-sitedoc-blue bg-blue-50" : "border-gray-200 bg-white"
                }`}
              >
                {s.ikon && <Scale size={13} color={aktiv ? "#1e40af" : "#6b7280"} />}
                <Text className={`text-xs font-medium ${aktiv ? "text-sitedoc-blue" : "text-gray-600"}`}>
                  {s.navn} ({s.antall})
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

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
      {/* Opprett oppgave — gruppert velger, oppretter direkte (server utleder faggruppe). */}
      <OpprettVelger
        synlig={visVelger}
        kategori="oppgave"
        onOpprettet={(id) => {
          settVisVelger(false);
          queryClient.invalidateQueries();
          router.push(`/oppgave/${id}`);
        }}
        onLukk={() => settVisVelger(false)}
      />
    </SafeAreaView>
  );
}
