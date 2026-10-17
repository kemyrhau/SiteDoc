import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";
import type { EgenskapsFelt, EgenskapsFeltNokkel } from "@sitedoc/shared";
import { ModalFlate } from "./ModalFlate";

/**
 * F1 (spec § 3): bunn-ark for dxf-viewer-grenen, mobil. Viser SAMME felt som web
 * sitt `EgenskapsPanel.tsx` (samme `byggEgenskapsfelt()`-data fra O1-registeret via
 * `objektValgt`-meldingen, samme i18n-nøkler `tegningsvelger.egenskaper.*`), men som
 * et NATIVT RN-ark — IKKE web-rendret inni WebView-en (mobilplanen, "mobilplanen er
 * godkjent i sin helhet", 2026-10-17, § 1: siden er en ren data-bro i RN).
 * `Modal`+`Animated`, IKKE `@gorhom/bottom-sheet` (uanvendt dependency i
 * package.json i dag — å koble den opp, med egen root-provider/GestureHandler, er
 * egen risiko som ikke tas ubedt i denne leveransen).
 */

const SLIDE_UT = 400;

const FELT_LABEL_NOKKEL: Record<EgenskapsFeltNokkel, string> = {
  hva: "tegningsvelger.egenskaper.feltHva",
  typeStorrelse: "tegningsvelger.egenskaper.feltTypeStorrelse",
  rom: "tegningsvelger.egenskaper.feltRom",
  materiale: "tegningsvelger.egenskaper.feltMateriale",
  tekst: "tegningsvelger.egenskaper.feltTekst",
  naermesteMerking: "tegningsvelger.egenskaper.feltNaermesteMerking",
  mal: "tegningsvelger.egenskaper.feltMal",
  status: "tegningsvelger.egenskaper.feltStatus",
  linjetype: "tegningsvelger.egenskaper.feltLinjetype",
  id: "tegningsvelger.egenskaper.feltId",
};

export interface TegningEgenskapsArkProps {
  felt: EgenskapsFelt[] | null;
  onLukk: () => void;
}

export function TegningEgenskapsArk({ felt, onLukk }: TegningEgenskapsArkProps) {
  const { t } = useTranslation();
  const synlig = !!felt && felt.length > 0;
  // Beholder siste felt-sett under lukke-animasjonen, så arket viser innholdet det
  // hadde da brukeren lukket det, i stedet for å blinke tomt før Modal unmountes.
  const [vistFelt, setVistFelt] = useState<EgenskapsFelt[] | null>(felt);
  const [montert, setMontert] = useState(synlig);
  const slide = useRef(new Animated.Value(SLIDE_UT)).current;

  useEffect(() => {
    if (synlig) {
      setVistFelt(felt);
      setMontert(true);
      Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    } else {
      Animated.timing(slide, { toValue: SLIDE_UT, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMontert(false);
      });
    }
  }, [synlig, felt, slide]);

  if (!montert) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onLukk} statusBarTranslucent>
      <Pressable style={stiler.bakgrunn} onPress={onLukk} />
      <Animated.View
        style={[stiler.ark, { transform: [{ translateY: slide }] }]}
        testID="tegning-egenskapsark"
      >
        <ModalFlate kanter={["bottom"]}>
          <View style={stiler.header}>
            <Text style={stiler.tittel}>{t("tegningsvelger.egenskaper.tittel")}</Text>
            <Pressable onPress={onLukk} hitSlop={12} accessibilityLabel={t("handling.lukk")}>
              <X size={20} color="#6b7280" />
            </Pressable>
          </View>
          <ScrollView style={stiler.liste} contentContainerStyle={{ paddingBottom: 16 }}>
            {(vistFelt ?? []).map((f, i) => (
              <View key={`${f.nokkel}-${i}`} style={stiler.rad}>
                <Text style={stiler.label}>{t(FELT_LABEL_NOKKEL[f.nokkel])}</Text>
                <Text style={[stiler.verdi, f.tolket ? stiler.verdiTolket : undefined]}>
                  {f.verdi}
                  {f.nokkel === "naermesteMerking" &&
                    ` (${t("tegningsvelger.egenskaper.naermesteMerkingSuffiks")})`}
                </Text>
                {f.underverdi ? <Text style={stiler.underverdi}>{f.underverdi}</Text> : null}
              </View>
            ))}
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
    maxHeight: "60%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 8,
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
  tittel: { fontSize: 14, fontWeight: "600", color: "#111827" },
  liste: { paddingHorizontal: 16 },
  rad: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingVertical: 10 },
  label: { fontSize: 11, color: "#6b7280" },
  verdi: { fontSize: 14, color: "#111827", marginTop: 2 },
  verdiTolket: { fontStyle: "italic", color: "#6b7280" },
  underverdi: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
});
