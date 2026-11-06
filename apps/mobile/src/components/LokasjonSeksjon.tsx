import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { ChevronDown, MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import { useByggeplass } from "../kontekst/ByggeplassKontekst";
import { foreslaaLokasjon } from "../lib/lokasjonForslag";

export interface LokasjonTegning {
  id: string;
  name: string;
  drawingNumber: string | null;
  geoReference?: unknown | null;
  byggeplassId: string | null;
  byggeplass: { id: string; name: string } | null;
}

function tegningNavn(t: { name: string; drawingNumber: string | null }): string {
  return t.drawingNumber ? `${t.drawingNumber} ${t.name}` : t.name;
}

/**
 * Felles lokasjonsfelt øverst i oppgave og sjekkliste (ORDRE 19, 2026-11-06). Viser gjeldende
 * lokasjon; trykk åpner sidens egen velger (`onAapne`). Er `foreslaa` satt (utkast uten
 * lokasjon), hentes et forslag — GPS-treff mot georefererte tegninger, ellers sist brukte
 * tegning — som vises forhåndsvalgt og lagres FØRST når brukeren trykker Bekreft.
 */
export function LokasjonSeksjon({
  tekst,
  undertekst,
  kanRedigere,
  foreslaa,
  tegninger,
  onAapne,
  onBekreftForslag,
}: {
  tekst: string | null;
  undertekst?: string | null;
  kanRedigere: boolean;
  foreslaa: boolean;
  tegninger: LokasjonTegning[];
  onAapne?: () => void;
  onBekreftForslag: (forslag: { tegningId: string; byggeplassId: string | null }) => void;
}) {
  const { t } = useTranslation();
  const { valgtBygningId, hentSistTegning } = useByggeplass();
  const [forslag, settForslag] = useState<{ tegning: LokasjonTegning; kilde: "gps" | "lagret" } | null>(null);
  const harKjørt = useRef(false);

  useEffect(() => {
    if (!foreslaa) {
      settForslag(null);
      return;
    }
    if (harKjørt.current || tegninger.length === 0) return;
    harKjørt.current = true;
    let avbrutt = false;
    (async () => {
      let gps: { lat: number; lng: number } | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      } catch {
        // GPS feilet stille — fall gjennom til sist brukte
      }
      if (avbrutt) return;
      const f = foreslaaLokasjon({
        tegninger,
        gps,
        sistBygningId: valgtBygningId,
        sistTegningId: valgtBygningId ? hentSistTegning(valgtBygningId) : null,
      });
      // Dokumentet lagrer tegning (oppgave har ingen egen byggeplass-kolonne) — et forslag
      // uten tegning gir derfor ingenting å bekrefte.
      const tegning = f?.tegningId ? tegninger.find((x) => x.id === f.tegningId) : undefined;
      settForslag(f && tegning ? { tegning, kilde: f.kilde } : null);
    })();
    return () => {
      avbrutt = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foreslaa, tegninger.length]);

  const visForslag = foreslaa && kanRedigere && forslag != null;

  return (
    <View className="rounded-lg bg-white px-4 py-3">
      <Pressable onPress={onAapne} disabled={!onAapne}>
        <View className="flex-row items-center gap-2">
          <MapPin size={14} color={tekst || visForslag ? "#1e40af" : "#9ca3af"} />
          <View className="flex-1">
            <Text
              className={`text-sm ${tekst || visForslag ? "text-gray-800" : "text-gray-400"}`}
              numberOfLines={1}
            >
              {visForslag ? tegningNavn(forslag.tegning) : tekst ?? t("lokasjonVelger.velgLokasjonPlaceholder")}
            </Text>
            {visForslag ? (
              <Text className={`text-[10px] ${forslag.kilde === "gps" ? "text-green-600" : "text-gray-400"}`}>
                {forslag.kilde === "gps" ? t("lokasjonVelger.forslagGps") : t("lokasjonVelger.forslagSistBrukt")}
              </Text>
            ) : undertekst ? (
              <Text className="text-xs text-gray-500">{undertekst}</Text>
            ) : null}
          </View>
          {visForslag ? (
            <Pressable
              hitSlop={8}
              onPress={() => {
                onBekreftForslag({
                  tegningId: forslag.tegning.id,
                  byggeplassId: forslag.tegning.byggeplassId ?? forslag.tegning.byggeplass?.id ?? null,
                });
                settForslag(null);
              }}
              className="rounded-lg bg-blue-700 px-3 py-1.5"
            >
              <Text className="text-xs font-medium text-white">{t("handling.bekreft")}</Text>
            </Pressable>
          ) : (
            kanRedigere && onAapne && <ChevronDown size={14} color="#9ca3af" />
          )}
        </View>
      </Pressable>
    </View>
  );
}

/**
 * Tegnings-/kartliste gruppert pr. byggeplass (flyttet fra sjekklistens «Bytt tegning»).
 * Tegninger uten (kjent) byggeplass samles under «Kart» — ellers usynlige i lista.
 */
export function TegningVelgerListe({
  tegninger,
  bygninger,
  valgtTegningId,
  onVelg,
}: {
  tegninger: LokasjonTegning[];
  bygninger: Array<{ id: string; name: string }>;
  valgtTegningId: string | null;
  onVelg: (tegning: LokasjonTegning) => void;
}) {
  const { t } = useTranslation();
  const bygningIder = new Set(bygninger.map((b) => b.id));
  const grupper: Array<{ id: string; navn: string; tegninger: LokasjonTegning[] }> = bygninger
    .map((b) => ({
      id: b.id,
      navn: b.name,
      tegninger: tegninger.filter((x) => (x.byggeplassId ?? x.byggeplass?.id) === b.id),
    }))
    .filter((g) => g.tegninger.length > 0);
  const løse = tegninger.filter((x) => !bygningIder.has((x.byggeplassId ?? x.byggeplass?.id) ?? ""));
  if (løse.length > 0) {
    grupper.push({ id: "__løse", navn: t("lokasjonVelger.kart"), tegninger: løse });
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="p-3 gap-1">
      {grupper.length === 0 ? (
        <Text className="mt-8 px-6 text-center text-sm text-gray-500">
          {t("lokasjonVelger.ingenTegningEllerKart")}
        </Text>
      ) : (
        grupper.map((g) => (
          <View key={g.id} className="mb-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1 mb-1">
              {g.navn}
            </Text>
            {g.tegninger.map((x) => (
              <Pressable
                key={x.id}
                onPress={() => onVelg(x)}
                className={`flex-row items-center gap-2 rounded-lg px-3 py-2.5 ${valgtTegningId === x.id ? "bg-blue-50" : "bg-white"}`}
              >
                <Text className={`flex-1 text-sm ${valgtTegningId === x.id ? "font-medium text-blue-700" : "text-gray-700"}`}>
                  {tegningNavn(x)}
                </Text>
                {x.geoReference != null && (
                  <Text className="text-[10px] font-semibold uppercase tracking-wider text-green-600">
                    {t("lokasjonVelger.kart")}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}
