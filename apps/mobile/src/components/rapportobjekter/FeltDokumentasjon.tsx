import { useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, Image, Alert, Modal, ScrollView, InteractionManager, SafeAreaView, KeyboardAvoidingView, Platform } from "react-native";
import { Camera, Paperclip, Map, FileText, Trash2, Pencil } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { randomUUID } from "expo-crypto";
import type { Vedlegg } from "../../hooks/useSjekklisteSkjema";
import { komprimer, hentGps } from "../../services/bilde";
import { lastOppFil } from "../../services/opplasting";
import { lagreLokaltBilde, hentFilstorrelse } from "../../services/lokalBilde";
import { useOpplastingsKo } from "../../providers/OpplastingsKoProvider";
import { BildeAnnotering } from "../BildeAnnotering";
import { KameraModal } from "../KameraModal";
import { TegningsSkjermbilde } from "../TegningsSkjermbilde";
import { useProsjekt } from "../../kontekst/ProsjektKontekst";
import { AUTH_CONFIG } from "../../config/auth";

interface FeltDokumentasjonProps {
  kommentar: string;
  vedlegg: Vedlegg[];
  onEndreKommentar: (kommentar: string) => void;
  onLeggTilVedlegg: (vedlegg: Vedlegg) => void;
  onFjernVedlegg: (vedleggId: string) => void;
  leseModus?: boolean;
  sjekklisteId?: string;
  oppgaveIdForKo?: string;
  objektId: string;
  skjulKommentar?: boolean;
}

export function FeltDokumentasjon({
  kommentar,
  vedlegg,
  onEndreKommentar,
  onLeggTilVedlegg,
  onFjernVedlegg,
  leseModus,
  sjekklisteId,
  oppgaveIdForKo,
  objektId,
  skjulKommentar,
}: FeltDokumentasjonProps) {
  const [lasterOpp, settLasterOpp] = useState(false);
  const [annoteringBilde, settAnnoteringBilde] = useState<string | null>(null);
  const [visTegningsModal, settVisTegningsModal] = useState(false);
  const [visKamera, settVisKamera] = useState(false);
  const [valgtVedleggId, settValgtVedleggId] = useState<string | null>(null);
  const [visKommentarModal, settVisKommentarModal] = useState(false);
  const [lokalKommentar, settLokalKommentar] = useState("");
  const { valgtProsjektId } = useProsjekt();
  const { leggIKo } = useOpplastingsKo();

  const håndterBilde = useCallback(async (bildeUri: string, gpsLat?: number, gpsLng?: number) => {
    try {
      const filnavn = `IMG_${Date.now()}.jpg`;

      // 1. Lagre lokalt (instant, ~5ms)
      const lokalSti = await lagreLokaltBilde(bildeUri, filnavn);

      // 2. Hent filstørrelse
      const filstorrelse = await hentFilstorrelse(lokalSti);

      // 3. Legg til vedlegg med LOKAL URI (vises umiddelbart i filmrullen)
      const vedleggId = randomUUID();
      onLeggTilVedlegg({
        id: vedleggId,
        type: "bilde",
        url: lokalSti,
        filnavn,
      });

      // 4. Legg i bakgrunnskø (asynkront, ikke-blokkerende)
      await leggIKo({
        sjekklisteId,
        oppgaveId: oppgaveIdForKo,
        objektId,
        vedleggId,
        lokalSti,
        filnavn,
        mimeType: "image/jpeg",
        filstorrelse,
        gpsLat,
        gpsLng,
        gpsAktivert: gpsLat != null,
      });
    } catch (e) {
      const melding = e instanceof Error ? e.message : "Ukjent feil";
      console.error("Bildehåndtering feilet:", melding);
    }
  }, [sjekklisteId, oppgaveIdForKo, objektId, leggIKo, onLeggTilVedlegg]);

  const håndterKameraBilde = useCallback((uri: string) => {
    // Kameraet forblir åpent — prosesser bildet i bakgrunnen
    (async () => {
      const komprimert = await komprimer(uri);
      const gps = await hentGps();
      await håndterBilde(komprimert.uri, gps?.lat, gps?.lng);
    })();
  }, [håndterBilde]);

  const håndterVelgFil = useCallback(async () => {
    try {
      const resultat = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        copyToCacheDirectory: true,
      });

      if (resultat.canceled || !resultat.assets[0]) return;

      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });

      const fil = resultat.assets[0];
      settLasterOpp(true);
      const opplastet = await lastOppFil(fil.uri, fil.name, fil.mimeType ?? "application/octet-stream");

      onLeggTilVedlegg({
        id: randomUUID(),
        type: "fil",
        url: opplastet.fileUrl,
        filnavn: opplastet.fileName,
      });
    } catch {
      Alert.alert("Feil", "Kunne ikke laste opp filen");
    } finally {
      settLasterOpp(false);
    }
  }, [onLeggTilVedlegg]);

  const håndterTegningsSkjermbilde = useCallback((bildeUri: string) => {
    settVisTegningsModal(false);
    håndterBilde(bildeUri);
  }, [håndterBilde]);

  const valgtVedlegg = vedlegg.find((v) => v.id === valgtVedleggId);

  const håndterSlett = useCallback(() => {
    if (!valgtVedleggId) return;
    onFjernVedlegg(valgtVedleggId);
    settValgtVedleggId(null);
  }, [valgtVedleggId, onFjernVedlegg]);

  const håndterAnnoter = useCallback(() => {
    if (!valgtVedlegg || valgtVedlegg.type !== "bilde") return;
    settAnnoteringBilde(valgtVedlegg.url);
  }, [valgtVedlegg]);

  return (
    <View className="mt-2 gap-2">
      {/* Kommentarfelt — tappbar visning → modal */}
      {!skjulKommentar && (
        <>
          <Pressable
            onPress={() => {
              if (leseModus) return;
              settLokalKommentar(kommentar);
              settVisKommentarModal(true);
            }}
            className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 ${
              leseModus ? "" : ""
            }`}
          >
            <Text
              className={`text-sm ${
                kommentar ? "text-gray-700" : "text-gray-400"
              } ${leseModus ? "text-gray-500" : ""}`}
            >
              {kommentar || "Kommentar..."}
            </Text>
          </Pressable>

          <Modal visible={visKommentarModal} animationType="slide" onRequestClose={() => {
            onEndreKommentar(lokalKommentar);
            settVisKommentarModal(false);
          }}>
            <SafeAreaView className="flex-1 bg-white">
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                className="flex-1"
              >
                <View className="flex-row items-center justify-between border-b border-gray-200 bg-[#1e40af] px-4 py-3">
                  <Text className="flex-1 text-base font-semibold text-white">Kommentar</Text>
                  <Pressable
                    onPress={() => {
                      onEndreKommentar(lokalKommentar);
                      settVisKommentarModal(false);
                    }}
                    className="ml-3 rounded-lg bg-white/20 px-4 py-1.5"
                  >
                    <Text className="text-sm font-semibold text-white">Ferdig</Text>
                  </Pressable>
                </View>
                <TextInput
                  value={lokalKommentar}
                  onChangeText={settLokalKommentar}
                  placeholder="Skriv kommentar..."
                  multiline
                  autoFocus
                  textAlignVertical="top"
                  className="flex-1 px-4 py-3 text-base text-gray-900"
                />
              </KeyboardAvoidingView>
            </SafeAreaView>
          </Modal>
        </>
      )}

      {/* Verktøylinje (kun synlig når vedlegg er valgt) */}
      {!leseModus && valgtVedlegg && (
        <View className="flex-row gap-2">
          <Pressable
            onPress={håndterSlett}
            className="flex-row items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5"
          >
            <Trash2 size={14} color="#ef4444" />
            <Text className="text-xs font-medium text-red-600">Slett</Text>
          </Pressable>
          {valgtVedlegg.type === "bilde" && (
            <Pressable
              onPress={håndterAnnoter}
              className="flex-row items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5"
            >
              <Pencil size={14} color="#1e40af" />
              <Text className="text-xs font-medium text-blue-700">Annoter</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Filmrull — horisontal vedleggliste */}
      {vedlegg.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {vedlegg.map((v) => {
            const erValgt = v.id === valgtVedleggId;
            // Lokal fil → vis direkte, server-relativ → full URL
            const bildeUrl = v.url.startsWith("file://") || v.url.startsWith("/var/")
              ? v.url
              : v.url.startsWith("/")
                ? `${AUTH_CONFIG.apiUrl}${v.url}`
                : v.url;
            return (
              <Pressable
                key={v.id}
                onPress={() => {
                  if (leseModus) return;
                  settValgtVedleggId(erValgt ? null : v.id);
                }}
              >
                {v.type === "bilde" ? (
                  <Image
                    source={{ uri: bildeUrl }}
                    className={`h-[72px] w-[72px] rounded-lg ${
                      erValgt ? "border-2 border-blue-500" : ""
                    }`}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    className={`h-[72px] w-[72px] items-center justify-center rounded-lg bg-gray-100 ${
                      erValgt ? "border-2 border-blue-500" : ""
                    }`}
                  >
                    <FileText size={22} color="#6b7280" />
                    <Text className="mt-1 text-center text-[9px] text-gray-500" numberOfLines={1}>
                      {v.filnavn}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Handlingsknapper */}
      {!leseModus && (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => settVisKamera(true)}
            disabled={lasterOpp}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white py-2"
          >
            <Camera size={16} color="#6b7280" />
            <Text className="text-xs text-gray-600">Ta bilde</Text>
          </Pressable>
          <Pressable
            onPress={håndterVelgFil}
            disabled={lasterOpp}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white py-2"
          >
            <Paperclip size={16} color="#6b7280" />
            <Text className="text-xs text-gray-600">Velg fil</Text>
          </Pressable>
          {valgtProsjektId && (
            <Pressable
              onPress={() => settVisTegningsModal(true)}
              disabled={lasterOpp}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white py-2"
            >
              <Map size={16} color="#6b7280" />
              <Text className="text-xs text-gray-600">Tegning</Text>
            </Pressable>
          )}
        </View>
      )}

      {lasterOpp && (
        <Text className="text-center text-xs text-gray-400">Laster opp fil...</Text>
      )}

      {/* Bildeannotering modal */}
      <Modal visible={!!annoteringBilde} animationType="slide" presentationStyle="fullScreen">
        {annoteringBilde && (
          <BildeAnnotering
            bildeUri={annoteringBilde}
            onFerdig={async (annotert) => {
              settAnnoteringBilde(null);
              if (valgtVedleggId) {
                onFjernVedlegg(valgtVedleggId);
                settValgtVedleggId(null);
              }
              await håndterBilde(annotert);
            }}
            onAvbryt={() => {
              settAnnoteringBilde(null);
              settValgtVedleggId(null);
            }}
          />
        )}
      </Modal>

      {/* Kamera modal */}
      <KameraModal
        synlig={visKamera}
        onBilde={håndterKameraBilde}
        onLukk={() => settVisKamera(false)}
      />

      {/* Tegnings-skjermbilde modal */}
      <Modal
        visible={visTegningsModal && !!valgtProsjektId}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => settVisTegningsModal(false)}
      >
        {visTegningsModal && valgtProsjektId ? (
          <TegningsSkjermbilde
            prosjektId={valgtProsjektId}
            onFerdig={håndterTegningsSkjermbilde}
            onAvbryt={() => settVisTegningsModal(false)}
          />
        ) : null}
      </Modal>
    </View>
  );
}
