import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native";
import { ChevronDown, MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import { trpc } from "../lib/trpc";
import { useProsjekt } from "../kontekst/ProsjektKontekst";

// Persistering av sist brukt bygning/tegning per prosjekt
const BYGNING_KEY_PREFIX = "sitedoc_sist_bygning_";
const TEGNING_KEY_PREFIX = "sitedoc_sist_tegning_";

async function lagreVerdi(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(key, value);
  }
}

async function hentVerdi(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

async function slettVerdi(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(key);
  }
}

/** Sjekk om GPS-koordinat er innenfor tegningens georeferanse-bounds */
function erInnenforBounds(
  lat: number,
  lng: number,
  geo: { point1: { gps: { lat: number; lng: number } }; point2: { gps: { lat: number; lng: number } } },
): boolean {
  const minLat = Math.min(geo.point1.gps.lat, geo.point2.gps.lat);
  const maxLat = Math.max(geo.point1.gps.lat, geo.point2.gps.lat);
  const minLng = Math.min(geo.point1.gps.lng, geo.point2.gps.lng);
  const maxLng = Math.max(geo.point1.gps.lng, geo.point2.gps.lng);
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

type Prioritet = "low" | "medium" | "high" | "critical";

interface EntrepriseData {
  id: string;
  name: string;
}

interface MalData {
  id: string;
  name: string;
  prefix: string | null;
  category: string;
  subjects?: string[];
}

interface DokumentflytData {
  id: string;
  name: string;
  enterpriseId: string | null;
  medlemmer: Array<{
    id: string;
    steg: number;
    rolle: string;
    enterprise: { id: string; name: string } | null;
  }>;
  maler: Array<{
    templateId: string;
    template: { id: string; name: string; category: string };
  }>;
}

interface BygningData {
  id: string;
  name: string;
}

interface GeoReferanse {
  point1: { gps: { lat: number; lng: number }; pixel: { x: number; y: number } };
  point2: { gps: { lat: number; lng: number }; pixel: { x: number; y: number } };
}

interface TegningData {
  id: string;
  name: string;
  drawingNumber: string | null;
  geoReference?: GeoReferanse | null;
  byggeplassId?: string | null;
  byggeplass?: { id: string; name: string } | null;
}

interface OpprettDokumentModalProps {
  synlig: boolean;
  kategori: "sjekkliste" | "oppgave";
  mal: MalData;
  onOpprettet: (id: string) => void;
  onLukk: () => void;
  onModalLukket?: () => void;
  // Props for oppgave fra sjekkliste
  sjekklisteId?: string;
  sjekklisteFeltId?: string;
  sjekklisteNummer?: string;
  feltLabel?: string;
}

const PRIORITETER: { verdi: Prioritet; labelKey: string }[] = [
  { verdi: "low", labelKey: "prioritet.lav" },
  { verdi: "medium", labelKey: "prioritet.middels" },
  { verdi: "high", labelKey: "prioritet.hoey" },
  { verdi: "critical", labelKey: "prioritet.kritisk" },
];

const PRIORITET_FARGER: Record<Prioritet, string> = {
  low: "bg-gray-200 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export function OpprettDokumentModal({
  synlig,
  kategori,
  mal,
  onOpprettet,
  onLukk,
  onModalLukket,
  sjekklisteId,
  sjekklisteFeltId,
  sjekklisteNummer,
  feltLabel,
}: OpprettDokumentModalProps) {
  const { t } = useTranslation();
  const erOppgave = kategori === "oppgave";
  const erFraSjekkliste = !!sjekklisteId && !!sjekklisteFeltId;
  const { valgtProsjektId } = useProsjekt();

  const [emne, setEmne] = useState("");
  const [prioritet, setPrioritet] = useState<Prioritet>("medium");
  const [oppretterEntrepriseId, setOppretterEntrepriseId] = useState<string | null>(null);
  const [valgtBygningId, setValgtBygningId] = useState<string | null>(null);
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);
  const [valgtDokumentflytId, setValgtDokumentflytId] = useState<string | null>(null);
  const [lokasjonKilde, setLokasjonKilde] = useState<"gps" | "lagret" | "manuell" | null>(null);
  const [visLokasjonListe, setVisLokasjonListe] = useState(false);
  const [visOppretterListe, setVisOppretterListe] = useState(false);
  const [visDokumentflytListe, setVisDokumentflytListe] = useState(false);
  const [visBygningListe, setVisBygningListe] = useState(false);
  const [visTegningListe, setVisTegningListe] = useState(false);
  const [visEmneListe, setVisEmneListe] = useState(false);

  // Hent ALLE tegninger for prosjektet (for GPS-matching, ufiltrert)
  const alleTegningerQuery = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const alleTegninger = (alleTegningerQuery.data ?? []) as unknown as TegningData[];

  // GPS + sist brukt lokasjon ved modalåpning
  const harKjørtLokasjon = useRef(false);
  useEffect(() => {
    if (!synlig || !valgtProsjektId || harKjørtLokasjon.current || alleTegninger.length === 0) return;
    harKjørtLokasjon.current = true;

    (async () => {
      // Hent sist brukte fra lagring
      const lagretBygningId = await hentVerdi(`${BYGNING_KEY_PREFIX}${valgtProsjektId}`);
      const lagretTegningId = await hentVerdi(`${TEGNING_KEY_PREFIX}${valgtProsjektId}`);

      // Forsøk GPS
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const { latitude, longitude } = pos.coords;

          // Finn tegninger der GPS er innenfor bounds
          const treff = alleTegninger.filter((t) => {
            const geo = t.geoReference as GeoReferanse | null;
            if (!geo) return false;
            return erInnenforBounds(latitude, longitude, geo);
          });

          if (treff.length > 0) {
            // Prioriter sist brukte blant GPS-treff
            const sistBrukt = lagretTegningId ? treff.find((t) => t.id === lagretTegningId) : null;
            const valgt = sistBrukt ?? treff[0];
            setValgtTegningId(valgt.id);
            setValgtBygningId(valgt.byggeplassId ?? valgt.byggeplass?.id ?? null);
            setLokasjonKilde("gps");
            return;
          }
        }
      } catch {
        // GPS feilet stille — fall gjennom til sist brukte
      }

      // Fallback: sist brukte tegning
      if (lagretBygningId) {
        setValgtBygningId(lagretBygningId);
        if (lagretTegningId) setValgtTegningId(lagretTegningId);
        setLokasjonKilde("lagret");
      }
    })();
  }, [synlig, valgtProsjektId, alleTegninger.length]);

  // Nullstill ref når modal lukkes
  useEffect(() => {
    if (!synlig) harKjørtLokasjon.current = false;
  }, [synlig]);

  // Forhåndsdefinerte emner fra malen
  const malSubjects = Array.isArray(mal.subjects)
    ? mal.subjects.filter((s) => s.trim() !== "")
    : [];
  const harSubjects = malSubjects.length > 0;

  // Hent prosjektnavn for auto-tittel
  const prosjektQuery = trpc.prosjekt.hentMine.useQuery(undefined, {
    enabled: synlig,
  });
  const prosjekter = prosjektQuery.data ?? [];
  const valgtProsjekt = prosjekter.find((p: { id: string }) => p.id === valgtProsjektId);
  const prosjektNavn = valgtProsjekt?.name ?? "";

  // Hent brukerens entrepriser (filtrert til mine)
  const mineEntrepriserQuery = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const mineEntrepriser = (mineEntrepriserQuery.data ?? []) as EntrepriseData[];

  // Fallback: hent alle entrepriser for svarer-visning
  const entrepriseQuery = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const entrepriser = (entrepriseQuery.data ?? []) as EntrepriseData[];

  // (Auto-velg entreprise gjøres i entrepriserMedFlyt-effekten ovenfor)

  // Hent dokumentflyter for prosjektet
  const dokumentflytQuery = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const alleDokumentflyter = (dokumentflytQuery.data ?? []) as DokumentflytData[];

  // Filtrer entrepriser: vis kun de som har minst én dokumentflyt for valgt mal
  const entrepriserMedFlyt = useMemo(() => {
    // Finn alle dokumentflyter som har denne malen
    const flyterForMal = alleDokumentflyter.filter(
      (df) => df.maler.some((m) => m.templateId === mal.id),
    );
    // Hent alle entreprise-IDer fra steg 1 (bestiller) i disse flytene
    const iderMedFlyt = new Set<string>();
    for (const df of flyterForMal) {
      // Bestiller = entreprise-ID på dokumentflyten, eller første steg
      if (df.enterpriseId) {
        iderMedFlyt.add(df.enterpriseId);
      }
      // Også inkluder entrepriser fra første steg
      const førsteSteg = df.medlemmer.filter((m) => m.steg === 1);
      for (const m of førsteSteg) {
        if (m.enterprise?.id) iderMedFlyt.add(m.enterprise.id);
      }
    }
    return mineEntrepriser.filter((e) => iderMedFlyt.has(e.id));
  }, [alleDokumentflyter, mineEntrepriser, mal.id]);

  // Auto-velg entreprise hvis kun én har flyt for malen
  useEffect(() => {
    if (entrepriserMedFlyt.length === 1 && !oppretterEntrepriseId) {
      setOppretterEntrepriseId(entrepriserMedFlyt[0].id);
    }
  }, [entrepriserMedFlyt, oppretterEntrepriseId]);

  // Dokumentflyter som matcher valgt entreprise + mal
  const matchendeDokumentflyter = useMemo(() => {
    if (!oppretterEntrepriseId) return [];
    return alleDokumentflyter.filter((df) => {
      const harMal = df.maler.some((m) => m.templateId === mal.id);
      if (!harMal) return false;
      // Sjekk at entreprisen er bestiller (enterpriseId eller steg 1)
      if (df.enterpriseId === oppretterEntrepriseId) return true;
      return df.medlemmer.some(
        (m) => m.steg === 1 && m.enterprise?.id === oppretterEntrepriseId,
      );
    });
  }, [alleDokumentflyter, oppretterEntrepriseId, mal.id]);

  // Auto-velg dokumentflyt: kun én → koble automatisk
  useEffect(() => {
    if (matchendeDokumentflyter.length === 1) {
      setValgtDokumentflytId(matchendeDokumentflyter[0].id);
    } else if (matchendeDokumentflyter.length === 0) {
      setValgtDokumentflytId(null);
    }
  }, [matchendeDokumentflyter]);

  const valgtDokumentflyt = matchendeDokumentflyter.find((df) => df.id === valgtDokumentflytId) ?? null;

  // Svarer-entreprise utledes fra valgt dokumentflyt (steg 2, eller steg 1 hvis intern)
  const { autoSvarerEntrepriseId, autoSvarerNavn } = useMemo(() => {
    if (!valgtDokumentflyt) return { autoSvarerEntrepriseId: null, autoSvarerNavn: "" };
    // Finn mottaker (steg 2), fallback til steg 1 (intern flyt)
    const steg2 = valgtDokumentflyt.medlemmer.find((m) => m.steg === 2);
    const mottaker = steg2 ?? valgtDokumentflyt.medlemmer.find((m) => m.steg === 1);
    const eId = mottaker?.enterprise?.id ?? valgtDokumentflyt.enterpriseId ?? null;
    const eNavn = mottaker?.enterprise?.name ??
      entrepriser.find((e) => e.id === eId)?.name ?? "";
    return { autoSvarerEntrepriseId: eId, autoSvarerNavn: eNavn };
  }, [valgtDokumentflyt, entrepriser]);

  // Hent bygninger for prosjektet
  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const bygninger = (bygningQuery.data ?? []) as BygningData[];

  // Tegninger filtrert etter valgt bygning (for manuell dropdown)
  const bygningTegninger = useMemo(() => {
    if (!valgtBygningId) return [];
    return alleTegninger.filter((t) => (t.byggeplassId ?? t.byggeplass?.id) === valgtBygningId);
  }, [alleTegninger, valgtBygningId]);

  // Lokasjonsvisning
  const valgtTegning = alleTegninger.find((t) => t.id === valgtTegningId);
  const valgtBygning = valgtTegning?.byggeplass ?? bygninger.find((b) => b.id === valgtBygningId);
  const lokasjonTekst = useMemo(() => {
    const deler: string[] = [];
    if (valgtBygning?.name) deler.push(valgtBygning.name);
    if (valgtTegning) {
      deler.push(valgtTegning.drawingNumber
        ? `${valgtTegning.drawingNumber} ${valgtTegning.name}`
        : valgtTegning.name);
    }
    return deler.join(" · ") || null;
  }, [valgtBygning, valgtTegning]);

  // eslint-disable-next-line
  const opprettSjekkliste = trpc.sjekkliste.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      const resultat = _data as { id: string };
      nullstillSkjema();
      onOpprettet(resultat.id);
    },
    onError: (feil: { message: string }) => {
      Alert.alert(t("feil.tittel"), feil.message || t("opprettModal.kunneIkkeOpprette"));
    },
  });

  // eslint-disable-next-line
  const opprettOppgave = trpc.oppgave.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      const resultat = _data as { id: string };
      nullstillSkjema();
      onOpprettet(resultat.id);
    },
    onError: (feil: { message: string }) => {
      Alert.alert(t("feil.tittel"), feil.message || t("opprettModal.kunneIkkeOpprette"));
    },
  });

  const erPending = opprettSjekkliste.isPending || opprettOppgave.isPending;

  const nullstillSkjema = useCallback(() => {
    setEmne("");
    setPrioritet("medium");
    setOppretterEntrepriseId(null);
    setValgtDokumentflytId(null);
    setValgtBygningId(null);
    setValgtTegningId(null);
    setLokasjonKilde(null);
    setVisLokasjonListe(false);
    setVisOppretterListe(false);
    setVisDokumentflytListe(false);
    setVisBygningListe(false);
    setVisTegningListe(false);
    setVisEmneListe(false);
  }, []);

  const håndterAvbryt = useCallback(() => {
    nullstillSkjema();
    onLukk();
  }, [nullstillSkjema, onLukk]);

  const håndterOpprett = useCallback(() => {
    if (!oppretterEntrepriseId) {
      Alert.alert(t("opprettModal.manglerOppretter"), t("opprettModal.velgOppretterEntreprise"));
      return;
    }
    if (!valgtDokumentflyt || !autoSvarerEntrepriseId) {
      Alert.alert(
        t("opprettModal.manglerDokumentflyt"),
        t("opprettModal.manglerDokumentflytBeskrivelse"),
      );
      return;
    }

    // Lagre sist brukte bygning/tegning
    if (valgtProsjektId) {
      if (valgtBygningId) lagreVerdi(`${BYGNING_KEY_PREFIX}${valgtProsjektId}`, valgtBygningId);
      if (valgtTegningId) lagreVerdi(`${TEGNING_KEY_PREFIX}${valgtProsjektId}`, valgtTegningId);
    }

    if (kategori === "sjekkliste") {
      opprettSjekkliste.mutate({
        templateId: mal.id,
        bestillerEnterpriseId: oppretterEntrepriseId,
        utforerEnterpriseId: autoSvarerEntrepriseId,
        subject: emne.trim() || undefined,
        byggeplassId: valgtBygningId ?? undefined,
        drawingId: valgtTegningId ?? undefined,
      });
    } else {
      // Oppgave-tittel: fra sjekkliste eller prosjektnavn
      const oppgaveTittel = erFraSjekkliste && sjekklisteNummer && feltLabel
        ? `Oppgave fra ${sjekklisteNummer}: ${feltLabel}`
        : prosjektNavn;

      opprettOppgave.mutate({
        templateId: mal.id,
        bestillerEnterpriseId: oppretterEntrepriseId,
        utforerEnterpriseId: autoSvarerEntrepriseId,
        title: oppgaveTittel,
        priority: prioritet,
        checklistId: sjekklisteId || undefined,
        checklistFieldId: sjekklisteFeltId || undefined,
      });
    }
  }, [
    oppretterEntrepriseId,
    valgtDokumentflyt,
    autoSvarerEntrepriseId,
    kategori,
    mal.id,
    prosjektNavn,
    emne,
    valgtBygningId,
    valgtTegningId,
    prioritet,
    opprettSjekkliste,
    opprettOppgave,
    erFraSjekkliste,
    sjekklisteId,
    sjekklisteFeltId,
    sjekklisteNummer,
    feltLabel,
  ]);

  const kanOpprett = !!oppretterEntrepriseId && !!valgtDokumentflyt && !erPending;

  // Auto-opprett deaktivert — modal-animasjon + navigering kolliderer på iOS
  // Brukeren trykker "Opprett" manuelt

  // Lukk alle åpne dropdowns
  const lukkAlleDropdowns = () => {
    setVisOppretterListe(false);
    setVisDokumentflytListe(false);
    setVisLokasjonListe(false);
    setVisBygningListe(false);
    setVisTegningListe(false);
    setVisEmneListe(false);
  };

  const valgtOppretter = entrepriserMedFlyt.find((e) => e.id === oppretterEntrepriseId);

  return (
    <Modal visible={synlig} animationType="slide" onRequestClose={onLukk}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        {/* Header */}
        <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
          <Pressable onPress={håndterAvbryt} hitSlop={8}>
            <Text className="text-sm font-medium text-white">{t("handling.avbryt")}</Text>
          </Pressable>
          <Text className="text-sm font-semibold text-white">
            {kategori === "sjekkliste" ? t("sjekklister.opprett") : t("oppgave.ny")}
          </Text>
          <Pressable onPress={håndterOpprett} disabled={!kanOpprett} hitSlop={8}>
            {erPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text
                className={`text-sm font-medium ${kanOpprett ? "text-white" : "text-white/40"}`}
              >
                {t("handling.opprett")}
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {/* 1. Mal-info med prefix-badge */}
          <View className="border-b border-gray-100 bg-gray-50 px-4 py-3">
            <Text className="text-xs font-medium text-gray-500">{t("opprettModal.mal")}</Text>
            <View className="mt-1 flex-row items-center gap-2">
              <Text className="text-sm font-medium text-gray-900">{mal.name}</Text>
              {mal.prefix ? (
                <View className="rounded bg-blue-100 px-2 py-0.5">
                  <Text className="text-xs font-medium text-blue-700">{mal.prefix}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* 2. Prosjekt (read-only, auto fra kontekst) */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="text-xs font-medium text-gray-500">{t("opprettModal.prosjekt")}</Text>
            <Text className="mt-1 text-sm text-gray-800">
              {prosjektNavn || t("handling.laster")}
            </Text>
          </View>

          {/* 3. Emne — dropdown med forhåndsdefinerte tekster, eller fritekst som fallback */}
          {!erOppgave && (
            <View className="border-b border-gray-100 px-4 py-3">
              <Text className="mb-1 text-xs font-medium text-gray-500">{t("opprettModal.emne")}</Text>
              {harSubjects ? (
                <>
                  <Pressable
                    onPress={() => {
                      lukkAlleDropdowns();
                      setVisEmneListe(!visEmneListe);
                    }}
                    className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
                  >
                    <Text
                      className={`text-sm ${emne ? "text-gray-800" : "text-gray-400"}`}
                    >
                      {emne || t("opprettModal.velgEmne")}
                    </Text>
                    <ChevronDown size={16} color="#9ca3af" />
                  </Pressable>
                  {visEmneListe && (
                    <View className="mt-1 rounded-lg border border-gray-200 bg-white">
                      <Pressable
                        onPress={() => {
                          setEmne("");
                          setVisEmneListe(false);
                        }}
                        className="border-b border-gray-50 px-3 py-2.5"
                      >
                        <Text className="text-sm italic text-gray-400">{t("opprettModal.ingenEmne")}</Text>
                      </Pressable>
                      {malSubjects.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => {
                            setEmne(s);
                            setVisEmneListe(false);
                          }}
                          className={`border-b border-gray-50 px-3 py-2.5 ${emne === s ? "bg-blue-50" : ""}`}
                        >
                          <Text
                            className={`text-sm ${emne === s ? "font-medium text-blue-700" : "text-gray-700"}`}
                          >
                            {s}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <TextInput
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800"
                  placeholder={t("opprettModal.beskrivEmne")}
                  placeholderTextColor="#9ca3af"
                  value={emne}
                  onChangeText={setEmne}
                />
              )}
            </View>
          )}

          {/* Sjekkliste-referanse (kun for oppgave fra sjekkliste) */}
          {erOppgave && erFraSjekkliste && (
            <View className="border-b border-gray-100 bg-blue-50 px-4 py-3">
              <Text className="text-xs font-medium text-blue-600">{t("oppgave.fraSjekkliste")}</Text>
              <Text className="mt-0.5 text-sm text-blue-800">
                {sjekklisteNummer ? `${sjekklisteNummer}: ` : ""}{feltLabel ?? ""}
              </Text>
            </View>
          )}

          {/* 4. Prioritet — skjult i forenklet oppgaveflyt (redigeres i detaljskjerm) */}

          {/* 5. Bestiller-entreprise (kun entrepriser med dokumentflyt for malen) */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">
              {t("opprettModal.oppretterEntreprise")} *
            </Text>
            {entrepriserMedFlyt.length === 0 && dokumentflytQuery.isLoading ? (
              <View className="flex-row items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <ActivityIndicator size="small" color="#1e40af" />
                <Text className="text-sm text-gray-500">{t("opprettModal.henterDokumentflyt")}</Text>
              </View>
            ) : entrepriserMedFlyt.length === 0 ? (
              <Text className="text-sm text-amber-600">{t("opprettModal.ingenDokumentflyt")}</Text>
            ) : entrepriserMedFlyt.length === 1 ? (
              <View className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <Text className="text-sm text-gray-800">{entrepriserMedFlyt[0].name}</Text>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    lukkAlleDropdowns();
                    setVisOppretterListe(!visOppretterListe);
                  }}
                  className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
                >
                  <Text
                    className={`text-sm ${valgtOppretter ? "text-gray-800" : "text-gray-400"}`}
                  >
                    {valgtOppretter?.name ?? t("opprettModal.velgEntreprise")}
                  </Text>
                  <ChevronDown size={16} color="#9ca3af" />
                </Pressable>
                {visOppretterListe && (
                  <View className="mt-1 rounded-lg border border-gray-200 bg-white">
                    {entrepriserMedFlyt.map((e) => (
                      <Pressable
                        key={e.id}
                        onPress={() => {
                          setOppretterEntrepriseId(e.id);
                          setValgtDokumentflytId(null);
                          setVisOppretterListe(false);
                        }}
                        className={`border-b border-gray-50 px-3 py-2.5 ${oppretterEntrepriseId === e.id ? "bg-blue-50" : ""}`}
                      >
                        <Text
                          className={`text-sm ${oppretterEntrepriseId === e.id ? "font-medium text-blue-700" : "text-gray-700"}`}
                        >
                          {e.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* 6. Dokumentflyt — auto-koblet hvis kun én, ellers dropdown */}
          {oppretterEntrepriseId && (
            <View className="border-b border-gray-100 bg-gray-50 px-4 py-3">
              <Text className="text-xs font-medium text-gray-500">{t("opprettModal.svarerEntreprise")}</Text>
              {dokumentflytQuery.isLoading ? (
                <View className="mt-1 flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#1e40af" />
                  <Text className="text-sm text-gray-500">{t("opprettModal.henterDokumentflyt")}</Text>
                </View>
              ) : matchendeDokumentflyter.length === 0 ? (
                <Text className="mt-1 text-sm text-amber-600">
                  {t("opprettModal.ingenDokumentflyt")}
                </Text>
              ) : matchendeDokumentflyter.length === 1 ? (
                /* Én flyt — auto-koblet, vis read-only */
                <View className="mt-1 flex-row items-center gap-2">
                  <Text className="text-sm text-gray-800">{autoSvarerNavn}</Text>
                  {valgtDokumentflyt && !valgtDokumentflyt.medlemmer.some((m) => m.steg === 2) && (
                    <Text className="text-xs text-gray-400">({t("opprettModal.internFlyt")})</Text>
                  )}
                </View>
              ) : (
                /* Flere flyter — vis dropdown */
                <>
                  <Pressable
                    onPress={() => {
                      lukkAlleDropdowns();
                      setVisDokumentflytListe(!visDokumentflytListe);
                    }}
                    className="mt-1 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5"
                  >
                    <Text className={`text-sm ${valgtDokumentflyt ? "text-gray-800" : "text-gray-400"}`}>
                      {valgtDokumentflyt
                        ? `${valgtDokumentflyt.name} → ${autoSvarerNavn}`
                        : t("opprettModal.velgDokumentflyt")}
                    </Text>
                    <ChevronDown size={16} color="#9ca3af" />
                  </Pressable>
                  {visDokumentflytListe && (
                    <View className="mt-1 rounded-lg border border-gray-200 bg-white">
                      {matchendeDokumentflyter.map((df) => (
                        <Pressable
                          key={df.id}
                          onPress={() => {
                            setValgtDokumentflytId(df.id);
                            setVisDokumentflytListe(false);
                          }}
                          className={`border-b border-gray-50 px-3 py-2.5 ${valgtDokumentflytId === df.id ? "bg-blue-50" : ""}`}
                        >
                          <Text className={`text-sm ${valgtDokumentflytId === df.id ? "font-medium text-blue-700" : "text-gray-700"}`}>
                            {df.name}
                          </Text>
                          <Text className="text-xs text-gray-400">
                            → {df.medlemmer.find((m) => m.steg === 2)?.enterprise?.name ??
                               df.medlemmer.find((m) => m.steg === 1)?.enterprise?.name ?? ""}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* 7. Lokasjon — auto-valgt fra GPS eller sist brukt, kan byttes manuelt */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">Lokasjon</Text>
            {lokasjonTekst ? (
              <Pressable
                onPress={() => {
                  lukkAlleDropdowns();
                  setVisLokasjonListe(!visLokasjonListe);
                }}
                className="flex-row items-center gap-2"
              >
                <MapPin size={14} color="#6b7280" />
                <View className="flex-1">
                  <Text className="text-sm text-gray-800">{lokasjonTekst}</Text>
                  {lokasjonKilde === "gps" && (
                    <Text className="text-[10px] text-green-600">Auto: GPS-posisjon</Text>
                  )}
                  {lokasjonKilde === "lagret" && (
                    <Text className="text-[10px] text-gray-400">Sist brukte</Text>
                  )}
                </View>
                <ChevronDown size={14} color="#9ca3af" />
              </Pressable>
            ) : alleTegningerQuery.isLoading ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#6b7280" />
                <Text className="text-sm text-gray-400">Henter lokasjon…</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  lukkAlleDropdowns();
                  setVisLokasjonListe(!visLokasjonListe);
                }}
                className="flex-row items-center gap-2"
              >
                <MapPin size={14} color="#9ca3af" />
                <Text className="text-sm text-gray-400">Velg lokasjon…</Text>
                <ChevronDown size={14} color="#9ca3af" />
              </Pressable>
            )}

            {/* Manuell lokasjonsliste: bygning → tegning */}
            {visLokasjonListe && (
              <View className="mt-2 rounded-lg border border-gray-200 bg-white">
                {/* Bygningsvalg */}
                {bygninger.map((b) => (
                  <View key={b.id}>
                    <Pressable
                      onPress={() => {
                        if (valgtBygningId === b.id) {
                          setValgtBygningId(null);
                          setValgtTegningId(null);
                        } else {
                          setValgtBygningId(b.id);
                          setValgtTegningId(null);
                        }
                        setLokasjonKilde("manuell");
                      }}
                      className={`border-b border-gray-50 px-3 py-2.5 ${valgtBygningId === b.id ? "bg-blue-50" : ""}`}
                    >
                      <Text className={`text-sm font-medium ${valgtBygningId === b.id ? "text-blue-700" : "text-gray-700"}`}>
                        {b.name}
                      </Text>
                    </Pressable>
                    {/* Tegninger under valgt bygning */}
                    {valgtBygningId === b.id && bygningTegninger.length > 0 && (
                      <View className="bg-gray-50">
                        {bygningTegninger.map((t) => (
                          <Pressable
                            key={t.id}
                            onPress={() => {
                              setValgtTegningId(t.id);
                              setLokasjonKilde("manuell");
                              setVisLokasjonListe(false);
                            }}
                            className={`border-b border-gray-100 px-6 py-2 ${valgtTegningId === t.id ? "bg-blue-50" : ""}`}
                          >
                            <Text className={`text-sm ${valgtTegningId === t.id ? "font-medium text-blue-700" : "text-gray-600"}`}>
                              {t.drawingNumber ? `${t.drawingNumber} ${t.name}` : t.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                {/* Fjern lokasjon */}
                {(valgtBygningId || valgtTegningId) && (
                  <Pressable
                    onPress={() => {
                      setValgtBygningId(null);
                      setValgtTegningId(null);
                      setLokasjonKilde(null);
                      setVisLokasjonListe(false);
                    }}
                    className="px-3 py-2.5"
                  >
                    <Text className="text-sm italic text-gray-400">Fjern lokasjon</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
