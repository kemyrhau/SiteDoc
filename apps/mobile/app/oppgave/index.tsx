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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Plus, Scale, Search, SlidersHorizontal, WifiOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { velgOfflineListeKilde } from "@sitedoc/shared";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { useNettverk } from "../../src/providers/NettverkProvider";
import { useAuth } from "../../src/providers/AuthProvider";
import {
  hentOppgaverLokalt,
  hentSistOppdatertOppgaveLokalt,
} from "../../src/services/oppgaveKatalog";
import { StatusMerkelapp } from "../../src/components/StatusMerkelapp";
import { StatusFilterRad } from "../../src/components/StatusFilterRad";
import { OpprettVelger } from "../../src/components/OpprettVelger";
import { ByggeplassChip } from "../../src/components/ByggeplassChip";
import { ProsjektSokRad } from "../../src/components/sok/ProsjektSokRad";
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
  type DokumentRad,
} from "../../src/components/dokumentliste/dokumentlisteFilter";
import {
  useAktiveFilter,
  useDokumentlisteFilter,
} from "../../src/components/dokumentliste/useDokumentlisteFilter";

const PRIORITETS_FARGE: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-blue-600",
  high: "text-orange-600",
  critical: "text-red-600",
};


// Cast-type for å unngå TS2589 (excessively deep type instantiation). Bygger på
// dokumentlistens rad (bestiller, mottaker, tegning, dokumentflyt, emne …).
interface OppgaveRad extends DokumentRad {
  description: string | null;
  // subdomain følger med tRPC-svaret (oppgave.ts bruker `include` på template). Kun lest
  // for kontraktssak-markering — lokal mirror har ingen kolonne for den.
  template?: { name: string; prefix?: string | null; subdomain?: string | null } | null;
}

export default function OppgaveListe() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const { erPaaNettet } = useNettverk();
  const { bruker } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [visVelger, settVisVelger] = useState(false);
  const [statusFilter, settStatusFilter] = useState<string | null>(null);
  // Kontraktssak-segment (tavle 4): økt-tilstand, ikke lokal DB.
  const [segment, settSegment] = useState<"alle" | "oppgaver" | "kontrakt">("alle");

  // Dokumentsøk + filter + sortering + periode (samme som sjekklistelista,
  // nullstilles ved prosjektbytte — se hooken).
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

  useEffect(() => settStatusFilter(null), [valgtProsjektId]);

  // Byggeplass serverside via global aktiv byggeplass (myk filter). Søk overstyrer
  // byggeplassen: søker man, hentes HELE prosjektet (fabel-designlås pkt 3).
  // Status, filter og søk klientside.
  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    {
      projectId: valgtProsjektId!,
      byggeplassId: søkerNaa ? undefined : valgtBygningId ?? undefined,
    },
    { enabled: !!valgtProsjektId },
  );

  // Offline-lesing (Offline-liste fase 1, 2026-10-03), samme mønster som
  // sjekklistelista: MED nett og et bekreftet server-svar er serveren autoritativ;
  // lokal lesing er KUN fallback (offline / henger / feilet). Lokal scope speiler
  // server-spørringens byggeplass-scope (samme byggeplassId).
  const bygg = søkerNaa ? undefined : valgtBygningId ?? undefined;
  const brukerId = bruker?.id;
  const serverData = oppgaveQuery.data as OppgaveRad[] | undefined;

  const lokaleRader = useMemo(
    () =>
      valgtProsjektId && brukerId
        ? (hentOppgaverLokalt(valgtProsjektId, brukerId, bygg) as OppgaveRad[])
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valgtProsjektId, brukerId, bygg, oppgaveQuery.status],
  );

  const { kilde, tilstand } = velgOfflineListeKilde({
    erPaaNettet,
    serverBekreftet: oppgaveQuery.isSuccess,
    serverAntall: serverData?.length ?? 0,
    lokalAntall: lokaleRader.length,
  });

  const oppgaver = kilde === "server" ? serverData : lokaleRader;

  // «Ballen» kun på serverrader (lokale rader mangler bestiller-/mottaker-id-ene).
  const ballenBruker = ballenBrukerForKilde(ballenBrukerNett, kilde);
  const { filterVerdier, antallFilter, aktiveChips } = useAktiveFilter(råFilter, periode, ballenBruker);

  // «Sist hentet»-tid for dette PROSJEKTET — kun når vi viser lokale rader.
  const sistHentet = useMemo(
    () =>
      tilstand === "lokal" && valgtProsjektId && brukerId
        ? hentSistOppdatertOppgaveLokalt(valgtProsjektId, brukerId)
        : null,
    [tilstand, valgtProsjektId, brukerId, lokaleRader.length],
  );

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
  const etterSegment = useMemo(() => {
    if (segment === "kontrakt") return statusFiltrert.filter(erKontraktRad);
    if (segment === "oppgaver") return statusFiltrert.filter((o) => !erKontraktRad(o));
    return statusFiltrert;
  }, [statusFiltrert, segment]);

  // Alternativer fra HELE (status-uavhengige) lista — et nedtrekk skjuler aldri et valg som finnes.
  const alternativer = useMemo(() => byggAlternativer(oppgaver ?? []), [oppgaver]);

  const synlige = useMemo(
    () =>
      filtrerOgSorter(etterSegment, filterVerdier, søkerNaa ? søketekst : "", sortering, {
        periode,
        bruker: ballenBruker,
      }) as OppgaveRad[],
    [etterSegment, filterVerdier, søkerNaa, søketekst, sortering, periode, ballenBruker],
  );
  const totalt = oppgaver?.length ?? 0;

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const renderElement = useCallback(
    ({ item }: { item: OppgaveRad }) => {
      const nummer = formaterNummer(item.template?.prefix, item.number);
      const undertekst = [
        item.utforerFaggruppe?.name,
        item.dueDate ? formaterKortDato(item.dueDate) : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const prioritet = item.priority ?? "";

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
            <View className="mt-0.5 flex-row items-center gap-2">
              <Text className={`text-xs font-medium ${PRIORITETS_FARGE[prioritet] ?? "text-gray-500"}`}>
                {PRIORITET_NOEKKEL[prioritet] ? t(PRIORITET_NOEKKEL[prioritet]) : prioritet}
              </Text>
              {undertekst ? (
                <Text className="text-xs text-gray-500" numberOfLines={1}>
                  · {undertekst}
                </Text>
              ) : null}
            </View>
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
    [router, t, søkeTokens],
  );

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header — søkefeltet ERSTATTER header-raden (som sjekklistelista). */}
      {søkeAktiv ? (
        <View className="flex-row items-center gap-2 bg-sitedoc-blue px-4 py-2.5">
          <View className="flex-1 flex-row items-center rounded-lg bg-white px-3 py-2">
            <Search size={16} color="#9ca3af" />
            <TextInput
              value={søketekst}
              onChangeText={settSøketekst}
              placeholder={t("sokMobil.placeholderOppgaver")}
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
              {t("nav.oppgaver")}
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

      {/* F2: global byggeplass-chip — skjules under søk (søk treffer hele prosjektet). */}
      {!søkerNaa && <ByggeplassChip />}

      {/* Søkeinngang B: listesøket er uendret; raden tar teksten med til prosjektsøket. */}
      {søkeAktiv && <ProsjektSokRad kilde="oppgaver" tekst={søketekst} />}

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

      {/* Status-filter (kun statuser som finnes i lista) + filter-trakt (nøytral / fylt m/teller). */}
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
          totalt={totalt}
          onFjern={fjernChip}
          onNullstill={nullstillFilter}
          sortering={sortering}
          onNullstillSortering={nullstillSortering}
        />
      )}

      {/* Offline-banner: viser lagrede oppgaver + «sist hentet». Skiller
          «frakoblet, lagrede data» fra en tom liste. */}
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

      {oppgaveQuery.isLoading && lokaleRader.length === 0 ? (
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
              refreshing={oppgaveQuery.isRefetching}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={
            <View className="items-center px-4 pt-20">
              <Text className="text-base text-gray-500">
                {søkerNaa
                  ? t("dokumentsok.ingenTreff")
                  : effektivStatus || antallFilter > 0 || segment !== "alle"
                  ? t("tom.ingenMatcherFilter")
                  : tilstand === "lokal-tom"
                    ? t("offline.ikkeSynkronisertDok")
                    : t("tom.ingenOppgaver")}
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
        sorteringsnokler={tilgjengeligeSorteringer(oppgaver ?? [], sortering)}
        onTrykkSortering={trykkSortering}
        onNullstill={nullstillFilter}
        onLukk={() => settVisSheet(false)}
        periode={periode}
        onSettPeriode={settPeriode}
        visBallen={!!ballenBruker}
        visPrioritet
      />

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
    </View>
  );
}
