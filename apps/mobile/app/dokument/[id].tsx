import { useState, useEffect, useCallback, useRef } from "react";
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
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download, FileText, Check, X, Plus, RefreshCw } from "lucide-react-native";
import { trpc } from "../../src/lib/trpc";
import { hentWebUrl } from "../../src/config/auth";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";
import { useAuth } from "../../src/providers/AuthProvider";
import { useNyNavigasjon } from "../../src/hooks/useNyNavigasjon";

interface Blokk {
  id: string;
  sortOrder: number;
  pageNumber: number | null;
  blockType: string;
  content: string;
  headingLevel: number | null;
  imageUrl: string | null;
}

type Motor = "opus-mt" | "google" | "deepl";

export default function DokumentLeser() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { bruker } = useAuth();
  const { width: skjermBredde } = useWindowDimensions();
  const nyNav = useNyNavigasjon();

  // Bestem brukerens foretrukne språk (for initial visning)
  const brukerSpraak = bruker?.language ?? "nb";
  const [språk, setSpråk] = useState(brukerSpraak);
  const [visSpraakmeny, setVisSpraakmeny] = useState(false);
  const [zoomBilde, setZoomBilde] = useState<string | null>(null);

  // 2c-tilstand (kun relevant med flagg på)
  const [visOversettMeny, setVisOversettMeny] = useState(false);
  const [sammenlignModus, setSammenlignModus] = useState(false);
  const [sammenlignBlokk, setSammenlignBlokk] = useState<{ id: string; content: string } | null>(null);

  const { data, isLoading, refetch } = trpc.mappe.hentDokumentBlokker.useQuery(
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

  const kildeSpraak = data?.sourceLanguage ?? "nb";
  const prosjektId = data?.projectId ?? "";
  const tilgjengelige = data?.tilgjengeligeSprak ?? [];

  // Språk under oversettelse (jobb aktiv, men blokker finnes ikke ennå) → amber-pille «…»
  const underArbeid = (data?.jobber ?? [])
    .filter((j) => (j.status === "pending" || j.status === "processing") && !tilgjengelige.includes(j.targetLang))
    .map((j) => j.targetLang);

  // Poll mens en oversettelse pågår → amber-pille blir grønn uten manuell refresh
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const harUnderArbeid = underArbeid.length > 0;
  useEffect(() => {
    if (!nyNav || !harUnderArbeid) return;
    const interval = setInterval(() => {
      refetchRef.current();
    }, 8000);
    return () => clearInterval(interval);
  }, [nyNav, harUnderArbeid]);

  // Sammenlign-query (lazy) — sender blokkId, API henter kildeoriginal
  const { data: sammenlignData, isLoading: sammenlignLaster } = trpc.modul.sammenlignOversettelse.useQuery(
    { projectId: prosjektId, blokkId: sammenlignBlokk?.id ?? "", targetLang: språk },
    { enabled: !!sammenlignBlokk && !!prosjektId && språk !== kildeSpraak },
  );

  // Start oversettelse til nytt språk («+ Oversett»)
  const oversettMut = trpc.mappe.oversettDokument.useMutation({
    onSuccess: () => {
      setVisOversettMeny(false);
      refetch();
    },
  });

  // Re-oversett hele dokumentet med valgt motor (fra sammenlign-arket)
  const reOversettMut = trpc.modul.reOversettDokument.useMutation({
    onSuccess: () => {
      setSammenlignBlokk(null);
      refetch();
    },
  });

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
          tittel={data?.filename ?? t("dokument.dokument")}
          onTilbake={() => router.back()}
        />
        <View className="flex-1 items-center justify-center px-6">
          <FileText size={48} color="#d1d5db" />
          <Text className="mt-4 text-center text-sm text-gray-500">
            {t("dokumentleser.ikkeKlar")}
          </Text>
          {data?.fileUrl && (
            <TouchableOpacity
              onPress={åpnePdf}
              className="mt-4 rounded-lg bg-sitedoc-blue px-5 py-2.5"
            >
              <Text className="text-sm font-medium text-white">{t("handling.lastNed")} PDF</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Rekkefølge på pillene: kilde → øvrige tilgjengelige → språk under oversettelse
  const pilleSpraak = [
    kildeSpraak,
    ...tilgjengelige.filter((s) => s !== kildeSpraak),
    ...underArbeid.filter((s) => s !== kildeSpraak && !tilgjengelige.includes(s)),
  ];
  // Språk som kan legges til (ikke kilde, ikke allerede tilgjengelig/under arbeid)
  const kanLeggesTil = STOETTEDE_SPRAAK.filter(
    (s) => s.kode !== kildeSpraak && !tilgjengelige.includes(s.kode) && !underArbeid.includes(s.kode),
  );
  const viserOversettelse = språk !== kildeSpraak;
  const kanKlikkeBlokk = sammenlignModus && viserOversettelse;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Header
        tittel={data.filename}
        onTilbake={() => router.back()}
        språkKnapp={
          !nyNav && data.tilgjengeligeSprak.length > 1 ? (
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

      {/* 2c — sticky språkpille-rad */}
      {nyNav && (
        <View className="border-b border-gray-200 bg-white">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, alignItems: "center", gap: 8 }}
          >
            {pilleSpraak.map((kode) => {
              const info = STOETTEDE_SPRAAK.find((s) => s.kode === kode);
              const erKilde = kode === kildeSpraak;
              const erAktiv = kode === språk;
              const laster = underArbeid.includes(kode);
              return (
                <TouchableOpacity
                  key={kode}
                  onPress={() => { if (!laster) setSpråk(kode); }}
                  disabled={laster}
                  style={{ minHeight: 44 }}
                  className={`flex-row items-center justify-center gap-1 rounded-full border px-3 ${
                    erAktiv
                      ? "border-sitedoc-blue bg-sitedoc-blue"
                      : laster
                        ? "border-amber-300 bg-amber-50"
                        : "border-gray-300 bg-white"
                  }`}
                >
                  {/* Punkt 4 (variant A): flagg foran koden på kilde-pillen forklarer språket */}
                  {erKilde && info?.flagg && (
                    <Text className="text-xs">{info.flagg}</Text>
                  )}
                  <Text
                    className={`text-xs font-semibold ${
                      erAktiv ? "text-white" : laster ? "text-amber-700" : "text-gray-700"
                    }`}
                  >
                    {(info?.kode ?? kode).toUpperCase()}
                  </Text>
                  {erKilde && (
                    <Text className={`text-[11px] ${erAktiv ? "text-blue-100" : "text-gray-400"}`}>
                      · {t("dokumentleser.kilde")}
                    </Text>
                  )}
                  {laster && <Text className="text-[11px] text-amber-600">…</Text>}
                </TouchableOpacity>
              );
            })}

            {/* + Oversett */}
            {kanLeggesTil.length > 0 && (
              <TouchableOpacity
                onPress={() => setVisOversettMeny(true)}
                style={{ minHeight: 44 }}
                className="flex-row items-center justify-center gap-1 rounded-full border border-gray-300 bg-white px-3"
              >
                <Plus size={13} color="#374151" />
                <Text className="text-xs font-semibold text-gray-700">{t("dokumentleser.oversett")}</Text>
              </TouchableOpacity>
            )}

            {/* Sammenlign-lenke */}
            {viserOversettelse && (
              <TouchableOpacity
                onPress={() => setSammenlignModus((v) => !v)}
                style={{ minHeight: 44 }}
                className="flex-row items-center justify-center px-2"
              >
                <Text className={`text-xs font-semibold ${sammenlignModus ? "text-sitedoc-blue" : "text-sitedoc-blue-light"}`}>
                  {t("dokumentleser.sammenlign")}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {/* 2c — grønt statusbanner (oversatt visning) */}
      {nyNav && viserOversettelse && !sammenlignModus && (
        <View className="flex-row items-center justify-between border-b border-green-100 bg-green-50 px-4 py-2">
          <Text className="text-xs text-green-800" numberOfLines={1}>
            {t("dokumentleser.oversattTil", { spraak: valgtSpråkInfo?.navn ?? språk })}
          </Text>
          <TouchableOpacity onPress={() => setSpråk(kildeSpraak)} hitSlop={8}>
            <Text className="text-xs font-medium text-green-800 underline">
              {t("dokumentleser.visOriginal")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2c — sammenlign-modus-hint */}
      {nyNav && sammenlignModus && (
        <View className="flex-row items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2">
          <Text className="text-xs font-medium text-amber-800" numberOfLines={1}>
            {t("dokumentleser.sammenlignModus")}
          </Text>
          <TouchableOpacity onPress={() => { setSammenlignModus(false); setSammenlignBlokk(null); }} hitSlop={8}>
            <Text className="text-xs font-semibold text-amber-800 underline">
              {t("dokumentleser.avsluttSammenlign")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24 }}>
        {data.blokker.map((blokk) => (
          <BlokkRenderer
            key={blokk.id}
            blokk={blokk as Blokk}
            baseUrl={baseUrl}
            skjermBredde={skjermBredde}
            onZoomBilde={setZoomBilde}
            kanKlikke={kanKlikkeBlokk}
            valgt={sammenlignBlokk?.id === blokk.id}
            onTrykk={() => setSammenlignBlokk({ id: blokk.id, content: blokk.content })}
          />
        ))}
        <View className="h-12" />
      </ScrollView>

      {/* Språkvelger-modal (flagg av) */}
      <Modal visible={visSpraakmeny} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setVisSpraakmeny(false)}
          className="flex-1 bg-black/30 justify-end"
        >
          <View className="rounded-t-2xl bg-white pb-8 pt-4">
            <Text className="mb-3 px-5 text-sm font-semibold text-gray-900">{t("dokumentleser.velgSpraak")}</Text>
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
                  <Text className={`text-sm ${erValgt ? "font-semibold text-sitedoc-blue" : "text-gray-700"}`}>
                    {info?.navn ?? kode}
                  </Text>
                  {erValgt && <Check size={18} color="#1e40af" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 2c — «+ Oversett» språkvalg */}
      <Modal visible={visOversettMeny} transparent animationType="slide">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setVisOversettMeny(false)}
          className="flex-1 bg-black/30 justify-end"
        >
          <View className="max-h-[70%] rounded-t-2xl bg-white pb-8 pt-4">
            <Text className="mb-3 px-5 text-sm font-semibold text-gray-900">
              {t("dokumentleser.velgSpraakOversett")}
            </Text>
            <ScrollView>
              {kanLeggesTil.map((s) => (
                <TouchableOpacity
                  key={s.kode}
                  onPress={() => oversettMut.mutate({ documentId: id ?? "", targetLang: s.kode })}
                  disabled={oversettMut.isPending}
                  className="flex-row items-center gap-3 px-5 py-3"
                >
                  <Text className="text-base">{s.flagg}</Text>
                  <Text className="text-sm text-gray-700">{s.navn}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 2c — sammenlign-bunnark */}
      <Modal visible={!!sammenlignBlokk} transparent animationType="slide">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setSammenlignBlokk(null)}
          className="flex-1 bg-black/40 justify-end"
        >
          <TouchableOpacity activeOpacity={1} className="max-h-[80%] rounded-t-2xl bg-white px-5 pb-8 pt-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-gray-900">{t("dokumentleser.sammenlignTittel")}</Text>
              <TouchableOpacity onPress={() => setSammenlignBlokk(null)} hitSlop={10}>
                <X size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Kildetekst (original) */}
              {sammenlignData?.norskOriginal && (
                <View className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <Text className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {t("dokumentleser.original", {
                      spraak:
                        STOETTEDE_SPRAAK.find((s) => s.kode === (sammenlignData.kildesprak ?? kildeSpraak))?.navn ??
                        kildeSpraak,
                    })}
                  </Text>
                  <Text className="mt-1 text-sm text-gray-700">{sammenlignData.norskOriginal}</Text>
                </View>
              )}

              {sammenlignLaster ? (
                <View className="flex-row items-center gap-2 py-4">
                  <ActivityIndicator size="small" color="#6b7280" />
                  <Text className="text-sm text-gray-500">{t("dokumentleser.henterMotorer")}</Text>
                </View>
              ) : sammenlignData?.oversettelser && sammenlignData.oversettelser.length > 0 ? (
                <View className="gap-3">
                  {sammenlignData.oversettelser.map((r) => (
                    <View
                      key={r.motor}
                      className={`rounded-lg border bg-white p-3 ${r.feil ? "border-red-200" : "border-gray-200"}`}
                    >
                      <View className="mb-2 flex-row items-center justify-between">
                        <Text className="text-xs font-semibold text-gray-700">{r.navn}</Text>
                        {r.feil ? (
                          <Text className="text-[10px] text-red-500">{r.feil.slice(0, 40)}</Text>
                        ) : (
                          <TouchableOpacity
                            onPress={() =>
                              reOversettMut.mutate({
                                projectId: prosjektId,
                                documentId: id ?? "",
                                targetLang: språk,
                                motor: r.motor as Motor,
                              })
                            }
                            disabled={reOversettMut.isPending}
                            className="flex-row items-center gap-1.5 rounded-lg bg-sitedoc-blue px-3 py-1.5"
                          >
                            <RefreshCw size={12} color="#ffffff" />
                            <Text className="text-xs font-medium text-white">{t("dokumentleser.reOversett")}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {r.resultat && <Text className="text-sm leading-6 text-gray-800">{r.resultat}</Text>}
                    </View>
                  ))}

                  {reOversettMut.isPending && (
                    <View className="flex-row items-center gap-2 rounded-lg bg-blue-50 p-3">
                      <ActivityIndicator size="small" color="#1d4ed8" />
                      <Text className="text-sm text-blue-700">{t("dokumentleser.reOversetter")}</Text>
                    </View>
                  )}
                  {reOversettMut.isSuccess && (
                    <View className="flex-row items-center gap-2 rounded-lg bg-green-50 p-3">
                      <Check size={16} color="#0b7a4b" />
                      <Text className="text-sm text-green-700">{t("dokumentleser.oversettelseStartet")}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text className="py-2 text-sm text-gray-500">{t("dokumentleser.ingenAlternativer")}</Text>
              )}
              <View className="h-4" />
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Zoom-modal for bilder */}
      <Modal visible={!!zoomBilde} transparent animationType="fade">
        <View className="flex-1 bg-black">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-end px-4 py-3">
              <TouchableOpacity
                onPress={() => setZoomBilde(null)}
                hitSlop={12}
              >
                <X size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>
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
  kanKlikke,
  valgt,
  onTrykk,
}: {
  blokk: Blokk;
  baseUrl: string;
  skjermBredde: number;
  onZoomBilde: (url: string) => void;
  kanKlikke?: boolean;
  valgt?: boolean;
  onTrykk?: () => void;
}) {
  // I sammenlign-modus er tekstblokker trykkbare (heading/text/caption)
  const erTekst = ["heading", "text", "caption"].includes(blokk.blockType);
  const klikkbar = !!kanKlikke && erTekst;
  const valgtKlasse = valgt ? "bg-amber-100 rounded px-1 -mx-1" : "";

  const innhold = (() => {
    switch (blokk.blockType) {
      case "heading": {
        const nivå = blokk.headingLevel ?? 2;
        const størrelse = nivå <= 1 ? "text-xl" : nivå === 2 ? "text-lg" : nivå === 3 ? "text-base" : "text-sm";
        const margin = nivå <= 1 ? "mt-8 mb-3" : nivå === 2 ? "mt-6 mb-2" : "mt-4 mb-1.5";
        return (
          <Text className={`font-bold text-gray-900 ${størrelse} ${margin} ${valgtKlasse}`}>
            {fjernHtml(blokk.content)}
          </Text>
        );
      }

      case "text":
        return (
          <Text className={`mb-3 text-base leading-7 text-gray-800 ${valgtKlasse}`}>
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
          <Text className={`-mt-1 mb-3 text-center text-xs italic text-gray-500 ${valgtKlasse}`}>
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
  })();

  if (klikkbar && innhold) {
    return (
      <TouchableOpacity activeOpacity={0.6} onPress={onTrykk}>
        {innhold}
      </TouchableOpacity>
    );
  }
  return innhold;
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
