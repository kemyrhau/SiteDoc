import { useRef, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { Tag, X, Plus, ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { emneLagring, emneVisning, type EmneAvslutning } from "../utils/emneVisning";

/**
 * Emne (subject) på mobil-detaljskjermen — merkelapp for gjenfinning, synlig ØVERST i
 * dokumentet også når det er tomt (ordre opprett-uten-modal 2026-09-22). Speiler
 * web-`EmneVelger`: passiv «+ Legg til emne» / chip + Endre/Fjern / redigering med
 * malens forslag. Tomt i lesemodus vises som «Ingen emne» med etikett — ikke skjult.
 *
 * Redigeringen lagres med «Lagre», med retur på tastaturet og når feltet forlates (blur),
 * som web lagrer på Enter (telefonfunn 2026-10-29). Om utkastet lagres avgjør `emneLagring`
 * (kun ved endring, aldri ved «Avbryt»). Et trykk på Avbryt eller et forslag merker blur-en
 * som ikke-lagrende i `onPressIn`, som kommer før feltet mister fokus.
 *
 * Visningstilstanden avgjøres av den rene `emneVisning`-helperen (enhetstestet). Låst
 * dokument (approved/closed) → `leseModus` (server-vakten i `*.oppdater` er sannheten;
 * denne styrer kun visning). Skjules av kalleren når malens `showSubject === false`.
 */
export function EmneFelt({
  emne,
  forslag,
  leseModus,
  onLagre,
}: {
  emne: string | null;
  forslag: string[];
  leseModus?: boolean;
  onLagre: (emne: string | null) => void;
}) {
  const { t } = useTranslation();
  const [redigerer, setRedigerer] = useState(false);
  const [utkast, setUtkast] = useState("");
  const [visForslag, setVisForslag] = useState(false);
  // Redigeringen er avsluttet (lagret eller avbrutt): en etterfølgende blur gjør ingenting.
  const ferdigRef = useRef(false);
  // Et trykk i redigeringsraden (Avbryt, forslag, forslagsknapp) tar fokus fra feltet:
  // den blur-en skal ikke lagre.
  const hoppOverBlurRef = useRef(false);

  const visning = emneVisning(emne, !!leseModus);
  const rensForslag = forslag.filter((f) => f.trim() !== "");

  function start() {
    setUtkast(emne ?? "");
    setVisForslag(false);
    ferdigRef.current = false;
    hoppOverBlurRef.current = false;
    setRedigerer(true);
  }

  function avslutt(avslutning: EmneAvslutning) {
    if (ferdigRef.current) return;
    ferdigRef.current = true;
    const res = emneLagring(avslutning, utkast, emne);
    if (res.lagre) onLagre(res.verdi);
    setRedigerer(false);
  }

  function vedBlur() {
    if (hoppOverBlurRef.current) {
      hoppOverBlurRef.current = false;
      return;
    }
    avslutt("forlat");
  }

  const hoppOverBlur = () => {
    hoppOverBlurRef.current = true;
  };

  return (
    <View>
      <Text className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
        {t("emneVelger.etikett")}
      </Text>
      {byggInnhold()}
    </View>
  );

  function byggInnhold() {
    if (redigerer) {
      return (
        <View>
          <View className="flex-row items-center gap-2">
            <TextInput
              value={utkast}
              onChangeText={setUtkast}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => avslutt("retur")}
              onBlur={vedBlur}
              placeholder={t("emneVelger.plassholder")}
              placeholderTextColor="#9ca3af"
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800"
            />
            {rensForslag.length > 0 && (
              <Pressable
                onPressIn={hoppOverBlur}
                onPress={() => {
                  hoppOverBlurRef.current = false; // blur-en (om feltet hadde fokus) kom i onPressIn
                  setVisForslag((v) => !v);
                }}
                hitSlop={8}
                className="p-1"
              >
                <ChevronDown size={18} color="#9ca3af" />
              </Pressable>
            )}
            <Pressable
              onPress={() => avslutt("lagre")}
              className="rounded-lg bg-sitedoc-primary px-3 py-2"
            >
              <Text className="text-sm font-medium text-white">{t("handling.lagre")}</Text>
            </Pressable>
            <Pressable onPressIn={hoppOverBlur} onPress={() => avslutt("avbryt")} className="px-2 py-2">
              <Text className="text-sm text-gray-500">{t("handling.avbryt")}</Text>
            </Pressable>
          </View>
          {visForslag && rensForslag.length > 0 && (
            <View className="mt-1 rounded-lg border border-gray-200 bg-white">
              {rensForslag.map((f) => (
                <Pressable
                  key={f}
                  onPressIn={hoppOverBlur}
                  onPress={() => {
                    hoppOverBlurRef.current = false;
                    setUtkast(f);
                    setVisForslag(false);
                  }}
                  className="border-b border-gray-50 px-3 py-2.5"
                >
                  <Text className="text-sm text-gray-700">{f}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      );
    }

    if (visning.modus === "utfylt") {
      return (
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1">
            <Tag size={13} color="#1d4ed8" />
            <Text className="text-sm text-blue-700">{visning.tekst}</Text>
          </View>
          {visning.kanRedigere && (
            <>
              <Pressable onPress={start} className="rounded px-2 py-1">
                <Text className="text-xs font-medium text-sitedoc-blue">{t("handling.endre")}</Text>
              </Pressable>
              <Pressable onPress={() => onLagre(null)} hitSlop={8} className="p-1">
                <X size={14} color="#9ca3af" />
              </Pressable>
            </>
          )}
        </View>
      );
    }

    if (visning.modus === "tomt-lesemodus") {
      return (
        <View className="flex-row items-center gap-1.5 self-start rounded-full bg-gray-50 px-3 py-1">
          <Tag size={13} color="#9ca3af" />
          <Text className="text-sm text-gray-400">{t("emneVelger.ingenEmne")}</Text>
        </View>
      );
    }

    // tomt-redigerbar
    return (
      <Pressable onPress={start} className="flex-row items-center gap-1.5 self-start px-1 py-1.5">
        <Plus size={16} color="#1d4ed8" />
        <Text className="text-sm font-medium text-sitedoc-blue">{t("emneVelger.leggTil")}</Text>
      </Pressable>
    );
  }
}
