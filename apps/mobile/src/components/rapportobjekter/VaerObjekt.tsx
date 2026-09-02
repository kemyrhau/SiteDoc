import { View, Text, TextInput, Pressable } from "react-native";
import { Cloud, CloudOff, Pencil } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { RapportObjektProps } from "./typer";

interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
  precipitation?: string;
  kilde?: "manuell" | "automatisk";
  status?: "venter";
}

function formaterVaerTekst(v: VaerVerdi, t: TFunction): string {
  const deler: string[] = [];
  if (v.temp) deler.push(v.temp);
  if (v.conditions) deler.push(v.conditions.toLowerCase());
  if (v.wind) deler.push(t("felt.vaerVindVerdi", { verdi: v.wind }));
  if (v.precipitation && v.precipitation !== "0 mm") deler.push(t("felt.vaerNedborVerdi", { verdi: v.precipitation }));
  return deler.join(", ");
}

export function VaerObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const vaerVerdi = (verdi as VaerVerdi) ?? {};
  const [redigerer, settRedigerer] = useState(false);
  const harVerdi = !!(vaerVerdi.temp || vaerVerdi.conditions || vaerVerdi.wind || vaerVerdi.precipitation);

  const venter = vaerVerdi.status === "venter" && !harVerdi;

  const oppdater = (felt: keyof VaerVerdi, nyVerdi: string) => {
    // Manuell overstyring fjerner venter-tilstanden (bruker fyller selv).
    onEndreVerdi({ ...vaerVerdi, status: undefined, [felt]: nyVerdi, kilde: "manuell" as const });
  };

  // Venter-tilstand: tidspunkt satt offline, vær hentes ved neste tilkobling.
  if (venter && !redigerer) {
    return (
      <View className="flex-row items-center gap-2">
        <CloudOff size={16} color="#9ca3af" />
        <Text className="flex-1 text-sm text-gray-400">
          {t("felt.vaerHentesTilkoblet")}
        </Text>
        {!leseModus && (
          <Pressable onPress={() => settRedigerer(true)} hitSlop={8}>
            <Pencil size={14} color="#9ca3af" />
          </Pressable>
        )}
      </View>
    );
  }

  // Kompakt visning (standard)
  if (!redigerer) {
    return (
      <View className="flex-row items-center gap-2">
        <Cloud size={16} color="#6b7280" />
        <Text className={`flex-1 text-sm ${harVerdi ? "text-gray-900" : "text-gray-400"}`}>
          {harVerdi ? formaterVaerTekst(vaerVerdi, t) : t("felt.ingenVaerdata")}
        </Text>
        {!leseModus && (
          <Pressable onPress={() => settRedigerer(true)} hitSlop={8}>
            <Pencil size={14} color="#9ca3af" />
          </Pressable>
        )}
      </View>
    );
  }

  // Redigeringsmodus — kompakte felt på én rad
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <TextInput
          value={vaerVerdi.temp ?? ""}
          onChangeText={(tekst) => oppdater("temp", tekst)}
          placeholder={t("felt.vaerTemp")}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
        />
        <TextInput
          value={vaerVerdi.conditions ?? ""}
          onChangeText={(tekst) => oppdater("conditions", tekst)}
          placeholder={t("felt.vaerForhold")}
          className="flex-[2] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
        />
      </View>
      <View className="flex-row gap-2">
        <TextInput
          value={vaerVerdi.wind ?? ""}
          onChangeText={(tekst) => oppdater("wind", tekst)}
          placeholder={t("felt.vaerVind")}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
        />
        <TextInput
          value={vaerVerdi.precipitation ?? ""}
          onChangeText={(tekst) => oppdater("precipitation", tekst)}
          placeholder={t("felt.vaerNedbor")}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
        />
      </View>
      <Pressable onPress={() => settRedigerer(false)}>
        <Text className="text-sm text-blue-600">{t("felt.ferdig")}</Text>
      </Pressable>
    </View>
  );
}
