import { useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, Image, Alert, Modal } from "react-native";
import { Camera, Paperclip, Map, X, FileText } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { randomUUID } from "expo-crypto";
import type { Vedlegg } from "../../hooks/useSjekklisteSkjema";
import { taBilde, velgBilde } from "../../services/bilde";
import { lastOppFil } from "../../services/opplasting";
import { trpc } from "../../lib/trpc";
import { BildeAnnotering } from "../BildeAnnotering";
import { TegningsSkjermbilde } from "../TegningsSkjermbilde";
import { useProsjekt } from "../../kontekst/ProsjektKontekst";

interface FeltDokumentasjonProps {
  kommentar: string;
  vedlegg: Vedlegg[];
  onEndreKommentar: (kommentar: string) => void;
  onLeggTilVedlegg: (vedlegg: Vedlegg) => void;
  onFjernVedlegg: (vedleggId: string) => void;
  leseModus?: boolean;
  sjekklisteId: string;
}

export function FeltDokumentasjon({
  kommentar,
  vedlegg,
  onEndreKommentar,
  onLeggTilVedlegg,
  onFjernVedlegg,
  leseModus,
  sjekklisteId,
}: FeltDokumentasjonProps) {
  const [lasterOpp, settLasterOpp] = useState(false);
  const [annoteringBilde, settAnnoteringBilde] = useState<string | null>(null);
  const [visTegningsModal, settVisTegningsModal] = useState(false);
  const { valgtProsjektId } = useProsjekt();

  const bildeOpprettMutasjon = trpc.bilde.opprettForSjekkliste.useMutation();

  const håndterBilde = useCallback(async (bildeUri: string, gpsLat?: number, gpsLng?: number) => {
    settLasterOpp(true);
    try {
      const filnavn = `IMG_${Date.now()}.jpg`;
      const opplastet = await lastOppFil(bildeUri, filnavn, "image/jpeg");

      await bildeOpprettMutasjon.mutateAsync({
        checklistId: sjekklisteId,
        fileUrl: opplastet.fileUrl,
        fileName: opplastet.fileName,
        fileSize: opplastet.fileSize,
        gpsLat,
        gpsLng,
        gpsEnabled: gpsLat != null,
      });

      onLeggTilVedlegg({
        id: randomUUID(),
        type: "bilde",
        url: opplastet.fileUrl,
        filnavn: opplastet.fileName,
      });
    } catch {
      Alert.alert("Feil", "Kunne ikke laste opp bildet");
    } finally {
      settLasterOpp(false);
    }
  }, [sjekklisteId, bildeOpprettMutasjon, onLeggTilVedlegg]);

  const håndterTaBilde = useCallback(async () => {
    const resultat = await taBilde();
    if (!resultat) return;

    // Spør om annotering
    Alert.alert("Annoter bilde?", "Vil du legge til markeringer på bildet?", [
      {
        text: "Nei",
        onPress: () => håndterBilde(resultat.uri, resultat.gpsLat, resultat.gpsLng),
      },
      {
        text: "Ja",
        onPress: () => settAnnoteringBilde(resultat.uri),
      },
    ]);
  }, [håndterBilde]);

  const håndterVelgBilde = useCallback(async () => {
    const resultat = await velgBilde();
    if (!resultat) return;
    await håndterBilde(resultat.uri, resultat.gpsLat, resultat.gpsLng);
  }, [håndterBilde]);

  const håndterVelgFil = useCallback(async () => {
    try {
      const resultat = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        copyToCacheDirectory: true,
      });

      if (resultat.canceled || !resultat.assets[0]) return;

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
    // Spør om annotering
    Alert.alert("Annoter skjermbilde?", "Vil du legge til markeringer?", [
      {
        text: "Nei",
        onPress: () => håndterBilde(bildeUri),
      },
      {
        text: "Ja",
        onPress: () => settAnnoteringBilde(bildeUri),
      },
    ]);
  }, [håndterBilde]);

  return (
    <View className="mt-2 gap-2">
      {/* Kommentarfelt */}
      <TextInput
        value={kommentar}
        onChangeText={onEndreKommentar}
        placeholder="Kommentar..."
        multiline
        numberOfLines={2}
        textAlignVertical="top"
        editable={!leseModus}
        className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 ${
          leseModus ? "text-gray-500" : ""
        }`}
      />

      {/* Vedlegg-thumbnails */}
      {vedlegg.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {vedlegg.map((v) => (
            <View key={v.id} className="relative">
              {v.type === "bilde" ? (
                <Image
                  source={{ uri: v.url }}
                  className="h-16 w-16 rounded-lg"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-lg bg-gray-100">
                  <FileText size={20} color="#6b7280" />
                  <Text className="mt-0.5 text-center text-[9px] text-gray-500" numberOfLines={1}>
                    {v.filnavn}
                  </Text>
                </View>
              )}
              {!leseModus && (
                <Pressable
                  onPress={() => onFjernVedlegg(v.id)}
                  className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full bg-red-500"
                >
                  <X size={12} color="#ffffff" />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Handlingsknapper */}
      {!leseModus && (
        <View className="flex-row gap-2">
          <Pressable
            onPress={håndterTaBilde}
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
        <Text className="text-center text-xs text-gray-400">Laster opp...</Text>
      )}

      {/* Bildeannotering modal */}
      {annoteringBilde && (
        <Modal visible animationType="slide" presentationStyle="fullScreen">
          <BildeAnnotering
            bildeUri={annoteringBilde}
            onFerdig={(annotert) => {
              settAnnoteringBilde(null);
              håndterBilde(annotert);
            }}
            onAvbryt={() => {
              settAnnoteringBilde(null);
              // Last opp originalt bilde uten annotering
              håndterBilde(annoteringBilde);
            }}
          />
        </Modal>
      )}

      {/* Tegnings-skjermbilde modal */}
      {visTegningsModal && valgtProsjektId && (
        <Modal visible animationType="slide" presentationStyle="fullScreen">
          <TegningsSkjermbilde
            prosjektId={valgtProsjektId}
            onFerdig={håndterTegningsSkjermbilde}
            onAvbryt={() => settVisTegningsModal(false)}
          />
        </Modal>
      )}
    </View>
  );
}
