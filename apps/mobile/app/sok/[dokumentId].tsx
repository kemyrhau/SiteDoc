import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { ForekomstRad } from "../../src/components/sok/ForekomstRad";
import { byggLeser, nesteEnhet, type LeserChunk } from "../../src/components/sok/sokLogikk";

/**
 * Chunk-leser for et Mapper-treff (spec-sok-mobil rev. 2 § 3): dokumentets tekst pr. side med overlapp fjernet,
 * amber ramme på valgt chunk, gule søkeord, ▲▼ «n av m» med rundgang. Finnes ingen ordforekomster (AI-treff uten
 * ordlikhet), er enhetene dokumentets treff-chunks. «Åpne dokumentet» går til den vanlige dokumentvisningen.
 */
export default function SokLeser() {
  const { t } = useTranslation();
  const router = useRouter();
  const { valgtProsjektId } = useProsjekt();
  const p = useLocalSearchParams<{ dokumentId: string; chunk?: string; q?: string; filnavn?: string; treff?: string }>();
  const dokumentId = p.dokumentId;
  const q = p.q ?? "";
  const startChunk = p.chunk ? Number(p.chunk) : null;
  const treffChunks = useMemo(
    () =>
      (p.treff ?? "")
        .split(",")
        .filter((s) => s !== "")
        .map(Number)
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b),
    [p.treff],
  );

  const { data, isLoading } = trpc.ftdSok.hentDokumentChunks.useQuery(
    { projectId: valgtProsjektId!, documentId: dokumentId },
    { enabled: !!valgtProsjektId && !!dokumentId },
  );
  const chunks = data as unknown as LeserChunk[] | undefined;

  const [valgtChunk, settValgtChunk] = useState<number | null>(startChunk);
  const [aktiv, settAktiv] = useState<number | null>(null);

  const leser = useMemo(() => byggLeser(chunks ?? [], valgtChunk, q), [chunks, valgtChunk, q]);
  // Enheter for ▲▼: ordforekomster, ellers treff-chunkene (AI-treff uten ordlikhet).
  const enheter = useMemo(
    () => (leser.forekomster.length > 0 ? leser.forekomster : treffChunks.map((chunkIndex) => ({ chunkIndex }))),
    [leser.forekomster, treffChunks],
  );

  // Rulle-mål: y pr. side + y pr. segment i siden.
  const scrollRef = useRef<ScrollView>(null);
  const sideY = useRef<Record<number, number>>({});
  const segmentY = useRef<Record<number, { side: number; y: number }>>({});
  const harRulletInn = useRef(false);

  const rullTil = useCallback((chunkIndex: number, animert: boolean) => {
    const seg = segmentY.current[chunkIndex];
    if (!seg) return false;
    const y = (sideY.current[seg.side] ?? 0) + seg.y;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: animert });
    return true;
  }, []);

  // Første rulling til valgt chunk når layouten er målt.
  useEffect(() => {
    if (harRulletInn.current || startChunk == null || !chunks?.length) return;
    const id = setTimeout(() => {
      if (rullTil(startChunk, false)) harRulletInn.current = true;
    }, 50);
    return () => clearTimeout(id);
  }, [chunks, startChunk, rullTil]);

  const gåTil = (retning: 1 | -1) => {
    const ny = nesteEnhet(aktiv, retning, enheter.length);
    if (ny == null) return;
    const mål = enheter[ny]!.chunkIndex;
    settAktiv(ny);
    settValgtChunk(mål);
    // Valgt chunk kan endre overlapp-kappingen; rull etter at ny layout er målt.
    setTimeout(() => rullTil(mål, true), 60);
  };

  const aktivForekomst = leser.forekomster.length > 0 ? aktiv : null;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-2 bg-sitedoc-blue px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t("handling.tilbake")}>
          <ArrowLeft size={22} color="#ffffff" />
        </Pressable>
        <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
          {p.filnavn ?? ""}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center gap-2">
          <ActivityIndicator color="#1e40af" />
          <Text className="text-sm text-gray-500">{t("ftdSok.lasterInnhold")}</Text>
        </View>
      ) : leser.sider.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-gray-500">{t("ftdSok.ingenInnhold")}</Text>
        </View>
      ) : (
        <ScrollView ref={scrollRef} className="flex-1" contentContainerClassName="px-4 pb-8 pt-3">
          {leser.sider.map((side) => (
            <View
              key={side.side}
              onLayout={(e) => {
                sideY.current[side.side] = e.nativeEvent.layout.y;
              }}
              className="mb-4"
            >
              <Text className="mb-1 text-xs font-semibold uppercase text-gray-400">
                {side.side > 0 ? t("ftdSok.side", { side: side.side }) : ""}
                {side.sectionTitle ? `${side.side > 0 ? " · " : ""}${side.sectionTitle}` : ""}
              </Text>
              {side.segmenter.map((seg) => (
                <View
                  key={seg.chunkIndex}
                  onLayout={(e) => {
                    segmentY.current[seg.chunkIndex] = { side: side.side, y: e.nativeEvent.layout.y };
                  }}
                  className={seg.erValgt ? "-mx-2 rounded-md border-2 border-amber-400 bg-amber-50 px-2 py-1" : ""}
                >
                  <Text className="text-sm leading-6 text-gray-800">
                    {seg.deler.map((d, i) =>
                      d.forekomst == null ? (
                        <Text key={i}>{d.tekst}</Text>
                      ) : (
                        <Text key={i} className={d.forekomst === aktivForekomst ? "bg-orange-300" : "bg-yellow-200"}>
                          {d.tekst}
                        </Text>
                      ),
                    )}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <ForekomstRad
        aktiv={aktiv}
        antall={enheter.length}
        onForrige={() => gåTil(-1)}
        onNeste={() => gåTil(1)}
        onÅpneDokument={() => router.push(`/dokument/${dokumentId}`)}
      />
    </SafeAreaView>
  );
}
