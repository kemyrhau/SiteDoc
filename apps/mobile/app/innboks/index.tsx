import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ClipboardCheck,
  ListTodo,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { StatusMerkelapp } from "../../src/components/StatusMerkelapp";
import { StatusFilterRad } from "../../src/components/StatusFilterRad";
import { ByggeplassChip } from "../../src/components/ByggeplassChip";
import { FilterOgSorteringSheet } from "../../src/components/dokumentliste/FilterOgSorteringSheet";
import {
  MedUtheving,
  formaterNummer,
} from "../../src/components/dokumentliste/DokumentRadHjelpere";
import {
  antallAktiveFilter,
  byggAlternativer,
  filtrerOgSorter,
  FILTER_KOLONNER,
  type DokumentRad,
  type Sortering,
} from "../../src/components/dokumentliste/dokumentlisteFilter";

// Samme definisjon av «aktivt» som hjem-innboksen (hjem.tsx). Endres den, endres
// begge fra samme sted — denne skjermen ER hjem-innboksen utfoldet.
const AKTIVE_STATUSER = ["sent", "received", "in_progress"];

type DokType = "sjekkliste" | "oppgave";

export default function InnboksListe() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [statusFilter, settStatusFilter] = useState<string | null>(null);
  const [søkeAktiv, settSøkeAktiv] = useState(false);
  const [søketekst, settSøketekst] = useState("");
  const [filterVerdier, settFilterVerdier] = useState<Record<string, string>>({});
  const [sortering, settSortering] = useState<Sortering>("nyeste");
  const [visSheet, settVisSheet] = useState(false);

  useEffect(() => {
    // Prosjektbytte nullstiller søk/filter/sortering (fabel-designlås pkt 6).
    settSøkeAktiv(false);
    settSøketekst("");
    settFilterVerdier({});
    settSortering("nyeste");
    settStatusFilter(null);
  }, [valgtProsjektId]);

  const søkerNaa = søkeAktiv && søketekst.trim().length > 0;

  // Gjenbruker de to eksisterende per-type-kallene (som hjem-innboksen) — ingen
  // eget endepunkt. Under søk droppes byggeplass for sjekklister så hele
  // prosjektet treffes (speiler sjekkliste/index.tsx). Oppgaver er ikke
  // byggeplass-scopet i hjem-innboksen, så heller ikke her.
  const sjekklisteQuery = trpc.sjekkliste.hentForProsjekt.useQuery(
    {
      projectId: valgtProsjektId!,
      byggeplassId: søkerNaa ? undefined : valgtBygningId ?? undefined,
    },
    { enabled: !!valgtProsjektId },
  );
  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const sjekklister = sjekklisteQuery.data as DokumentRad[] | undefined;
  const oppgaver = oppgaveQuery.data as DokumentRad[] | undefined;

  // Slå sammen til én aktiv liste + hold en id→type-oppslag for rad-ikonet
  // (filtrerOgSorter returnerer DokumentRad[] og bærer ikke typen videre).
  const { aktive, typeMap } = useMemo(() => {
    const map = new Map<string, DokType>();
    const rader: DokumentRad[] = [];
    for (const s of sjekklister ?? []) {
      if (!AKTIVE_STATUSER.includes(s.status)) continue;
      map.set(s.id, "sjekkliste");
      rader.push(s);
    }
    for (const o of oppgaver ?? []) {
      if (!AKTIVE_STATUSER.includes(o.status)) continue;
      map.set(o.id, "oppgave");
      rader.push(o);
    }
    return { aktive: rader, typeMap: map };
  }, [sjekklister, oppgaver]);

  const tilgjengeligeStatuser = useMemo(
    () => Array.from(new Set(aktive.map((r) => r.status))),
    [aktive],
  );
  const effektivStatus =
    statusFilter && tilgjengeligeStatuser.includes(statusFilter) ? statusFilter : null;

  const alternativer = useMemo(() => byggAlternativer(aktive), [aktive]);

  const etterStatus = useMemo(
    () => (effektivStatus ? aktive.filter((r) => r.status === effektivStatus) : aktive),
    [aktive, effektivStatus],
  );

  const synlige = useMemo(
    () => filtrerOgSorter(etterStatus, filterVerdier, søkerNaa ? søketekst : "", sortering),
    [etterStatus, filterVerdier, søkerNaa, søketekst, sortering],
  );

  const antallFilter = antallAktiveFilter(filterVerdier);
  const totalt = aktive.length;
  const laster = sjekklisteQuery.isLoading || oppgaveQuery.isLoading;
  const refresher = sjekklisteQuery.isRefetching || oppgaveQuery.isRefetching;

  const søkeTokens = useMemo(
    () => (søkerNaa ? søketekst.trim().split(/\s+/).filter((tk) => tk.length >= 2) : []),
    [søkerNaa, søketekst],
  );

  const aktiveChips = useMemo(() => {
    const chips: { kolId: string; value: string; label: string }[] = [];
    for (const kolId of FILTER_KOLONNER) {
      const v = filterVerdier[kolId];
      if (!v) continue;
      for (const del of v.split(",").filter(Boolean)) {
        const label =
          kolId === "frist"
            ? t(
                del === "forfalt"
                  ? "dokumentsok.fristForfalt"
                  : del === "har_frist"
                    ? "dokumentsok.fristHarFrist"
                    : "dokumentsok.fristIngenFrist",
              )
            : del;
        chips.push({ kolId, value: del, label });
      }
    }
    return chips;
  }, [filterVerdier, t]);

  const settFilter = useCallback((kolId: string, verdi: string) => {
    settFilterVerdier((forrige) => {
      const neste = { ...forrige };
      if (verdi) neste[kolId] = verdi;
      else delete neste[kolId];
      return neste;
    });
  }, []);

  const fjernChip = useCallback((kolId: string, value: string) => {
    settFilterVerdier((forrige) => {
      const gjenvaerende = (forrige[kolId] ?? "").split(",").filter((x) => x && x !== value);
      const neste = { ...forrige };
      if (gjenvaerende.length) neste[kolId] = gjenvaerende.join(",");
      else delete neste[kolId];
      return neste;
    });
  }, []);

  const nullstillFilter = useCallback(() => settFilterVerdier({}), []);

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const renderElement = useCallback(
    ({ item }: { item: DokumentRad }) => {
      const type = typeMap.get(item.id) ?? "sjekkliste";
      const nummer = formaterNummer(item.template?.prefix, item.number);
      const undertekst = [
        item.template?.name === item.title ? null : item.template?.name,
        item.utforerFaggruppe?.name,
      ]
        .filter(Boolean)
        .join(" · ");

      return (
        <Pressable
          onPress={() =>
            router.push(type === "oppgave" ? `/oppgave/${item.id}` : `/sjekkliste/${item.id}`)
          }
          className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3"
        >
          <View className="mr-3">
            {type === "sjekkliste" ? (
              <ClipboardCheck size={18} color="#6b7280" />
            ) : (
              <ListTodo size={18} color="#6b7280" />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row">
              {nummer ? <Text className="text-sm font-bold text-gray-900">{nummer} </Text> : null}
              <MedUtheving tekst={item.title} tokens={søkeTokens} className="flex-1 text-sm text-gray-900" />
            </View>
            {undertekst ? (
              <MedUtheving tekst={undertekst} tokens={søkeTokens} className="mt-0.5 text-xs text-gray-500" />
            ) : null}
          </View>
          <StatusMerkelapp status={item.status} />
        </Pressable>
      );
    },
    [router, typeMap, søkeTokens],
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header — søkefeltet ERSTATTER header-raden (samme mønster som sjekklistelista). */}
      {søkeAktiv ? (
        <View className="flex-row items-center gap-2 bg-sitedoc-blue px-4 py-2.5">
          <View className="flex-1 flex-row items-center rounded-lg bg-white px-3 py-2">
            <Search size={16} color="#9ca3af" />
            <TextInput
              value={søketekst}
              onChangeText={settSøketekst}
              placeholder={t("dokumentsok.sokPlaceholder")}
              placeholderTextColor="#9ca3af"
              className="ml-2 flex-1 py-0 text-sm text-gray-900"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          <Pressable onPress={() => { settSøkeAktiv(false); settSøketekst(""); }} hitSlop={10}>
            <Text className="text-sm text-white">{t("handling.avbryt")}</Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
          <View className="flex-row items-center">
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <ArrowLeft size={22} color="#ffffff" />
            </Pressable>
            <Text className="ml-3 text-lg font-semibold text-white">{t("nav.innboks")}</Text>
          </View>
          <Pressable onPress={() => settSøkeAktiv(true)} hitSlop={12}>
            <Search size={22} color="#ffffff" />
          </Pressable>
        </View>
      )}

      {/* Global byggeplass-chip — skjules under søk (søk treffer hele prosjektet). */}
      {!søkerNaa && <ByggeplassChip />}

      {/* Status-trakt (chips) + filter-trakt. */}
      <View className="flex-row items-center border-b border-gray-100 bg-white">
        <View className="flex-1">
          <StatusFilterRad
            statuser={tilgjengeligeStatuser}
            valgt={effektivStatus}
            onVelg={settStatusFilter}
          />
        </View>
        <Pressable
          onPress={() => settVisSheet(true)}
          hitSlop={8}
          className={`mr-3 flex-row items-center gap-1 rounded-full px-3 py-1.5 ${
            antallFilter > 0 ? "bg-sitedoc-primary" : "border border-gray-300"
          }`}
        >
          <SlidersHorizontal size={14} color={antallFilter > 0 ? "#ffffff" : "#374151"} />
          {antallFilter > 0 && (
            <Text className="text-xs font-semibold text-white">{antallFilter}</Text>
          )}
        </Pressable>
      </View>

      {/* Fjernbare filter-chips + «Viser N av M». */}
      {antallFilter > 0 && (
        <View className="border-b border-gray-100 bg-white px-4 py-2">
          <View className="flex-row flex-wrap gap-1.5">
            {aktiveChips.map((chip) => (
              <Pressable
                key={`${chip.kolId}:${chip.value}`}
                onPress={() => fjernChip(chip.kolId, chip.value)}
                className="flex-row items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1"
              >
                <Text className="text-xs font-medium text-sitedoc-primary">{chip.label}</Text>
                <X size={12} color="#1e40af" />
              </Pressable>
            ))}
          </View>
          <Text className="mt-1.5 text-xs text-gray-500">
            {t("dokumentsok.viserAvTotalt", { synlige: synlige.length, totalt })}
            {" — "}
            <Text className="font-semibold text-sitedoc-primary" onPress={nullstillFilter}>
              {t("dokumentsok.nullstillFilter")}
            </Text>
          </Text>
        </View>
      )}

      {laster ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
          <Text className="mt-3 text-sm text-gray-500">{t("handling.laster")}</Text>
        </View>
      ) : (
        <FlatList
          data={synlige}
          keyExtractor={(item) => item.id}
          renderItem={renderElement}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refresher} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="items-center px-4 pt-20">
              <Text className="text-base text-gray-500">
                {søkerNaa
                  ? t("dokumentsok.ingenTreff")
                  : effektivStatus || antallFilter > 0
                    ? t("tom.ingenMatcherFilter")
                    : t("hjem.ingenInnboks")}
              </Text>
            </View>
          }
        />
      )}

      <FilterOgSorteringSheet
        synlig={visSheet}
        alternativer={alternativer}
        filterVerdier={filterVerdier}
        sortering={sortering}
        antallTreff={synlige.length}
        onSettFilter={settFilter}
        onSettSortering={settSortering}
        onNullstill={nullstillFilter}
        onLukk={() => settVisSheet(false)}
      />
    </SafeAreaView>
  );
}
