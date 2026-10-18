import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Eye, EyeOff, X } from "lucide-react-native";
import { byggLagGrupper, type RegisterVerdenLagInfo } from "@sitedoc/shared";
import { ModalFlate } from "./ModalFlate";

/**
 * F2 (spec § 3): lagpanel for dxf-viewer-grenen, mobil. Samme gruppering som web
 * sitt `LagPanel.tsx` — `byggLagGrupper()` ble flyttet til `@sitedoc/shared` FØR
 * dette panelet (mobilplanen § 4) slik at web og mobil garantert viser samme
 * gruppe→lag-inndeling, ikke to implementasjoner som kan drifte fra hverandre.
 * "Kontrollert" komponent: synlighet eies av kalleren (`lokasjoner.tsx`, som også
 * står for husking pr. tegning pr. bruker — se `lagSynlighetLagring.ts`).
 * `Modal`+`Animated`, IKKE `@gorhom/bottom-sheet` (samme begrunnelse som
 * `TegningEgenskapsArk.tsx`).
 */

const SLIDE_UT = 500;

export interface TegningLagPanelProps {
  synlig: boolean;
  laginventar: RegisterVerdenLagInfo[];
  synlighet: Record<string, boolean>;
  onSettLag: (navn: string, synlig: boolean) => void;
  onSettGruppe: (lagNavn: string[], synlig: boolean) => void;
  onBareDette: (navn: string) => void;
  onAllePaa: () => void;
  onAlleAv: () => void;
  onLukk: () => void;
}

export function TegningLagPanel({
  synlig,
  laginventar,
  synlighet,
  onSettLag,
  onSettGruppe,
  onBareDette,
  onAllePaa,
  onAlleAv,
  onLukk,
}: TegningLagPanelProps) {
  const { t } = useTranslation();
  const grupper = useMemo(() => byggLagGrupper(laginventar), [laginventar]);
  const [apne, setApne] = useState<Set<string>>(() => new Set());
  const [montert, setMontert] = useState(synlig);
  const slide = useRef(new Animated.Value(SLIDE_UT)).current;

  useEffect(() => {
    if (synlig) {
      setMontert(true);
      Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    } else {
      Animated.timing(slide, { toValue: SLIDE_UT, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMontert(false);
      });
    }
  }, [synlig, slide]);

  function vekslApen(navn: string) {
    setApne((s) => {
      const neste = new Set(s);
      if (neste.has(navn)) neste.delete(navn);
      else neste.add(navn);
      return neste;
    });
  }

  if (!montert) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onLukk} statusBarTranslucent>
      <Pressable style={stiler.bakgrunn} onPress={onLukk} />
      <Animated.View style={[stiler.ark, { transform: [{ translateY: slide }] }]} testID="tegning-lagpanel">
        <ModalFlate kanter={["bottom"]}>
        <View style={stiler.header}>
          <Text style={stiler.tittel}>{t("tegningsvelger.lag.tittel")}</Text>
          <View style={stiler.headerKnapper}>
            <Pressable onPress={onAllePaa} hitSlop={8}>
              <Text style={stiler.allePaa}>{t("tegningsvelger.lag.allePaa")}</Text>
            </Pressable>
            <Pressable onPress={onAlleAv} hitSlop={8}>
              <Text style={stiler.allePaa}>{t("tegningsvelger.lag.alleAv")}</Text>
            </Pressable>
            <Pressable onPress={onLukk} hitSlop={12} accessibilityLabel={t("handling.lukk")}>
              <X size={20} color="#6b7280" />
            </Pressable>
          </View>
        </View>
        <ScrollView style={stiler.liste} contentContainerStyle={{ paddingBottom: 24 }}>
          {grupper.map((g) => {
            const alleSynlig = g.lag.every((l) => synlighet[l.navn] !== false);
            const apen = apne.has(g.navn);
            return (
              <View key={g.navn} style={stiler.gruppeBlokk}>
                <Pressable style={stiler.gruppeRad} onPress={() => vekslApen(g.navn)}>
                  {apen ? <ChevronDown size={16} color="#9ca3af" /> : <ChevronRight size={16} color="#9ca3af" />}
                  <Pressable
                    style={stiler.oyeKnapp}
                    onPress={() => onSettGruppe(g.lag.map((l) => l.navn), !alleSynlig)}
                    accessibilityLabel={alleSynlig ? t("handling.skjul") : t("handling.vis")}
                  >
                    {alleSynlig ? <Eye size={16} color="#1e40af" /> : <EyeOff size={16} color="#9ca3af" />}
                  </Pressable>
                  <Text style={stiler.gruppeNavn} numberOfLines={1}>
                    {g.navn !== g.gruppeNavn ? <Text style={stiler.gruppeKode}>{g.navn} </Text> : null}
                    {g.gruppeNavn}
                  </Text>
                  <Text style={stiler.antall}>{g.antallTotal}</Text>
                </Pressable>
                {apen && (
                  <View style={stiler.lagListe}>
                    {g.lag.map((l) => {
                      const lagSynlig = synlighet[l.navn] !== false;
                      return (
                        <View key={l.navn} style={stiler.lagRad}>
                          <Pressable
                            style={stiler.oyeKnapp}
                            onPress={() => onSettLag(l.navn, !lagSynlig)}
                            accessibilityLabel={lagSynlig ? t("handling.skjul") : t("handling.vis")}
                          >
                            {lagSynlig ? <Eye size={14} color="#1e40af" /> : <EyeOff size={14} color="#9ca3af" />}
                          </Pressable>
                          <Text style={stiler.lagNavn} numberOfLines={1}>
                            {l.visningsnavn}
                          </Text>
                          <Text style={stiler.antallLiten}>{l.antall}</Text>
                          <Pressable onPress={() => onBareDette(l.navn)} hitSlop={6}>
                            <Text style={stiler.bareDette}>{t("tegningsvelger.lag.bareDette")}</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
        </ModalFlate>
      </Animated.View>
    </Modal>
  );
}

const stiler = StyleSheet.create({
  bakgrunn: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  ark: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "75%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 8,
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerKnapper: { flexDirection: "row", alignItems: "center", gap: 14 },
  tittel: { fontSize: 14, fontWeight: "600", color: "#111827" },
  allePaa: { fontSize: 13, fontWeight: "500", color: "#1e40af" },
  // `flex: 1` er nødvendig, ikke kosmetisk: `ark` sin `maxHeight` klipper kun
  // UTSIDEN når innholdet er høyere enn 75 %. Uten denne arver ScrollView sin
  // egen høyde fra INNHOLDET (ingen bundet rom å scrolle i), og rullingen
  // "spretter tilbake" i stedet for å stå — de nederste lagene var derfor
  // umulige å nå (RETUR 2026-10-18, Kenneths telefontest, punkt 1).
  liste: { flex: 1, paddingHorizontal: 4 },
  gruppeBlokk: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  gruppeRad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  oyeKnapp: { padding: 4 },
  gruppeNavn: { flex: 1, fontSize: 14, color: "#111827" },
  gruppeKode: { color: "#9ca3af" },
  antall: { fontSize: 12, color: "#9ca3af" },
  lagListe: { backgroundColor: "#f9fafb", paddingBottom: 4 },
  lagRad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 32,
    paddingRight: 12,
    paddingVertical: 6,
  },
  lagNavn: { flex: 1, fontSize: 12, color: "#374151" },
  antallLiten: { fontSize: 11, color: "#9ca3af" },
  bareDette: { fontSize: 11, fontWeight: "500", color: "#1e40af" },
});
