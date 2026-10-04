import { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, Alert, Modal, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";
import {
  Settings,
  Building2,
  GitBranch,
  WifiOff,
  ChevronRight,
  LogOut,
  Globe,
  Check,
  Clock,
  BarChart3,
  ClipboardCheck,
  Contact,
} from "lucide-react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useTimerSync } from "../../src/providers/TimerSyncProvider";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/providers/AuthProvider";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { useFirma } from "../../src/kontekst/FirmaKontekst";
import { FirmaVelger } from "../../src/components/FirmaVelger";
import { VersjonsFooter } from "../../src/components/VersjonsFooter";
import { trpc } from "../../src/lib/trpc";
import { klargjørForOffline } from "../../src/services/offlineKlargjoring";
import { refreshSjekklisteKatalog, hentSjekklisterLokalt } from "../../src/services/sjekklisteKatalog";
import { refreshOppgaveKatalog, hentOppgaverLokalt } from "../../src/services/oppgaveKatalog";
import { refreshHmsKatalog, hentHmsLokalt } from "../../src/services/hmsKatalog";
import { forhaandslastDokumenter, tellDokumentSpeilForProsjekt, type ForhaandslastDokument } from "../../src/services/dokumentSpeil";
import { erTegningCachet } from "../../src/services/offlineKlargjoring";
import { byttSpraak } from "../../src/lib/i18n";
import { useFirmamodulSkjult } from "../../src/hooks/useFirmamodul";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";
import type { SpraakKode } from "@sitedoc/shared";

export default function MerSkjerm() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { bruker, loggUt } = useAuth();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const { pendingAntall, conflictAntall } = useTimerSync();
  const [offlineTekst, setOfflineTekst] = useState<string | null>(null);
  // Feltfunn A (2026-10-04): VARIG «hva er lagret for offline»-visning, lest fra SQLite/disk
  // ved fokus — ikke den flyktige `offlineTekst` som forsvinner når fanen forlates.
  const [lagretStatus, setLagretStatus] = useState<{
    dokumenter: number;
    tegninger: number;
    sistKlargjort: number | null;
  } | null>(null);
  const [visSpraakModal, setVisSpraakModal] = useState(false);
  const [visFirmaVelger, setVisFirmaVelger] = useState(false);
  const { valgtFirma, firmaer, valgtFirmaId } = useFirma();
  // Firmatak-gate: skjul timer-inngangene i menyen når Timer er av for firmaet.
  const timerSkjult = useFirmamodulSkjult("timer");

  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  // T7-3d: attestering-lenken vises kun for prosjektledere + firma-admin
  // i valgt firma. orgId hentes fra useFirma() — speiler firma-kontekstens
  // valg, ikke utledning fra første prosjekts primaryOrganizationId.
  const { data: kanAttestereFirma } =
    trpc.timer.dagsseddel.kanAttestereFirma.useQuery(
      { organizationId: valgtFirmaId ?? "" },
      { enabled: !!valgtFirmaId },
    );

  const tegningerQuery = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId!, ...(valgtBygningId ? { byggeplassId: valgtBygningId } : {}) },
    { enabled: !!valgtProsjektId },
  );

  const oppdaterSpraakMut = trpc.bruker.oppdaterSpraak.useMutation();
  const utils = trpc.useUtils();

  // Les lagret-status fra varig lager (SQLite dokument-speil + disk-cachede tegninger)
  // for valgt bruker + prosjekt. Kalles ved skjermfokus og etter klargjøring.
  const oppdaterLagretStatus = useCallback(async () => {
    if (!valgtProsjektId || !bruker?.id) {
      setLagretStatus(null);
      return;
    }
    const { antall, sistKlargjort } = tellDokumentSpeilForProsjekt(bruker.id, valgtProsjektId);
    let tegninger = 0;
    const liste = tegningerQuery.data as
      | Array<{ fileUrl: string | null; fileType: string | null }>
      | undefined;
    if (liste) {
      const cachet = await Promise.all(
        liste
          .filter((tg) => tg.fileUrl && (tg.fileType?.toLowerCase() ?? "") !== "ifc")
          .map((tg) => erTegningCachet(tg.fileUrl as string)),
      );
      tegninger = cachet.filter(Boolean).length;
    }
    setLagretStatus({ dokumenter: antall, tegninger, sistKlargjort });
  }, [valgtProsjektId, bruker?.id, tegningerQuery.data]);

  // Oppdater ved hver skjermfokus — tallene leses på nytt fra lager, ikke fra minnet.
  useFocusEffect(
    useCallback(() => {
      oppdaterLagretStatus();
    }, [oppdaterLagretStatus]),
  );

  const startOffline = useCallback(async () => {
    if (!tegningerQuery.data) {
      Alert.alert(t("feil.noeGikkGalt"), t("mer.offline.tegningerIkkeLastet"));
      return;
    }
    setOfflineTekst(t("mer.offline.starter"));
    try {
      const resultat = await klargjørForOffline(
        tegningerQuery.data as Array<{ id: string; name: string; fileUrl: string | null; fileType: string | null; updatedAt?: string }>,
        (s) => setOfflineTekst(`${s.steg} ${s.ferdigeProsent}%`),
      );
      // Dokumentliste-kataloger i EGET try/catch PER liste: feiler én, er
      // tegningene (og de andre listene) ALT lastet (krav 6 rad 3 — ett nytt
      // steg river ikke med seg det som virket).
      let listeTekst = "";
      if (valgtProsjektId && bruker?.id) {
        const uid = bruker.id;
        try {
          const s = await refreshSjekklisteKatalog(utils.client, valgtProsjektId, uid);
          listeTekst += t("mer.offline.sjekklister", { antall: s.sjekklister });
        } catch {
          listeTekst += t("mer.offline.sjekklisterFeilet");
        }
        try {
          const o = await refreshOppgaveKatalog(utils.client, valgtProsjektId, uid);
          listeTekst += t("mer.offline.oppgaver", { antall: o.oppgaver });
        } catch {
          listeTekst += t("mer.offline.oppgaverFeilet");
        }
        try {
          const h = await refreshHmsKatalog(utils.client, valgtProsjektId, uid);
          listeTekst += t("mer.offline.hms", { antall: h.hms });
        } catch {
          listeTekst += t("mer.offline.hmsFeilet");
        }
        // Offline-LESING fase 2: forhånds-nedlast dokument-speilene (via bieffekt-fri
        // hentForOffline) fra de nå oppdaterte listene. HMS-kategori → dokumenttype:
        // sja = checklist (sjekkliste-skjerm), avvik/ruh = task (oppgave-skjerm).
        try {
          const dokumenter: ForhaandslastDokument[] = [];
          for (const s of hentSjekklisterLokalt(valgtProsjektId, uid))
            dokumenter.push({ id: s.id, type: "sjekkliste", status: s.status });
          for (const o of hentOppgaverLokalt(valgtProsjektId, uid))
            dokumenter.push({ id: o.id, type: "oppgave", status: o.status });
          const hms = hentHmsLokalt(valgtProsjektId, uid);
          for (const sja of hms.sja) dokumenter.push({ id: sja.id, type: "sjekkliste", status: sja.status });
          for (const a of [...hms.avvik, ...hms.ruh]) dokumenter.push({ id: a.id, type: "oppgave", status: a.status });
          const r = await forhaandslastDokumenter(utils.client, valgtProsjektId, uid, dokumenter);
          listeTekst += r.serverManglerProsedyre
            ? t("mer.offline.dokumenterIkkeStoettet")
            : t("mer.offline.dokumenter", { antall: r.lastet });
        } catch {
          listeTekst += t("mer.offline.dokumenterFeilet");
        }
      }
      setOfflineTekst(
        t("mer.offline.ferdig", {
          tegninger: resultat.tegningerLastet,
          modeller: resultat.ifcLastet,
          tillegg: listeTekst,
        }),
      );
      // Oppdater den varige lagret-visningen med én gang klargjøringen er ferdig.
      void oppdaterLagretStatus();
      setTimeout(() => setOfflineTekst(null), 4000);
    } catch (err) {
      // Feilen BLIR STÅENDE (ingen auto-tømming) til neste klargjøringsforsøk — feltfunn A.
      setOfflineTekst(t("mer.offline.feil", { melding: err instanceof Error ? err.message : String(err) }));
      void oppdaterLagretStatus();
    }
  }, [t, tegningerQuery.data, valgtProsjektId, bruker?.id, utils.client, oppdaterLagretStatus]);

  const velgSpraak = useCallback(async (kode: SpraakKode) => {
    setVisSpraakModal(false);
    await byttSpraak(kode);
    oppdaterSpraakMut.mutate({ language: kode });
  }, [oppdaterSpraakMut]);

  const erAdmin = medlemmer?.some(
    (m) => m.user?.email === bruker?.email && m.role === "admin",
  );

  const initialer = bruker?.name
    ? bruker.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  const aktivtSpraak = STOETTEDE_SPRAAK.find((s) => s.kode === i18n.language);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="border-b border-gray-200 bg-white px-4 py-3">
        <Text className="text-lg font-semibold text-gray-900">{t("nav.mer")}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        {/* Prosjekthandlinger */}
        <View className="mt-4">
          <View className="border-b border-gray-200 px-4 pb-1.5 pt-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("mer.prosjekt")}
            </Text>
          </View>
          <MenyRad
            ikon={Settings}
            tekst={t("mer.prosjektinnstillinger")}
            deaktivert={!erAdmin}
            onPress={() => {
              if (!erAdmin) {
                Alert.alert(t("feil.ingenTilgang"), t("feil.kunAdmin"));
              } else {
                Alert.alert(t("mer.prosjektinnstillinger"), t("mer.prosjektinnstillingerInfo"));
              }
            }}
          />
        </View>

        {/* Generelt */}
        <View className="mt-4">
          <View className="border-b border-gray-200 px-4 pb-1.5 pt-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("mer.generelt")}
            </Text>
          </View>
          <MenyRad
            ikon={GitBranch}
            tekst={t("nav.dokumentflyt")}
            onPress={() => router.push("/dokumentflyt")}
          />
          {/* 2a/K6: Kontakter-lesevisning */}
          <MenyRad
            ikon={Contact}
            tekst={t("nav.kontakter")}
            onPress={() => router.push("/kontakter")}
          />
          {!timerSkjult && (
            <>
              <MenyRad
                ikon={Clock}
                tekst={t("nav.timer")}
                badge={
                  conflictAntall > 0
                    ? { tekst: `${conflictAntall}`, farge: "rod" }
                    : pendingAntall > 0
                      ? { tekst: `${pendingAntall}`, farge: "gul" }
                      : undefined
                }
                onPress={() => router.push("/timer")}
              />
              <MenyRad
                ikon={BarChart3}
                tekst={t("nav.timerMine")}
                onPress={() => router.push("/timer/mine")}
              />
              {kanAttestereFirma?.kanAttestere && (
                <MenyRad
                  ikon={ClipboardCheck}
                  tekst={t("timer.attestering.tittel")}
                  onPress={() => router.push("/timer/attestering")}
                />
              )}
            </>
          )}
          {/* Handling, ikke navigasjon: kjører offline-klargjøring inline og
              viser resultatet i radteksten. Chevron skjules — raden går ingen steder. */}
          <MenyRad ikon={WifiOff} tekst={offlineTekst ?? t("mer.forberedOffline")} onPress={startOffline} visChevron={false} />
          {/* Varig lagret-status — leses fra SQLite/disk ved fokus (feltfunn A). Lar Kenneth
              se på forhånd om det han vil åpne i felt faktisk er lagret. */}
          {lagretStatus && (
            <View className="border-b border-gray-100 bg-white px-4 pb-2.5 pt-0.5">
              <Text className="text-xs text-gray-500">
                {lagretStatus.dokumenter === 0 && lagretStatus.tegninger === 0
                  ? t("mer.offline.ingentingLagret")
                  : t("mer.offline.lagret", {
                      dokumenter: lagretStatus.dokumenter,
                      tegninger: lagretStatus.tegninger,
                    }) +
                    (lagretStatus.sistKlargjort
                      ? t("mer.offline.sistKlargjort", {
                          tid: new Date(lagretStatus.sistKlargjort).toLocaleString(),
                        })
                      : "")}
              </Text>
            </View>
          )}
        </View>

        {/* Firma — kun synlig ved multi-firma-medlemskap */}
        {firmaer.length > 1 && (
          <View className="mt-4">
            <View className="border-b border-gray-200 px-4 pb-1.5 pt-3">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("mer.mittFirma")}
              </Text>
            </View>
            <Pressable
              onPress={() => setVisFirmaVelger(true)}
              className="flex-row items-center justify-between border-b border-gray-100 bg-white px-4 py-3.5 active:bg-gray-50"
            >
              <View className="flex-row items-center gap-3">
                <Building2 size={20} color="#6b7280" />
                <Text className="text-base text-gray-900">
                  {valgtFirma?.name ?? t("firma.velgFirma")}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-blue-600">{t("mer.byttFirma")}</Text>
                <ChevronRight size={18} color="#d1d5db" />
              </View>
            </Pressable>
          </View>
        )}

        {/* Språk */}
        <View className="mt-4">
          <View className="border-b border-gray-200 px-4 pb-1.5 pt-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("toppbar.spraak")}
            </Text>
          </View>
          <Pressable
            onPress={() => setVisSpraakModal(true)}
            className="flex-row items-center justify-between border-b border-gray-100 bg-white px-4 py-3.5 active:bg-gray-50"
          >
            <View className="flex-row items-center gap-3">
              <Globe size={20} color="#6b7280" />
              <Text className="text-base text-gray-900">{t("toppbar.spraak")}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500">
                {aktivtSpraak?.flagg} {aktivtSpraak?.navn ?? i18n.language}
              </Text>
              <ChevronRight size={18} color="#d1d5db" />
            </View>
          </Pressable>
        </View>

        {/* Brukerprofil */}
        <View className="mx-4 mt-6 rounded-xl bg-white p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-sitedoc-blue">
              <Text className="text-base font-bold text-white">
                {initialer}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">
                {bruker?.name ?? t("mer.ukjentBruker")}
              </Text>
              <Text className="text-sm text-gray-500">
                {bruker?.email ?? ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Logg ut */}
        <View className="mx-4 mt-6">
          <Pressable
            onPress={loggUt}
            className="items-center rounded-lg bg-red-50 py-3 active:bg-red-100"
          >
            <View className="flex-row items-center gap-2">
              <LogOut size={18} color="#ef4444" />
              <Text className="text-base font-medium text-red-600">
                {t("toppbar.loggUt")}
              </Text>
            </View>
          </Pressable>
        </View>

        <VersjonsFooter className="mt-6 mb-2" />
      </ScrollView>

      {/* Språkvelger-modal */}
      <Modal visible={visSpraakModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setVisSpraakModal(false)}
          className="flex-1 bg-black/30 justify-end"
        >
          <View className="rounded-t-2xl bg-white pb-8 pt-4">
            <Text className="mb-3 px-5 text-sm font-semibold text-gray-900">{t("dokumentleser.velgSpraak")}</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {STOETTEDE_SPRAAK.map((spraak) => {
                const erValgt = spraak.kode === i18n.language;
                return (
                  <TouchableOpacity
                    key={spraak.kode}
                    onPress={() => velgSpraak(spraak.kode)}
                    className={`flex-row items-center gap-3 px-5 py-3 ${erValgt ? "bg-blue-50" : ""}`}
                  >
                    <Text className="text-base">{spraak.flagg}</Text>
                    <Text className={`flex-1 text-sm ${erValgt ? "font-semibold text-sitedoc-primary" : "text-gray-700"}`}>
                      {spraak.navn}
                    </Text>
                    {erValgt && <Check size={18} color="#1e40af" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <FirmaVelger synlig={visFirmaVelger} onLukk={() => setVisFirmaVelger(false)} />
    </SafeAreaView>
  );
}

function MenyRad({
  ikon: Ikon,
  tekst,
  deaktivert,
  onPress,
  badge,
  visChevron = true,
}: {
  ikon: LucideIcon;
  tekst: string;
  deaktivert?: boolean;
  onPress?: () => void;
  badge?: { tekst: string; farge: "rod" | "gul" };
  visChevron?: boolean;
}) {
  const badgeBg = badge?.farge === "rod" ? "bg-red-500" : "bg-yellow-500";
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between border-b border-gray-100 bg-white px-4 py-3.5 active:bg-gray-50"
      style={deaktivert ? { opacity: 0.4 } : undefined}
    >
      <View className="flex-row items-center gap-3">
        <Ikon size={20} color="#6b7280" />
        <Text className="text-base text-gray-900">{tekst}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        {badge && (
          <View className={`rounded-full px-2 py-0.5 ${badgeBg}`}>
            <Text className="text-xs font-bold text-white">{badge.tekst}</Text>
          </View>
        )}
        {visChevron && <ChevronRight size={18} color="#d1d5db" />}
      </View>
    </Pressable>
  );
}
