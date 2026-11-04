import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Plus, Search, SlidersHorizontal, WifiOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { velgOfflineListeKilde } from "@sitedoc/shared";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { useNettverk } from "../../src/providers/NettverkProvider";
import { useAuth } from "../../src/providers/AuthProvider";
import {
  hentHmsLokalt,
  hentSistOppdatertHmsLokalt,
} from "../../src/services/hmsKatalog";
import { StatusMerkelapp } from "../../src/components/StatusMerkelapp";
import { StatusFilterRad } from "../../src/components/StatusFilterRad";
import { ByggeplassChip } from "../../src/components/ByggeplassChip";
import { ProsjektSokRad } from "../../src/components/sok/ProsjektSokRad";
import { HmsMalVelger, type HmsMal, type HmsSubdomain } from "../../src/components/HmsMalVelger";
import {
  MedUtheving,
  formaterKortDato,
  formaterNummer,
  formaterOfflineTidspunkt,
} from "../../src/components/dokumentliste/DokumentRadHjelpere";
import { FilterOgSorteringSheet } from "../../src/components/dokumentliste/FilterOgSorteringSheet";
import { PRIORITET_NOEKKEL } from "../../src/components/dokumentliste/filterEtikett";
import { AktiveFilterChips } from "../../src/components/dokumentliste/AktiveFilterChips";
import {
  ballenBrukerForKilde,
  byggAlternativer,
  filtrerOgSorter,
  tilgjengeligeSorteringer,
} from "../../src/components/dokumentliste/dokumentlisteFilter";
import {
  filterForFane,
  harPrioritet,
  tilHmsDokumentRad,
  type HmsRad,
} from "../../src/components/dokumentliste/hmsListe";
import {
  useAktiveFilter,
  useDokumentlisteFilter,
} from "../../src/components/dokumentliste/useDokumentlisteFilter";

const FANER: HmsSubdomain[] = ["avvik", "sja", "ruh"];

const PRIORITETS_FARGE: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-blue-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

interface HmsDokumenter {
  avvik: HmsRad[];
  sja: HmsRad[];
  ruh: HmsRad[];
}

export default function HmsListe() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const { erPaaNettet } = useNettverk();
  const { bruker } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [fane, settFane] = useState<HmsSubdomain>("avvik");
  const [statusFilter, settStatusFilter] = useState<string | null>(null);
  const [visMalVelger, settVisMalVelger] = useState(false);

  // Dokumentsøk + filter + sortering + periode (filter-hms 2026-11-03) — samme hook som
  // oppgave-/sjekklistelista, nullstilles ved prosjektbytte. Beholdes ved fanebytte;
  // statusfilteret nullstilles ved fanebytte som før.
  const {
    søkeAktiv,
    settSøkeAktiv,
    søketekst,
    settSøketekst,
    søkerNaa,
    søkeTokens,
    filterVerdier: råFilter,
    sortering,
    trykkSortering,
    nullstillSortering,
    periode,
    settPeriode,
    visSheet,
    settVisSheet,
    ballenBrukerNett,
    settFilter,
    fjernChip,
    nullstillFilter,
  } = useDokumentlisteFilter(valgtProsjektId);

  // Byggeplass serverside via global aktiv byggeplass. Søk overstyrer byggeplassen
  // (hele prosjektet), som i oppgavelista. Fane, status, filter og søk klientside.
  const dokQuery = trpc.hms.hentDokumenter.useQuery(
    {
      projectId: valgtProsjektId!,
      byggeplassId: søkerNaa ? undefined : valgtBygningId ?? undefined,
    },
    { enabled: !!valgtProsjektId },
  );

  // Offline-lesing (Offline-liste fase 1, 2026-10-03). Kildevalget gjøres på
  // HELE datasettet (alle tre kategorier), ikke per fane — serveren leverer dem
  // i ett kall. MED nett + bekreftet svar er serveren autoritativ; lokal er KUN
  // fallback. Lokal scope speiler server-spørringens byggeplass-scope.
  const bygg = søkerNaa ? undefined : valgtBygningId ?? undefined;
  const brukerId = bruker?.id;
  const serverDok = dokQuery.data as HmsDokumenter | undefined;

  const lokalDok = useMemo<HmsDokumenter>(
    () =>
      valgtProsjektId && brukerId
        ? (hentHmsLokalt(valgtProsjektId, brukerId, bygg) as HmsDokumenter)
        : { avvik: [], sja: [], ruh: [] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valgtProsjektId, brukerId, bygg, dokQuery.status],
  );

  const serverAntall = serverDok
    ? serverDok.avvik.length + serverDok.sja.length + serverDok.ruh.length
    : 0;
  const lokalAntall = lokalDok.avvik.length + lokalDok.sja.length + lokalDok.ruh.length;

  const { kilde, tilstand } = velgOfflineListeKilde({
    erPaaNettet,
    serverBekreftet: dokQuery.isSuccess,
    serverAntall,
    lokalAntall,
  });

  const dok = kilde === "server" ? serverDok : lokalDok;

  const sistHentet = useMemo(
    () =>
      tilstand === "lokal" && valgtProsjektId && brukerId
        ? hentSistOppdatertHmsLokalt(valgtProsjektId, brukerId)
        : null,
    [tilstand, valgtProsjektId, brukerId, lokalAntall],
  );

  const aktivListe = useMemo<HmsRad[]>(() => {
    if (!dok) return [];
    return (dok[fane] ?? []).map(tilHmsDokumentRad);
  }, [dok, fane]);

  // Prioritet finnes bare på avvik/RUH. «Ballen» kun på serverrader.
  const visPrioritet = harPrioritet(fane);
  const ballenBruker = ballenBrukerForKilde(ballenBrukerNett, kilde);
  const faneFilter = useMemo(() => filterForFane(råFilter, fane), [råFilter, fane]);
  const { filterVerdier, antallFilter, aktiveChips } = useAktiveFilter(faneFilter, periode, ballenBruker);

  // Alternativer fra hele (status-uavhengige) fanen — adaptivt per fane.
  const alternativer = useMemo(() => byggAlternativer(aktivListe), [aktivListe]);

  const tilgjengeligeStatuser = useMemo(
    () => Array.from(new Set(aktivListe.map((d) => d.status))),
    [aktivListe],
  );

  const effektivStatus =
    statusFilter && tilgjengeligeStatuser.includes(statusFilter) ? statusFilter : null;

  const synlige = useMemo(
    () =>
      filtrerOgSorter(
        effektivStatus ? aktivListe.filter((d) => d.status === effektivStatus) : aktivListe,
        filterVerdier,
        søkerNaa ? søketekst : "",
        sortering,
        { periode, bruker: ballenBruker },
      ) as HmsRad[],
    [aktivListe, effektivStatus, filterVerdier, søkerNaa, søketekst, sortering, periode, ballenBruker],
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
        // Kontekst-default (V2): aktiv byggeplass fra global kontekst settes ved
        // opprettelse. sjekkliste.opprett tar byggeplassId direkte.
        opprettSjekkliste.mutate({
          templateId: mal.id,
          title: mal.name,
          byggeplassId: valgtBygningId ?? undefined,
        });
      } else {
        // Avvik/RUH = oppgave. oppgave.opprett tar kun drawingId (ingen
        // byggeplassId-felt), og mobil-HMS har ingen aktiv tegning-kilde →
        // byggeplass festes ikke her (sak B, backlogget).
        opprettOppgave.mutate({ templateId: mal.id, title: mal.name });
      }
    },
    [opprettOppgave, opprettSjekkliste, valgtBygningId],
  );

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const renderElement = useCallback(
    ({ item }: { item: HmsRad }) => {
      const nummer = formaterNummer(item.template?.prefix, item.number);
      const undertekst = [
        // Undertrykk mal-navnet når det er identisk med tittelen (unngå dobbeltnavn).
        item.template?.name === item.title ? null : item.template?.name,
        item.bestillerFaggruppe?.name,
        item.dueDate ? formaterKortDato(item.dueDate) : null,
      ]
        .filter(Boolean)
        .join(" · ");
      // Prioritet bare på avvik/RUH, og bare når serveren sender den (eldre API: ingen).
      const prioritet = visPrioritet ? item.priority ?? "" : "";
      // SJA er sjekkliste, avvik/RUH er oppgave.
      const rute = fane === "sja" ? "sjekkliste" : "oppgave";

      return (
        <Pressable
          onPress={() => router.push(`/${rute}/${item.id}`)}
          className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3"
        >
          <View className="flex-1 pr-2">
            <View className="flex-row items-center gap-1">
              {nummer ? <Text className="text-sm font-bold text-gray-900">{nummer}</Text> : null}
              <MedUtheving
                tekst={item.title}
                tokens={søkeTokens}
                className="flex-1 text-sm text-gray-900"
              />
            </View>
            {item.subject?.trim() ? (
              <MedUtheving tekst={item.subject.trim()} tokens={søkeTokens} className="mt-0.5 text-xs text-gray-700" />
            ) : null}
            {prioritet || undertekst ? (
              <View className="mt-0.5 flex-row items-center gap-2">
                {prioritet ? (
                  <Text className={`text-xs font-medium ${PRIORITETS_FARGE[prioritet] ?? "text-gray-500"}`}>
                    {PRIORITET_NOEKKEL[prioritet] ? t(PRIORITET_NOEKKEL[prioritet]) : prioritet}
                  </Text>
                ) : null}
                {undertekst ? (
                  <Text className="flex-1 text-xs text-gray-500" numberOfLines={1}>
                    {prioritet ? `· ${undertekst}` : undertekst}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
          <View className="items-end">
            <StatusMerkelapp status={item.status} />
            <Text className="mt-1 text-[11px] text-gray-400">
              {t("dokumentsok.opprettetDato", { dato: formaterKortDato(item.createdAt) })}
            </Text>
          </View>
        </Pressable>
      );
    },
    [router, fane, t, søkeTokens, visPrioritet],
  );

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header — søkefeltet ERSTATTER header-raden (som oppgavelista). */}
      {søkeAktiv ? (
        <View className="flex-row items-center gap-2 bg-sitedoc-blue px-4 py-2.5">
          <View className="flex-1 flex-row items-center rounded-lg bg-white px-3 py-2">
            <Search size={16} color="#9ca3af" />
            <TextInput
              value={søketekst}
              onChangeText={settSøketekst}
              placeholder={t("sokMobil.placeholderHms")}
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
            <Text className="ml-3 text-lg font-semibold text-white">{t("hms.tittel")}</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <Pressable onPress={() => settSøkeAktiv(true)} hitSlop={12}>
              <Search size={22} color="#ffffff" />
            </Pressable>
            <Pressable onPress={() => settVisMalVelger(true)} hitSlop={12}>
              <Plus size={24} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Global byggeplass-chip (filtrerer lista serverside) — skjules under søk. */}
      {!søkerNaa && <ByggeplassChip />}

      {/* Søkeinngang B: listesøket er uendret; raden tar teksten med til prosjektsøket. */}
      {søkeAktiv && <ProsjektSokRad kilde="hms" tekst={søketekst} />}

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

      {/* Status-filter (kun statuser i aktiv fane) + filter-trakt (nøytral / fylt m/teller). */}
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

      {(antallFilter > 0 || sortering.length > 0) && (
        <AktiveFilterChips
          chips={aktiveChips}
          synlige={synlige.length}
          totalt={aktivListe.length}
          onFjern={fjernChip}
          onNullstill={nullstillFilter}
          sortering={sortering}
          onNullstillSortering={nullstillSortering}
        />
      )}

      {/* Offline-banner: viser lagrede HMS-dokumenter + «sist hentet». */}
      {tilstand === "lokal" && (
        <View className="flex-row items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
          <WifiOff size={14} color="#b45309" />
          <Text className="flex-1 text-xs text-amber-800">
            {t("offline.frakobletLagretDok")}
            {sistHentet != null
              ? ` · ${t("offline.sistHentet", { tid: formaterOfflineTidspunkt(sistHentet) })}`
              : ""}
          </Text>
        </View>
      )}

      {dokQuery.isLoading && lokalAntall === 0 ? (
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
            <RefreshControl refreshing={dokQuery.isRefetching} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center px-8 pt-20">
              {søkerNaa ? (
                <Text className="text-base text-gray-500">{t("dokumentsok.ingenTreff")}</Text>
              ) : effektivStatus || antallFilter > 0 ? (
                <Text className="text-base text-gray-500">{t("tom.ingenMatcherFilter")}</Text>
              ) : tilstand === "lokal-tom" ? (
                <Text className="text-base text-gray-500">
                  {t("offline.ikkeSynkronisertDok")}
                </Text>
              ) : (
                <>
                  <Text className="text-base text-gray-500">{t(`hms.tom.${fane}`)}</Text>
                  <Text className="mt-1 text-center text-sm text-gray-400">
                    {t(`hms.tom.${fane}Beskrivelse`)}
                  </Text>
                </>
              )}
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
        sorteringsnokler={tilgjengeligeSorteringer(aktivListe, sortering)}
        onTrykkSortering={trykkSortering}
        onNullstill={nullstillFilter}
        onLukk={() => settVisSheet(false)}
        periode={periode}
        onSettPeriode={settPeriode}
        visBallen={!!ballenBruker}
        visPrioritet={visPrioritet}
      />

      <HmsMalVelger
        synlig={visMalVelger}
        onVelg={håndterMal}
        onLukk={() => settVisMalVelger(false)}
      />
    </View>
  );
}
