import { useState } from "react";
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Folder, FolderOpen, FileText, ChevronRight, ArrowLeft } from "lucide-react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useNyNavigasjon } from "../../src/hooks/useNyNavigasjon";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";

interface MappeTre {
  id: string;
  name: string;
  parentId: string | null;
  _count: { ftdDocuments: number };
  // 2a Dokumenter-tab (flagg PÅ): språk-arv per mappe
  effektiveSpraak?: string[];
  spraakArvet?: boolean;
  kildesprak?: string;
}

interface OversettStatus {
  tilgjengelig: string[];
  pågår: boolean;
  jobber: Array<{ lang: string; status: string }>;
}

interface Dokument {
  id: string;
  filename: string;
  fileType: string;
  processingState: string;
  uploadedAt: string;
  // Rike felt fra mappe.hentDokumenter (brukes kun flagg PÅ)
  sourceLanguage?: string;
  detectedLanguage?: string | null;
  languageConfirmed?: boolean;
  oversettelse?: OversettStatus | null;
}

// Målspråk-koder som er ferdig oversatt (utover kildespråket) → grønne chips.
function oversatteMaal(dok: Dokument): string[] {
  const tilgjengelig = dok.oversettelse?.tilgjengelig ?? [];
  return tilgjengelig.filter((l) => l !== (dok.sourceLanguage ?? "nb"));
}

export default function BoksSkjerm() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const nyNav = useNyNavigasjon();
  // Stabel av åpne mapper for navigering bakover
  const [mappeSti, setMappeSti] = useState<{ id: string; navn: string }[]>([]);
  const åpenMappe = mappeSti.length > 0 ? mappeSti[mappeSti.length - 1]! : null;

  const { data: mapper, isLoading: mapperLaster } = trpc.mappe.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const { data: dokumentData, isLoading: dokumenterLaster } = trpc.mappe.hentDokumenter.useQuery(
    { folderId: åpenMappe?.id ?? "" },
    { enabled: !!åpenMappe },
  );

  const bekreftSpraakMut = trpc.mappe.bekreftDokumentSpraak.useMutation();

  const alleMapper = (mapper ?? []) as MappeTre[];

  // Undermapper for gjeldende visning
  const barneMapper = alleMapper.filter(
    (m) => m.parentId === (åpenMappe?.id ?? null),
  );

  // Tell dokumenter rekursivt (direkte + undermapper)
  function tellDokumenterRekursivt(mappeId: string): number {
    const mappe = alleMapper.find((m) => m.id === mappeId);
    let total = mappe?._count.ftdDocuments ?? 0;
    for (const barn of alleMapper.filter((m) => m.parentId === mappeId)) {
      total += tellDokumenterRekursivt(barn.id);
    }
    return total;
  }

  const navigerTilMappe = (id: string, navn: string) => {
    setMappeSti((prev) => [...prev, { id, navn }]);
  };

  const navigerTilbake = () => {
    setMappeSti((prev) => prev.slice(0, -1));
  };

  const tittel = nyNav ? t("nav.dokumenter") : t("nav.mapper");

  if (!valgtProsjektId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <View className="border-b border-gray-200 bg-white px-4 py-3">
          <Text className="text-lg font-semibold text-gray-900">{tittel}</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <FolderOpen size={48} color="#9ca3af" />
          <Text className="mt-4 text-center text-sm text-gray-500">
            {t("hjem.velgProsjekt")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const prosjektKildesprak =
    (dokumentData as { prosjektKildesprak?: string })?.prosjektKildesprak ?? "nb";

  // Dokumenter i åpen mappe
  const dokumenter = åpenMappe
    ? ((dokumentData as { dokumenter?: Dokument[] })?.dokumenter ?? []) as Dokument[]
    : [];

  // Bygg samlet liste: undermapper først, deretter dokumenter
  type ListeItem =
    | { type: "mappe"; mappe: MappeTre; antall: number }
    | { type: "dokument"; dok: Dokument };

  const listeData: ListeItem[] = [
    ...barneMapper.map((m) => ({
      type: "mappe" as const,
      mappe: m,
      antall: tellDokumenterRekursivt(m.id),
    })),
    ...(åpenMappe
      ? dokumenter.map((d) => ({ type: "dokument" as const, dok: d }))
      : []),
  ];

  const erLaster = mapperLaster || (åpenMappe && dokumenterLaster);

  // 2a brødsmulesti (flagg PÅ): «Alle mapper › HMS › Datablader»
  const brodsmule =
    nyNav && mappeSti.length > 0
      ? [t("dokumenter.alleMapper"), ...mappeSti.map((s) => s.navn)].join(" › ")
      : null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center border-b border-gray-200 bg-white px-3 py-2.5">
        {åpenMappe ? (
          <TouchableOpacity onPress={navigerTilbake} className="mr-2 rounded-lg p-1.5">
            <ArrowLeft size={22} color="#374151" />
          </TouchableOpacity>
        ) : null}
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900" numberOfLines={1}>
            {åpenMappe?.navn ?? tittel}
          </Text>
          {brodsmule && (
            <Text className="text-xs text-gray-400" numberOfLines={1}>
              {brodsmule}
            </Text>
          )}
        </View>
      </View>

      {erLaster ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      ) : listeData.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <FolderOpen size={40} color="#d1d5db" />
          <Text className="mt-3 text-sm text-gray-500">{t("feil.ikkeFunnet")}</Text>
        </View>
      ) : (
        <FlatList
          data={listeData}
          keyExtractor={(item) =>
            item.type === "mappe" ? `mappe-${item.mappe.id}` : `dokument-${item.dok.id}`
          }
          contentContainerStyle={{ paddingVertical: 4 }}
          renderItem={({ item }) => {
            if (item.type === "mappe") {
              const m = item.mappe;
              // 2a: språk-info per mappe (arver / egne språk)
              const sprakInfo =
                nyNav && m.effektiveSpraak
                  ? m.spraakArvet
                    ? t("dokumenter.arverSprak")
                    : t("dokumenter.egneSprak", {
                        koder: m.effektiveSpraak
                          .filter((l) => l !== (m.kildesprak ?? "nb"))
                          .map((l) => l.toUpperCase())
                          .join(" "),
                      })
                  : null;
              return (
                <TouchableOpacity
                  onPress={() => navigerTilMappe(m.id, m.name)}
                  className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3"
                >
                  <Folder size={20} color="#1e40af" />
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-medium text-gray-900">{m.name}</Text>
                    {sprakInfo && (
                      <Text className="mt-0.5 text-xs text-gray-400">{sprakInfo}</Text>
                    )}
                  </View>
                  {item.antall > 0 && (
                    <Text className="mr-2 text-xs text-gray-400">{item.antall}</Text>
                  )}
                  <ChevronRight size={16} color="#9ca3af" />
                </TouchableOpacity>
              );
            }

            const dok = item.dok;
            const erFerdig =
              dok.processingState === "completed" || dok.processingState === "done";
            const harAvvik =
              nyNav &&
              erFerdig &&
              !!dok.detectedLanguage &&
              dok.detectedLanguage !== prosjektKildesprak &&
              !dok.languageConfirmed;
            const detInfo = harAvvik
              ? STOETTEDE_SPRAAK.find((s) => s.kode === dok.detectedLanguage)
              : null;
            const prosjektInfo = STOETTEDE_SPRAAK.find((s) => s.kode === prosjektKildesprak);
            const oversatte = nyNav ? oversatteMaal(dok) : [];
            const paagaar = nyNav && !!dok.oversettelse?.pågår;

            return (
              <TouchableOpacity
                onPress={() => {
                  if (dok.processingState === "completed") {
                    router.push(`/dokument/${dok.id}`);
                  }
                }}
                className="border-b border-gray-100 bg-white px-4 py-3"
                disabled={dok.processingState !== "completed"}
              >
                <View className="flex-row items-center">
                  <FileText
                    size={20}
                    color={dok.processingState === "completed" ? "#1e40af" : "#9ca3af"}
                  />
                  <View className="ml-3 flex-1">
                    <Text
                      className={`text-sm font-medium ${
                        dok.processingState === "completed" ? "text-gray-900" : "text-gray-400"
                      }`}
                      numberOfLines={1}
                    >
                      {dok.filename}
                    </Text>
                    <Text className="mt-0.5 text-xs text-gray-400">
                      {(dok.fileType ?? "").toUpperCase()}
                      {dok.processingState === "processing" && ` — ${t("handling.prosesserer")}`}
                      {dok.processingState === "pending" && ` — ${t("handling.laster")}`}
                      {dok.processingState === "failed" && ` — ${t("feil.noeGikkGalt")}`}
                      {/* 2a oversettelsesstatus (flagg PÅ) */}
                      {paagaar && ` — ${t("dokumenter.oversetter")}`}
                      {!paagaar && oversatte.length > 0 &&
                        ` · ${t("dokumenter.oversatt")} ${oversatte.map((l) => l.toUpperCase()).join(" ")}`}
                    </Text>
                  </View>
                  {dok.processingState === "completed" && !paagaar && (
                    <ChevronRight size={16} color="#9ca3af" />
                  )}
                  {(dok.processingState === "processing" || paagaar) && (
                    <ActivityIndicator size="small" color="#1e40af" />
                  )}
                </View>

                {/* 2a språkavvik-rad (flagg PÅ): ett-klikk «Bekreft og oversett» + «Behold» */}
                {harAvvik && (
                  <View className="ml-8 mt-2 rounded-lg bg-amber-50 px-3 py-2">
                    <Text className="text-xs text-amber-800">
                      {t("dokumentleser.detektertSom")} {detInfo?.flagg} {detInfo?.navn},{" "}
                      {t("dokumentleser.forventet")} {prosjektInfo?.flagg} {prosjektInfo?.navn}
                    </Text>
                    <View className="mt-2 flex-row gap-2">
                      <TouchableOpacity
                        disabled={bekreftSpraakMut.isPending}
                        onPress={() =>
                          bekreftSpraakMut.mutate({
                            documentId: dok.id,
                            bekreftSpraak: dok.detectedLanguage!,
                          })
                        }
                        className="rounded-md bg-sitedoc-blue px-3 py-1.5"
                      >
                        <Text className="text-xs font-medium text-white">
                          {t("dokumentleser.bekreftOgOversett", { spraak: detInfo?.navn })}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={bekreftSpraakMut.isPending}
                        onPress={() =>
                          bekreftSpraakMut.mutate({
                            documentId: dok.id,
                            bekreftSpraak: dok.detectedLanguage!,
                            skipOversettelse: true,
                          })
                        }
                        className="rounded-md bg-gray-100 px-3 py-1.5"
                      >
                        <Text className="text-xs font-medium text-gray-600">
                          {t("oversettelse.behold")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
