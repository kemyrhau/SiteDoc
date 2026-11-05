import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Search, WifiOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useNettverk } from "../../src/providers/NettverkProvider";
import { useAuth } from "../../src/providers/AuthProvider";
import { hentSjekklisterLokalt, hentSistOppdatertLokalt } from "../../src/services/sjekklisteKatalog";
import { hentOppgaverLokalt, hentSistOppdatertOppgaveLokalt } from "../../src/services/oppgaveKatalog";
import { hentHmsLokalt, hentSistOppdatertHmsLokalt } from "../../src/services/hmsKatalog";
import { filtrerOgSorter, type DokumentRad } from "../../src/components/dokumentliste/dokumentlisteFilter";
import { tilHmsDokumentRad, type HmsFane, type HmsRad } from "../../src/components/dokumentliste/hmsListe";
import { OmfangVelger } from "../../src/components/sok/OmfangVelger";
import { KildeSeksjon } from "../../src/components/sok/KildeSeksjon";
import { TreffListe } from "../../src/components/sok/TreffListe";
import { ListeTreffRad } from "../../src/components/sok/ListeTreffRad";
import { sokIOppgaver, type OppgaveSokRad } from "../../src/components/sok/oppgaveSok";
import {
  flatHmsRader,
  flettUtvidet,
  grupperPerDokument,
  hmsRute,
  kildeModus,
  kilderFor,
  seksjonsUtvalg,
  synligeSeksjoner,
  tellelinje,
  tolkSokParametre,
  velgMappeMotor,
  MAKS_RADER_ALLE,
  VIS_FLERE_PORSJON,
  type Kilde,
  type KildeModus,
  type Omfang,
} from "../../src/components/sok/sokLogikk";
import type { MappeTreff } from "../../src/components/sok/typer";

const MIN_TEGN = 2;

const SEKSJONSNAVN: Record<Kilde, string> = {
  mapper: "sokMobil.omfangMapper",
  sjekklister: "sokMobil.omfangSjekklister",
  oppgaver: "sokMobil.omfangOppgaver",
  hms: "sokMobil.omfangHms",
};

/** «sist hentet hh:mm» (spec § 9.3) — dagens dato er underforstått i en søkeøkt. */
function klokkeslett(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

type HmsSvar = { avvik: HmsRad[]; sja: HmsRad[]; ruh: HmsRad[] };

/**
 * Mobilsøk MVP (spec-sok-mobil rev. 2). Ett felt + omfangsvelger «Alle · Mapper · Sjekklister · Oppgaver · HMS».
 * Søkeinnganger (spec-sok-innganger, B + C1): rute-parametrene `omfang` og `q` forhåndsvelger kilde og tekst;
 * med minst 2 tegn søkes det med en gang.
 * Mapper = FTD-innholdssøk (AI når embeddings finnes, ellers tekstsøk — som web `sok/page.tsx`), krever nett.
 * Sjekklister/oppgaver = klientsøk over listenes egne kilder (server, eller lokal katalog offline).
 * Skjermen blir stående i stacken når et treff åpnes, så søket er intakt ved retur.
 */
export default function SokSkjerm() {
  const { t } = useTranslation();
  const router = useRouter();
  const { valgtProsjektId } = useProsjekt();
  const { erPaaNettet } = useNettverk();
  const { bruker } = useAuth();
  const brukerId = bruker?.id;
  const insets = useSafeAreaInsets();

  const parametre = useLocalSearchParams<{ omfang?: string; q?: string }>();
  // Leses kun ved første visning: senere endringer i feltet/velgeren eies av skjermen.
  const [start] = useState(() => tolkSokParametre(parametre));
  const [tekst, settTekst] = useState(start.q);
  const [aktivtSok, settAktivtSok] = useState(() => (start.q.trim().length >= MIN_TEGN ? start.q.trim() : ""));
  const [omfang, settOmfang] = useState<Omfang>(start.omfang);
  const [utvidet, settUtvidet] = useState<Record<string, MappeTreff[]>>({});
  const [lasterFlereFor, settLasterFlereFor] = useState<string | null>(null);

  // Nytt søk nullstiller «Vis N flere»-utvidelsene (som web).
  useEffect(() => settUtvidet({}), [aktivtSok, valgtProsjektId]);

  const startSok = useCallback(() => {
    const q = tekst.trim();
    if (q.length >= MIN_TEGN) settAktivtSok(q);
  }, [tekst]);

  const kilder = kilderFor(omfang);
  const harSok = aktivtSok.length >= MIN_TEGN && !!valgtProsjektId;
  const søkerMapper = harSok && kilder.includes("mapper");
  const søkerSjekklister = harSok && kilder.includes("sjekklister");
  const søkerOppgaver = harSok && kilder.includes("oppgaver");
  const søkerHms = harSok && kilder.includes("hms");

  // ---- Mapper (spec § 6): samme motorregel og standardfilter som web ----
  const { data: embeddingStatus } = trpc.aiSok.embeddingStatus.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const harEmbeddings = (embeddingStatus?.ferdig ?? 0) > 0;
  const { data: refDok } = trpc.aiSok.hentReferanseDokumenter.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const refMappeIder = useMemo(
    () => refDok?.mapper.map((m) => m.id).filter((id) => id !== "__ingen__") ?? [],
    [refDok],
  );
  const filter = refMappeIder.length > 0 ? { ekskluderMappeIder: refMappeIder } : {};

  const aiQuery = trpc.aiSok.sok.useQuery(
    { projectId: valgtProsjektId!, query: aktivtSok, ...filter },
    { enabled: søkerMapper && harEmbeddings, retry: false },
  );
  const leksQuery = trpc.ftdSok.sokDokumenter.useQuery(
    { projectId: valgtProsjektId!, query: aktivtSok, ...filter },
    { enabled: søkerMapper },
  );
  const aiSvar = aiQuery.data as { treff: MappeTreff[]; aiSøkUtilgjengelig?: boolean } | undefined;
  const leksTreff = leksQuery.data as MappeTreff[] | undefined;

  const { motor, aiUtilgjengelig } = velgMappeMotor({
    harEmbeddings,
    aiFeilet: !!aiQuery.error,
    aiAntall: aiSvar?.treff.length ?? 0,
    aiSøkUtilgjengelig: !!aiSvar?.aiSøkUtilgjengelig,
  });
  const grunnTreff = motor === "ai" ? aiSvar?.treff : leksTreff;
  const mappeTreff = useMemo(() => flettUtvidet(grunnTreff ?? [], utvidet), [grunnTreff, utvidet]);
  // Med embeddings venter vi også på AI-svaret, så tekst-treff ikke vises og byttes ut (blink).
  const mapperLaster = søkerMapper && erPaaNettet && (leksQuery.isLoading || (harEmbeddings && aiQuery.isLoading));

  const utils = trpc.useUtils();
  const visFlere = useCallback(
    async (documentId: string, vist: number) => {
      if (!valgtProsjektId || lasterFlereFor) return;
      settLasterFlereFor(documentId);
      try {
        const antall = vist + VIS_FLERE_PORSJON;
        const rader =
          motor === "ai"
            ? ((await utils.aiSok.sok.fetch({
                projectId: valgtProsjektId,
                query: aktivtSok,
                dokumentIder: [documentId],
                topK: antall,
              })) as unknown as { treff: MappeTreff[] }).treff
            : ((await utils.ftdSok.sokDokumenter.fetch({
                projectId: valgtProsjektId,
                query: aktivtSok,
                dokumentIder: [documentId],
                limit: antall,
              })) as unknown as MappeTreff[]);
        if (rader.length > 0) settUtvidet((u) => ({ ...u, [documentId]: rader }));
      } catch {
        // Nettfeil: behold dagens rader; knappen kan trykkes igjen.
      } finally {
        settLasterFlereFor(null);
      }
    },
    [valgtProsjektId, lasterFlereFor, motor, utils, aktivtSok],
  );

  // ---- Sjekklister: listens kilde uten byggeplass (søk treffer hele prosjektet), statusfilter gjelder ikke ----
  const sjekklisteQuery = trpc.sjekkliste.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: søkerSjekklister },
  );
  const sjekklisteServer = sjekklisteQuery.data as DokumentRad[] | undefined;
  const sjekklisteLokal = useMemo(
    () =>
      søkerSjekklister && valgtProsjektId && brukerId
        ? (hentSjekklisterLokalt(valgtProsjektId, brukerId, undefined) as DokumentRad[])
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [søkerSjekklister, valgtProsjektId, brukerId, sjekklisteQuery.status],
  );

  // ---- Oppgaver: samme kildevalg; lokal katalog mangler beskrivelse (oppgave_local) ----
  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: søkerOppgaver },
  );
  const oppgaveServer = oppgaveQuery.data as OppgaveSokRad[] | undefined;
  const oppgaveLokal = useMemo(
    () =>
      søkerOppgaver && valgtProsjektId && brukerId
        ? (hentOppgaverLokalt(valgtProsjektId, brukerId, undefined) as OppgaveSokRad[])
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [søkerOppgaver, valgtProsjektId, brukerId, oppgaveQuery.status],
  );

  // ---- HMS: alle tre faner i ett kall, uten byggeplass (som HMS-lista under søk) ----
  const hmsQuery = trpc.hms.hentDokumenter.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: søkerHms },
  );
  const hmsServer = useMemo(() => flatHmsRader(hmsQuery.data as HmsSvar | undefined), [hmsQuery.data]);
  const hmsLokal = useMemo(
    () =>
      søkerHms && valgtProsjektId && brukerId
        ? flatHmsRader(hentHmsLokalt(valgtProsjektId, brukerId, undefined) as HmsSvar)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [søkerHms, valgtProsjektId, brukerId, hmsQuery.status],
  );

  const modus: Record<Kilde, KildeModus> = {
    mapper: kildeModus("mapper", { erPaaNettet, serverBekreftet: false, serverAntall: 0, lokalAntall: 0 }),
    sjekklister: kildeModus("sjekklister", {
      erPaaNettet,
      serverBekreftet: sjekklisteQuery.isSuccess,
      serverAntall: sjekklisteServer?.length ?? 0,
      lokalAntall: sjekklisteLokal.length,
    }),
    oppgaver: kildeModus("oppgaver", {
      erPaaNettet,
      serverBekreftet: oppgaveQuery.isSuccess,
      serverAntall: oppgaveServer?.length ?? 0,
      lokalAntall: oppgaveLokal.length,
    }),
    hms: kildeModus("hms", {
      erPaaNettet,
      serverBekreftet: hmsQuery.isSuccess,
      serverAntall: hmsServer.length,
      lokalAntall: hmsLokal.length,
    }),
  };

  const sjekklisteTreff = useMemo(() => {
    if (!søkerSjekklister) return [];
    const rader = modus.sjekklister === "server" ? sjekklisteServer ?? [] : sjekklisteLokal;
    return filtrerOgSorter(rader, {}, aktivtSok, []);
  }, [søkerSjekklister, modus.sjekklister, sjekklisteServer, sjekklisteLokal, aktivtSok]);

  const oppgaveTreff = useMemo(() => {
    if (!søkerOppgaver) return [];
    const rader = modus.oppgaver === "server" ? oppgaveServer ?? [] : oppgaveLokal;
    return sokIOppgaver(rader, aktivtSok);
  }, [søkerOppgaver, modus.oppgaver, oppgaveServer, oppgaveLokal, aktivtSok]);

  const hmsTreff = useMemo(() => {
    if (!søkerHms) return [];
    const rader = (modus.hms === "server" ? hmsServer : hmsLokal).map((r) => ({ ...tilHmsDokumentRad(r), fane: r.fane }));
    return filtrerOgSorter(rader, {}, aktivtSok, []) as Array<HmsRad & { fane: HmsFane }>;
  }, [søkerHms, modus.hms, hmsServer, hmsLokal, aktivtSok]);

  // «lagret versjon · sist hentet hh:mm» pr. listekilde når den leser lokal katalog.
  const sistHentet = useMemo(
    () => ({
      sjekklister:
        modus.sjekklister === "lokal" && valgtProsjektId && brukerId
          ? hentSistOppdatertLokalt(valgtProsjektId, brukerId)
          : null,
      oppgaver:
        modus.oppgaver === "lokal" && valgtProsjektId && brukerId
          ? hentSistOppdatertOppgaveLokalt(valgtProsjektId, brukerId)
          : null,
      hms:
        modus.hms === "lokal" && valgtProsjektId && brukerId
          ? hentSistOppdatertHmsLokalt(valgtProsjektId, brukerId)
          : null,
    }),
    [modus.sjekklister, modus.oppgaver, modus.hms, valgtProsjektId, brukerId],
  );

  const mappeDokumenter = useMemo(() => grupperPerDokument(mappeTreff).length, [mappeTreff]);
  // Mapper telles i dokumenter, samme enhet som grupperingen og «Vis alle N».
  const antall: Record<Kilde, number> = {
    mapper: søkerMapper && !mapperLaster ? mappeDokumenter : 0,
    sjekklister: sjekklisteTreff.length,
    oppgaver: oppgaveTreff.length,
    hms: hmsTreff.length,
  };
  const seksjoner = synligeSeksjoner(omfang, antall, modus);
  const telling = tellelinje(omfang, antall, modus);
  const erAlle = omfang === "alle";

  const tokens = useMemo(() => aktivtSok.split(/\s+/).filter((tk) => tk.length >= 2), [aktivtSok]);

  const listeLaster =
    (søkerSjekklister && sjekklisteQuery.isLoading && sjekklisteLokal.length === 0 && erPaaNettet) ||
    (søkerOppgaver && oppgaveQuery.isLoading && oppgaveLokal.length === 0 && erPaaNettet) ||
    (søkerHms && hmsQuery.isLoading && hmsLokal.length === 0 && erPaaNettet);
  const laster = mapperLaster || listeLaster;

  const lagretMerknad = (k: Exclude<Kilde, "mapper">): string | null => {
    if (modus[k] !== "lokal") return null;
    const ms = sistHentet[k];
    return ms != null
      ? t("sokMobil.lagretVersjon", { tid: klokkeslett(ms) })
      : t("sokMobil.lagretVersjonUtenTid");
  };

  const seksjonsTittel = (k: Kilde): string => {
    const navn = t(SEKSJONSNAVN[k]);
    return `${navn} (${antall[k]})`;
  };

  const visAlleKnapp = (k: Kilde, totalt: number, vist: number) =>
    erAlle && totalt > vist ? (
      <Pressable onPress={() => settOmfang(k)} className="px-4 py-2.5">
        <Text className="text-xs font-semibold text-sitedoc-primary">{t("sokMobil.visAlle", { antall: totalt })}</Text>
      </Pressable>
    ) : null;

  const renderSeksjon = (k: Kilde) => {
    if (k === "mapper") {
      const antallDok = mappeDokumenter;
      return (
        <KildeSeksjon
          key={k}
          tittel={seksjonsTittel(k)}
          visOverskrift={erAlle}
          onVelgKilde={() => settOmfang(k)}
          merknad={
            modus.mapper === "krever-nett"
              ? t("sokMobil.mapperKreverNett")
              : aiUtilgjengelig
                ? t("sok.fallbackVarsel")
                : null
          }
        >
          {!erAlle && mappeTreff.length > 0 && !mapperLaster ? (
            <Text className="px-4 pb-1.5 text-xs text-gray-500">
              {t("ftdSok.antallTreffIDok", { treff: mappeTreff.length, dok: antallDok })}
            </Text>
          ) : null}
          {mappeTreff.length > 0 && !mapperLaster ? (
            <TreffListe
              treff={mappeTreff}
              søkeord={aktivtSok}
              maksDokumenter={erAlle ? MAKS_RADER_ALLE : undefined}
              lasterFlereFor={lasterFlereFor}
              onVisFlere={visFlere}
              onVelg={(tr) =>
                router.push({
                  pathname: "/sok/[dokumentId]",
                  params: {
                    dokumentId: tr.documentId,
                    chunk: String(tr.chunkIndex ?? ""),
                    q: aktivtSok,
                    filnavn: tr.filename,
                    treff: mappeTreff
                      .filter((x) => x.documentId === tr.documentId && x.chunkIndex != null)
                      .map((x) => x.chunkIndex)
                      .join(","),
                  },
                })
              }
            />
          ) : !erAlle && modus.mapper === "server" && !mapperLaster ? (
            <Text className="px-4 py-3 text-sm text-gray-500">{t("ftdSok.ingenTreff")}</Text>
          ) : null}
          {visAlleKnapp(k, antallDok, Math.min(antallDok, MAKS_RADER_ALLE))}
        </KildeSeksjon>
      );
    }
    if (k === "hms") {
      const utvalg = seksjonsUtvalg(hmsTreff, omfang);
      return (
        <KildeSeksjon
          key={k}
          tittel={seksjonsTittel(k)}
          visOverskrift={erAlle}
          onVelgKilde={() => settOmfang(k)}
          merknad={lagretMerknad(k)}
        >
          {utvalg.rader.map((rad) => (
            <ListeTreffRad
              key={rad.id}
              rad={rad}
              tokens={tokens}
              etikett={t(`hms.tabs.${rad.fane}`)}
              onPress={() => router.push(`/${hmsRute(rad.fane)}/${rad.id}`)}
            />
          ))}
          {!erAlle && hmsTreff.length === 0 && !listeLaster ? (
            <Text className="px-4 py-3 text-sm text-gray-500">{t("ftdSok.ingenTreff")}</Text>
          ) : null}
          {visAlleKnapp(k, utvalg.totalt, utvalg.rader.length)}
        </KildeSeksjon>
      );
    }
    const rader = k === "sjekklister" ? sjekklisteTreff : oppgaveTreff;
    const utvalg = seksjonsUtvalg<DokumentRad | OppgaveSokRad>(rader, omfang);
    return (
      <KildeSeksjon
        key={k}
        tittel={seksjonsTittel(k)}
        visOverskrift={erAlle}
        onVelgKilde={() => settOmfang(k)}
        merknad={lagretMerknad(k)}
      >
        {utvalg.rader.map((rad) => (
          <ListeTreffRad
            key={rad.id}
            rad={rad}
            tokens={tokens}
            onPress={() => router.push(k === "sjekklister" ? `/sjekkliste/${rad.id}` : `/oppgave/${rad.id}`)}
          />
        ))}
        {!erAlle && rader.length === 0 && !listeLaster ? (
          <Text className="px-4 py-3 text-sm text-gray-500">{t("ftdSok.ingenTreff")}</Text>
        ) : null}
        {visAlleKnapp(k, utvalg.totalt, utvalg.rader.length)}
      </KildeSeksjon>
    );
  };

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 bg-sitedoc-blue px-4 py-2.5">
        <View className="flex-1 flex-row items-center rounded-lg bg-white px-3 py-2">
          <Search size={16} color="#9ca3af" />
          <TextInput
            value={tekst}
            onChangeText={settTekst}
            onSubmitEditing={startSok}
            placeholder={t("sokMobil.placeholder")}
            placeholderTextColor="#9ca3af"
            className="ml-2 flex-1 py-0 text-sm text-gray-900"
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-sm text-white">{t("handling.avbryt")}</Text>
        </Pressable>
      </View>

      <OmfangVelger valgt={omfang} onVelg={settOmfang} />

      {!erPaaNettet && kilder.includes("mapper") ? (
        <View className="flex-row items-center gap-2 border-b border-gray-200 bg-gray-100 px-4 py-2">
          <WifiOff size={14} color="#6b7280" />
          <Text className="flex-1 text-xs text-gray-600">{t("sokMobil.mapperKreverNett")}</Text>
        </View>
      ) : null}

      {!harSok ? (
        <View className="items-center px-6 pt-16">
          <Text className="text-center text-sm text-gray-500">{t("sokMobil.minstToTegn")}</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerClassName="pb-8">
          <View className="flex-row items-center gap-2 px-4 pb-1 pt-3">
            <Text className="text-xs text-gray-500">
              {t("ftdSok.antallTreff", { antall: telling.treff })}
              {telling.mapperKreverNett ? ` · ${t("sokMobil.kreverNettKort")}` : ""}
            </Text>
            {laster ? <ActivityIndicator size="small" color="#1e40af" /> : null}
          </View>
          {erAlle && seksjoner.length === 0 && !laster ? (
            <Text className="px-4 py-3 text-sm text-gray-500">{t("ftdSok.ingenTreff")}</Text>
          ) : null}
          {seksjoner.map(renderSeksjon)}
        </ScrollView>
      )}
    </View>
  );
}
