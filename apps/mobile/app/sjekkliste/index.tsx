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
import { ArrowLeft, Plus, Search, SlidersHorizontal, WifiOff, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { velgOfflineListeKilde } from "@sitedoc/shared";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { useNettverk } from "../../src/providers/NettverkProvider";
import {
  hentSjekklisterLokalt,
  hentSistOppdatertLokalt,
} from "../../src/services/sjekklisteKatalog";
import { StatusMerkelapp } from "../../src/components/StatusMerkelapp";
import { StatusFilterRad } from "../../src/components/StatusFilterRad";
import { MalVelger } from "../../src/components/MalVelger";
import { OpprettDokumentModal } from "../../src/components/OpprettDokumentModal";
import { ByggeplassChip } from "../../src/components/ByggeplassChip";
import { FilterOgSorteringSheet } from "../../src/components/dokumentliste/FilterOgSorteringSheet";
import {
  antallAktiveFilter,
  byggAlternativer,
  filtrerOgSorter,
  FILTER_KOLONNER,
  type DokumentRad,
  type Sortering,
} from "../../src/components/dokumentliste/dokumentlisteFilter";
import { MedUtheving, formaterNummer } from "../../src/components/dokumentliste/DokumentRadHjelpere";

/** «Sist hentet»-tidspunkt (Unix ms) → «dd.mm.åååå kl. hh:mm» (offline-banner). */
function formaterTidspunkt(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} kl. ${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface MalData {
  id: string;
  name: string;
  prefix: string | null;
  category: string;
  opprettbareFlytIder?: string[];
}

export default function SjekklisteListe() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const { erPaaNettet } = useNettverk();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [visVelger, settVisVelger] = useState(false);
  const [valgtMal, settValgtMal] = useState<MalData | null>(null);
  const [statusFilter, settStatusFilter] = useState<string | null>(null);

  // Dokumentsøk + filter + sortering (dokumentliste-nivå-tilstand). Overlever
  // navigasjon inn/ut av et dokument (skjermen forblir montert i stacken);
  // nullstilles ved prosjektbytte (effekt under).
  const [søkeAktiv, settSøkeAktiv] = useState(false);
  const [søketekst, settSøketekst] = useState("");
  const [filterVerdier, settFilterVerdier] = useState<Record<string, string>>({});
  const [sortering, settSortering] = useState<Sortering>("nyeste");
  const [visSheet, settVisSheet] = useState(false);

  useEffect(() => {
    // Bytte av prosjekt nullstiller søk/filter/sortering (fabel-designlås pkt 6).
    settSøkeAktiv(false);
    settSøketekst("");
    settFilterVerdier({});
    settSortering("nyeste");
    settStatusFilter(null);
  }, [valgtProsjektId]);

  const søkerNaa = søkeAktiv && søketekst.trim().length > 0;

  // Søk overstyrer byggeplassfilteret: søker man, hentes HELE prosjektet så et
  // dokument aldri er usynlig pga. valgt kontekst (fabel-designlås pkt 3).
  const sjekklisteQuery = trpc.sjekkliste.hentForProsjekt.useQuery(
    {
      projectId: valgtProsjektId!,
      byggeplassId: søkerNaa ? undefined : valgtBygningId ?? undefined,
    },
    { enabled: !!valgtProsjektId },
  );

  // Offline-lesing (Offline-sjekklister fase 1, 2026-09-11). MED nett og et
  // bekreftet server-svar er serveren autoritativ — like fersk som før (krav 6
  // rad 1); lokal lesing er KUN fallback (offline / henger / feilet). Lokal
  // scope speiler server-spørringens byggeplass-scope (samme byggeplassId).
  const effektivBygg = søkerNaa ? undefined : valgtBygningId ?? undefined;
  const serverData = sjekklisteQuery.data as DokumentRad[] | undefined;

  const lokaleRader = useMemo(
    () =>
      valgtProsjektId
        ? (hentSjekklisterLokalt(valgtProsjektId, effektivBygg) as DokumentRad[])
        : [],
    // Re-les lokal cache når prosjekt/byggeplass endres eller server-svaret
    // settler (etter en fei kan cachen ha nye rader).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valgtProsjektId, effektivBygg, sjekklisteQuery.status],
  );

  const { kilde, tilstand } = velgOfflineListeKilde({
    erPaaNettet,
    serverBekreftet: sjekklisteQuery.isSuccess,
    serverAntall: serverData?.length ?? 0,
    lokalAntall: lokaleRader.length,
  });

  const sjekklister = kilde === "server" ? serverData : lokaleRader;

  // «Sist hentet»-tid for dette PROSJEKTET (krav 7) — kun relevant når vi viser
  // lokale rader. Prosjektets eget stempel, ikke et globalt fei-tidspunkt.
  const sistHentet = useMemo(
    () =>
      tilstand === "lokal" && valgtProsjektId
        ? hentSistOppdatertLokalt(valgtProsjektId)
        : null,
    [tilstand, valgtProsjektId, lokaleRader.length],
  );

  const tilgjengeligeStatuser = useMemo(
    () => Array.from(new Set((sjekklister ?? []).map((s) => s.status))),
    [sjekklister],
  );
  const effektivStatus =
    statusFilter && tilgjengeligeStatuser.includes(statusFilter) ? statusFilter : null;

  // Alternativer bygges fra HELE (status-uavhengige) lista — så et nedtrekk aldri
  // skjuler et valg som finnes (målt: mobil henter hele lista, ingen paginering).
  const alternativer = useMemo(() => byggAlternativer(sjekklister ?? []), [sjekklister]);

  const etterStatus = useMemo(
    () =>
      effektivStatus
        ? (sjekklister ?? []).filter((s) => s.status === effektivStatus)
        : sjekklister ?? [],
    [sjekklister, effektivStatus],
  );

  const synlige = useMemo(
    () => filtrerOgSorter(etterStatus, filterVerdier, søkerNaa ? søketekst : "", sortering),
    [etterStatus, filterVerdier, søkerNaa, søketekst, sortering],
  );

  const antallFilter = antallAktiveFilter(filterVerdier);
  const totalt = sjekklister?.length ?? 0;

  const søkeTokens = useMemo(
    () => (søkerNaa ? søketekst.trim().split(/\s+/).filter((tk) => tk.length >= 2) : []),
    [søkerNaa, søketekst],
  );

  // Fjernbare filter-chips over lista (fabel-designlås pkt 6).
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
      const nummer = formaterNummer(item.template?.prefix, item.number);
      const undertekst = [
        item.template?.name === item.title ? null : item.template?.name,
        item.utforerFaggruppe?.name,
      ]
        .filter(Boolean)
        .join(" · ");

      // Kontekst-regel: HVER rad merkes når konteksten er bredere enn objektets hjem
      // — «Hele prosjektet», eller under søk (som treffer hele prosjektet). Ellers
      // (byggeplass valgt) merkes kun prosjekt-dokumenter grå.
      const erProsjektDok = item.byggeplass == null;
      const visBadge = søkerNaa || valgtBygningId == null || erProsjektDok;

      return (
        <Pressable
          onPress={() => router.push(`/sjekkliste/${item.id}`)}
          className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3"
        >
          <View className="flex-1">
            <View className="flex-row">
              {nummer ? <Text className="text-sm font-bold text-gray-900">{nummer} </Text> : null}
              <MedUtheving tekst={item.title} tokens={søkeTokens} className="flex-1 text-sm text-gray-900" />
            </View>
            {undertekst ? (
              <MedUtheving tekst={undertekst} tokens={søkeTokens} className="mt-0.5 text-xs text-gray-500" />
            ) : null}
            {visBadge ? (
              <Text
                className={
                  erProsjektDok
                    ? "mt-1 self-start rounded-full border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-500"
                    : "mt-1 self-start rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                }
              >
                {erProsjektDok ? t("kontekstChip.heleProsjektet") : item.byggeplass!.name}
              </Text>
            ) : null}
          </View>
          <StatusMerkelapp status={item.status} />
        </Pressable>
      );
    },
    [router, t, valgtBygningId, søkerNaa, søkeTokens],
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header — søkefeltet ERSTATTER header-raden (fabel-mockup panel 2). */}
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
          <Pressable
            onPress={() => { settSøkeAktiv(false); settSøketekst(""); }}
            hitSlop={10}
          >
            <Text className="text-sm text-white">{t("handling.avbryt")}</Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
          <View className="flex-row items-center">
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <ArrowLeft size={22} color="#ffffff" />
            </Pressable>
            <Text className="ml-3 text-lg font-semibold text-white">
              {t("nav.sjekklister")}
            </Text>
          </View>
          <View className="flex-row items-center gap-4">
            <Pressable onPress={() => settSøkeAktiv(true)} hitSlop={12}>
              <Search size={22} color="#ffffff" />
            </Pressable>
            <Pressable onPress={() => settVisVelger(true)} hitSlop={12}>
              <Plus size={24} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Global byggeplass-chip — skjules under søk (søk treffer hele prosjektet). */}
      {!søkerNaa && <ByggeplassChip />}

      {/* Status-trakt (chips) + filter-trakt (Excel-mønster: nøytral / fylt m/teller). */}
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

      {/* Fjernbare filter-chips + «Viser N av M» — aldri usynlig AT lista er filtrert. */}
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

      {/* Offline-banner: viser lagrede sjekklister + «sist hentet» (krav 6 rad 2
          + krav 7). Skiller «frakoblet, lagrede data» fra en tom liste. */}
      {tilstand === "lokal" && (
        <View className="flex-row items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
          <WifiOff size={14} color="#b45309" />
          <Text className="flex-1 text-xs text-amber-800">
            {t("offline.frakobletLagret")}
            {sistHentet != null
              ? ` · ${t("offline.sistHentet", { tid: formaterTidspunkt(sistHentet) })}`
              : ""}
          </Text>
        </View>
      )}

      {sjekklisteQuery.isLoading && lokaleRader.length === 0 ? (
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
          refreshControl={
            <RefreshControl
              refreshing={sjekklisteQuery.isRefetching}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={
            <View className="items-center px-4 pt-20">
              <Text className="text-base text-gray-500">
                {søkerNaa
                  ? t("dokumentsok.ingenTreff")
                  : effektivStatus || antallFilter > 0
                    ? t("tom.ingenMatcherFilter")
                    : tilstand === "lokal-tom"
                      ? t("offline.ikkeSynkronisert")
                      : t("tom.ingenSjekklister")}
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

      <MalVelger
        synlig={visVelger && !valgtMal}
        kategori="sjekkliste"
        onVelg={(mal) => {
          settVisVelger(false);
          settValgtMal(mal);
        }}
        onLukk={() => settVisVelger(false)}
      />

      <OpprettDokumentModal
        synlig={!!valgtMal}
        kategori="sjekkliste"
        mal={valgtMal ?? { id: "", name: "", prefix: null, category: "" }}
        onOpprettet={(id) => {
          settValgtMal(null);
          queryClient.invalidateQueries();
          router.push(`/sjekkliste/${id}`);
        }}
        onLukk={() => settValgtMal(null)}
      />
    </SafeAreaView>
  );
}
