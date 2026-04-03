import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  useWindowDimensions,
  Modal,
  Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft, Download, FileText, Check, X } from "lucide-react-native";
import { trpc } from "../../src/lib/trpc";
import { hentWebUrl } from "../../src/config/auth";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";
import { useAuth } from "../../src/providers/AuthProvider";

interface Blokk {
  id: string;
  sortOrder: number;
  pageNumber: number | null;
  blockType: string;
  content: string;
  headingLevel: number | null;
  imageUrl: string | null;
}

export default function DokumentLeser() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bruker } = useAuth();
  const { width: skjermBredde } = useWindowDimensions();

  // Bestem brukerens foretrukne språk (for initial visning)
  const brukerSpraak = bruker?.language ?? "nb";
  const [språk, setSpråk] = useState(brukerSpraak);
  const [visSpraakmeny, setVisSpraakmeny] = useState(false);
  const [zoomBilde, setZoomBilde] = useState<string | null>(null);

  const { data, isLoading } = trpc.mappe.hentDokumentBlokker.useQuery(
    { documentId: id ?? "", language: språk },
    { enabled: !!id },
  );

  // Fallback til tilgjengelig språk hvis valgt språk ikke har blokker
  useEffect(() => {
    if (data && data.blokker.length === 0 && data.tilgjengeligeSprak.length > 0) {
      const fallback = data.tilgjengeligeSprak[0]!;
      if (fallback !== språk) setSpråk(fallback);
    }
  }, [data, språk]);

  const valgtSpråkInfo = STOETTEDE_SPRAAK.find((s) => s.kode === språk);
  const baseUrl = hentWebUrl();

  // Åpne PDF i ekstern nettleser
  const åpnePdf = useCallback(async () => {
    if (!data?.fileUrl) return;
    const url = `${baseUrl}/api${data.fileUrl}`;
    Linking.openURL(url);
  }, [data?.fileUrl, baseUrl]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <Header
          tittel="..."
          onTilbake={() => router.back()}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      </SafeAreaView>
    );
  }

  // Tom tilstand
  if (!data || (data.blokker.length === 0 && data.tilgjengeligeSprak.length === 0)) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <Header
          tittel={data?.filename ?? "Dokument"}
          onTilbake={() => router.back()}
        />
        <View className="flex-1 items-center justify-center px-6">
          <FileText size={48} color="#d1d5db" />
          <Text className="mt-4 text-center text-sm text-gray-500">
            Dokumentet er ikke klart for visning ennå.
          </Text>
          {data?.fileUrl && (
            <TouchableOpacity
              onPress={åpnePdf}
              className="mt-4 rounded-lg bg-sitedoc-primary px-5 py-2.5"
            >
              <Text className="text-sm font-medium text-white">Last ned PDF</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Header
        tittel={data.filename}
        onTilbake={() => router.back()}
        språkKnapp={
          data.tilgjengeligeSprak.length > 1 ? (
            <TouchableOpacity
              onPress={() => setVisSpraakmeny(true)}
              className="flex-row items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5"
            >
              <Text className="text-xs">{valgtSpråkInfo?.flagg ?? "🌐"}</Text>
              <Text className="text-xs text-gray-700">{valgtSpråkInfo?.navn ?? språk}</Text>
            </TouchableOpacity>
          ) : undefined
        }
        onLastNed={åpnePdf}
        harPdf={!!data.fileUrl}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24 }}>
        {data.blokker.map((blokk) => (
          <BlokkRenderer
            key={blokk.id}
            blokk={blokk as Blokk}
            baseUrl={baseUrl}
            skjermBredde={skjermBredde}
            onZoomBilde={setZoomBilde}
          />
        ))}
        <View className="h-12" />
      </ScrollView>

      {/* Språkvelger-modal */}
      <Modal visible={visSpraakmeny} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setVisSpraakmeny(false)}
          className="flex-1 bg-black/30 justify-end"
        >
          <View className="rounded-t-2xl bg-white pb-8 pt-4">
            <Text className="mb-3 px-5 text-sm font-semibold text-gray-900">Velg språk</Text>
            {data.tilgjengeligeSprak.map((kode) => {
              const info = STOETTEDE_SPRAAK.find((s) => s.kode === kode);
              const erValgt = kode === språk;
              return (
                <TouchableOpacity
                  key={kode}
                  onPress={() => { setSpråk(kode); setVisSpraakmeny(false); }}
                  className={`flex-row items-center gap-3 px-5 py-3 ${erValgt ? "bg-blue-50" : ""}`}
                >
                  <Text className="text-base">{info?.flagg ?? "🌐"}</Text>
                  <Text className={`text-sm ${erValgt ? "font-semibold text-sitedoc-primary" : "text-gray-700"}`}>
                    {info?.navn ?? kode}
                  </Text>
                  {erValgt && <Check size={18} color="#1e40af" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Zoom-modal for bilder */}
      <Modal visible={!!zoomBilde} transparent animationType="fade">
        <View className="flex-1 bg-black">
          <SafeAreaView className="flex-1">
            <TouchableOpacity
              onPress={() => setZoomBilde(null)}
              className="absolute right-4 top-2 z-10 rounded-full bg-black/50 p-2"
            >
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
            <ScrollView
              maximumZoomScale={5}
              minimumZoomScale={1}
              contentContainerStyle={{ flex: 1, justifyContent: "center", alignItems: "center" }}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              bouncesZoom
            >
              {zoomBilde && (
                <Image
                  source={{ uri: zoomBilde }}
                  style={{ width: skjermBredde, height: skjermBredde }}
                  resizeMode="contain"
                />
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                              */
/* ------------------------------------------------------------------ */

function Header({
  tittel,
  onTilbake,
  språkKnapp,
  onLastNed,
  harPdf,
}: {
  tittel: string;
  onTilbake: () => void;
  språkKnapp?: React.ReactNode;
  onLastNed?: () => void;
  harPdf?: boolean;
}) {
  return (
    <View className="flex-row items-center border-b border-gray-200 px-3 py-2.5">
      <TouchableOpacity onPress={onTilbake} className="mr-2 rounded-lg p-1.5">
        <ArrowLeft size={22} color="#374151" />
      </TouchableOpacity>
      <Text className="flex-1 text-sm font-semibold text-gray-900" numberOfLines={1}>
        {tittel}
      </Text>
      {harPdf && onLastNed && (
        <TouchableOpacity onPress={onLastNed} className="mr-1 rounded-lg p-1.5">
          <Download size={20} color="#6b7280" />
        </TouchableOpacity>
      )}
      {språkKnapp}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  BlokkRenderer                                                       */
/* ------------------------------------------------------------------ */

function BlokkRenderer({
  blokk,
  baseUrl,
  skjermBredde,
  onZoomBilde,
}: {
  blokk: Blokk;
  baseUrl: string;
  skjermBredde: number;
  onZoomBilde: (url: string) => void;
}) {
  switch (blokk.blockType) {
    case "heading": {
      const nivå = blokk.headingLevel ?? 2;
      const størrelse = nivå <= 1 ? "text-xl" : nivå === 2 ? "text-lg" : nivå === 3 ? "text-base" : "text-sm";
      const margin = nivå <= 1 ? "mt-8 mb-3" : nivå === 2 ? "mt-6 mb-2" : "mt-4 mb-1.5";
      return (
        <Text className={`font-bold text-gray-900 ${størrelse} ${margin}`}>
          {fjernHtml(blokk.content)}
        </Text>
      );
    }

    case "text":
      return (
        <Text className="mb-3 text-base leading-7 text-gray-800">
          {fjernHtml(blokk.content)}
        </Text>
      );

    case "image": {
      if (!blokk.imageUrl) return null;
      const bildeUrl = `${baseUrl}/api${blokk.imageUrl}`;
      const erFullBredde = blokk.imageUrl.includes("_full.");
      const bredde = erFullBredde ? skjermBredde - 32 : Math.min(skjermBredde - 32, 400);
      return (
        <TouchableOpacity
          onPress={() => onZoomBilde(bildeUrl)}
          className="my-3 items-center"
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: bildeUrl }}
            style={{ width: bredde, height: bredde * 0.75, borderRadius: 8 }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      );
    }

    case "caption": {
      const tekst = fjernHtml(blokk.content).trim();
      if (!tekst) return null;
      return (
        <Text className="-mt-1 mb-3 text-center text-xs italic text-gray-500">
          {tekst}
        </Text>
      );
    }

    case "table":
      // Tabeller har HTML-innhold — vis som enkel tekst-representasjon
      return (
        <View className="my-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <Text className="text-xs text-gray-600">{fjernHtml(blokk.content)}</Text>
        </View>
      );

    default:
      return (
        <Text className="mb-3 text-sm text-gray-700">
          {blokk.content}
        </Text>
      );
  }
}

/* ------------------------------------------------------------------ */
/*  Hjelpefunksjoner                                                    */
/* ------------------------------------------------------------------ */

/** Fjern HTML-tagger for ren tekst i React Native */
function fjernHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}
