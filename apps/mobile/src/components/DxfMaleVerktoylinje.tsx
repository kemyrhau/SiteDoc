import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Hand,
  Ruler,
  Waypoints,
  VectorSquare,
  TriangleRight,
  Magnet,
  Check,
  Plus,
  Trash2,
} from "lucide-react-native";
import type { TegningVerktoy } from "@sitedoc/shared";

/**
 * Mobil leveranse 3+4 (arbeidstegning-f1, "POST: mobil leveranse 3+4, lupe og
 * måling i dxf-viewer"): måle-toolbar for WebGL-grenen. Visuell paritet med
 * SVG-veiens toolbar (`TegningsVisning.tsx` linje ~793-871) — samme ikoner og
 * i18n-nøkler (ingen nye lagt til). To forskjeller fra SVG-veien, begge
 * bevisste scope-kutt (se "POST"-ordren, ikke nevnt i den eksplisitte listen):
 *   - Ingen "Opprett"-knapp (markører er egen leveranse, skjules helt ennå).
 *   - Ingen "Referanselinje"-knapp (krever egen punkt-velger-flyt) — en
 *     knapp som likevel ikke gjør noe bryter "renest mulig UI".
 *
 * Selve måleRESULTATET (lengde/areal) vises IKKE her — det tegnes direkte på
 * tegningen av web-overlegget i `DxfViewerTegning.tsx` (skjermrom-native
 * etiketter), så RN-siden slipper å duplisere det tallet via en treg
 * postMessage-rundtur.
 */

export interface DxfMaleVerktoylinjeProps {
  kanMale: boolean;
  onVerktoy: (v: TegningVerktoy) => void;
  onOrtho: (på: boolean) => void;
  onSnap: (på: boolean) => void;
  onFullfoer: () => void;
  onGjenoppta: () => void;
  onSlettAktiv: () => void;
  onSlettAlle: () => void;
}

export function DxfMaleVerktoylinje({
  kanMale,
  onVerktoy,
  onOrtho,
  onSnap,
  onFullfoer,
  onGjenoppta,
  onSlettAktiv,
  onSlettAlle,
}: DxfMaleVerktoylinjeProps) {
  const { t } = useTranslation();
  const [verktoy, setVerktoyState] = useState<TegningVerktoy>("flytt");
  const [ortho, setOrthoState] = useState(false);
  const [snapPaa, setSnapState] = useState(true);

  function velg(v: TegningVerktoy) {
    setVerktoyState(v);
    onVerktoy(v);
  }

  return (
    <View style={stiler.toolbar} pointerEvents="box-none">
      <View style={stiler.knappRad}>
        <Pressable onPress={() => velg("flytt")} style={[stiler.knapp, verktoy === "flytt" && stiler.knappAktiv]}>
          <Hand size={14} color={verktoy === "flytt" ? "#ffffff" : "#1e3a8a"} />
          <Text style={[stiler.knappTekst, verktoy === "flytt" && stiler.knappTekstAktiv]}>{t("maaling.verktoyFlytt")}</Text>
        </Pressable>
        {([
          ["linjal", Ruler, t("maaling.verktoyLinjal")],
          ["polylinje", Waypoints, t("maaling.verktoyPolylinje")],
          ["areal", VectorSquare, t("maaling.verktoyAreal")],
        ] as const).map(([v, Ikon, etikett]) => {
          const erValgt = verktoy === v;
          return (
            <Pressable
              key={v}
              disabled={!kanMale}
              onPress={() => velg(v)}
              style={[stiler.knapp, erValgt && stiler.knappAktiv, !kanMale && stiler.knappSperret]}
            >
              <Ikon size={14} color={erValgt ? "#ffffff" : "#1e3a8a"} />
              <Text style={[stiler.knappTekst, erValgt && stiler.knappTekstAktiv]}>{etikett}</Text>
            </Pressable>
          );
        })}
      </View>
      {kanMale && (
        <View style={stiler.knappRad}>
          <Pressable
            onPress={() => { const v = !ortho; setOrthoState(v); onOrtho(v); }}
            style={[stiler.knapp, ortho && stiler.knappAktiv]}
          >
            <TriangleRight size={14} color={ortho ? "#ffffff" : "#1e3a8a"} />
            <Text style={[stiler.knappTekst, ortho && stiler.knappTekstAktiv]}>{t("maaling.laasVinkel")}</Text>
          </Pressable>
          <Pressable
            onPress={() => { const v = !snapPaa; setSnapState(v); onSnap(v); }}
            style={[stiler.knapp, snapPaa && stiler.knappAktiv]}
          >
            <Magnet size={14} color={snapPaa ? "#ffffff" : "#1e3a8a"} />
            <Text style={[stiler.knappTekst, snapPaa && stiler.knappTekstAktiv]}>{t("maaling.snap")}</Text>
          </Pressable>
        </View>
      )}
      {kanMale && verktoy !== "flytt" && (
        <View style={stiler.knappRad}>
          {verktoy === "polylinje" && (
            <Pressable onPress={onFullfoer} style={stiler.handling}>
              <Check size={14} color="#16a34a" />
              <Text style={stiler.handlingTekst}>{t("maaling.fullfor")}</Text>
            </Pressable>
          )}
          {verktoy === "areal" && (
            <Pressable onPress={onFullfoer} style={stiler.handling}>
              <Check size={14} color="#16a34a" />
              <Text style={stiler.handlingTekst}>{t("maaling.lukkFlate")}</Text>
            </Pressable>
          )}
          <Pressable onPress={onGjenoppta} style={stiler.handling}>
            <Plus size={14} color="#1e3a8a" />
            <Text style={stiler.handlingTekst}>{t("maaling.fortsett")}</Text>
          </Pressable>
          <Pressable onPress={onSlettAktiv} style={stiler.handling}>
            <Trash2 size={14} color="#dc2626" />
            <Text style={[stiler.handlingTekst, { color: "#dc2626" }]}>{t("maaling.slett")}</Text>
          </Pressable>
          <Pressable onPress={onSlettAlle} style={stiler.handling}>
            <Trash2 size={14} color="#6b7280" />
            <Text style={stiler.handlingTekst}>{t("maaling.slettAlle")}</Text>
          </Pressable>
        </View>
      )}
      {!kanMale && (
        <View style={stiler.sperret}>
          <Ruler size={12} color="#9ca3af" />
          <Text style={stiler.sperretTekst}>{t("maaling.manglerMaalegrunnlag")}</Text>
        </View>
      )}
    </View>
  );
}

const stiler = StyleSheet.create({
  toolbar: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    gap: 6,
  },
  knappRad: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  knapp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  knappAktiv: {
    backgroundColor: "#1e3a8a",
    borderColor: "#1e3a8a",
  },
  knappSperret: {
    opacity: 0.4,
  },
  knappTekst: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1e3a8a",
  },
  knappTekstAktiv: {
    color: "#ffffff",
  },
  handling: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  handlingTekst: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1e3a8a",
  },
  sperret: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  sperretTekst: {
    fontSize: 11,
    color: "#9ca3af",
  },
});
