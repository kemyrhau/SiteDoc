import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { FileText } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { posisjonsEtikett } from "@sitedoc/shared";
import { grupperPerDokument } from "./sokLogikk";
import { UtsnittTekst } from "./UtsnittTekst";
import type { MappeTreff } from "./typer";

/**
 * Mappetreff gruppert pr. dokument (spec § 2 A, som web `TreffListe`): dokumentkort med filnavn + «vist av antall»,
 * inntil serverens 5 rader, «Vis N flere». Ingen metode-badge, score eller ekstern lenke.
 */
export function TreffListe({
  treff,
  søkeord,
  maksDokumenter,
  lasterFlereFor,
  onVisFlere,
  onVelg,
}: {
  treff: MappeTreff[];
  søkeord: string;
  /** «Alle»: maks antall dokumentkort i seksjonen. */
  maksDokumenter?: number;
  lasterFlereFor: string | null;
  onVisFlere: (documentId: string, vist: number) => void;
  onVelg: (tr: MappeTreff) => void;
}) {
  const { t } = useTranslation();
  const grupper = grupperPerDokument(treff);
  const synlige = maksDokumenter != null ? grupper.slice(0, maksDokumenter) : grupper;

  return (
    <View>
      {synlige.map((g) => (
        <View key={g.documentId} className="mx-3 mb-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <View className="flex-row items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
            <FileText size={14} color="#6b7280" />
            <Text className="flex-1 text-sm font-medium text-gray-900" numberOfLines={1}>
              {g.filename}
            </Text>
            <Text className="text-xs text-gray-500">
              {g.antallIDok > g.vist
                ? t("ftdSok.antallTreffAv", { vist: g.vist, antall: g.antallIDok })
                : t("ftdSok.antallTreffDok", { antall: g.vist })}
            </Text>
          </View>
          {g.treff.map((tr) => {
            const pos = posisjonsEtikett(tr.pageNumber, tr.chunkIndex);
            return (
              <Pressable
                key={tr.id}
                onPress={() => onVelg(tr)}
                className="border-b border-gray-100 px-3 py-2 active:bg-blue-50"
              >
                <View className="flex-row items-center gap-2">
                  {tr.sectionTitle ? (
                    <Text className="flex-1 text-xs font-semibold text-gray-800" numberOfLines={1}>
                      {tr.sectionTitle}
                    </Text>
                  ) : (
                    <View className="flex-1" />
                  )}
                  {pos ? (
                    <Text className="text-xs text-gray-400">
                      {pos.type === "side" ? t("ftdSok.side", { side: pos.nr }) : t("ftdSok.chunk", { nr: pos.nr })}
                    </Text>
                  ) : null}
                </View>
                <UtsnittTekst
                  chunkText={tr.chunkText}
                  søkeord={søkeord}
                  utdrag={tr.utdrag}
                  semantiskSetning={tr.semantiskSetning}
                  sectionTitle={tr.sectionTitle}
                  metode={tr.metode}
                />
              </Pressable>
            );
          })}
          {g.flere > 0 ? (
            <Pressable
              onPress={() => onVisFlere(g.documentId, g.vist)}
              disabled={lasterFlereFor != null}
              className="flex-row items-center justify-center gap-2 px-3 py-2.5"
            >
              {lasterFlereFor === g.documentId ? <ActivityIndicator size="small" color="#1e40af" /> : null}
              <Text className="text-xs font-semibold text-sitedoc-primary">
                {t("ftdSok.visFlere", { antall: g.flere })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
