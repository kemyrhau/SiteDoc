import { useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { MapPin, ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "../kontekst/ProsjektKontekst";
import { useByggeplass } from "../kontekst/ByggeplassKontekst";
import { trpc } from "../lib/trpc";
import { ByggeplassVelgerModal } from "./timer-detalj/ByggeplassVelger";

/**
 * Delt header-chip for global aktiv byggeplass (F2 av «Mobil global byggeplass-UX»).
 * Byggeplass-only (prosjekt er implisitt via aktivt prosjekt). Trykk → bottom-sheet
 * «Bytt byggeplass» (gjenbruk `ByggeplassVelgerModal`), skriver `settBygning`
 * (eneste globale setter sammen med GPS — F3). Vises kun når et prosjekt er aktivt.
 *
 * A (bygg 50): kilden er nå server-spørringen `bygning.hentForProsjekt` — SAMME som
 * skjermene rundt chippen bruker (`hjem.tsx:136`, `lokasjoner.tsx:146`), ikke timer-
 * modulens SQLite-cache (`byggeplassLocal`). Cachen fylles kun når timer er aktiv +
 * synket (`TimerSyncProvider`), så den globale velgeren forsvant stille når timer
 * ikke hadde kjørt. useQuery er dessuten reaktiv → chippen oppdager at kilden fyller
 * seg (løser den gamle memo-på-valgtProsjektId-låsen). Modalen self-healer sin egen
 * cache separat (den deles med timer-sedelen) — vi rører verken den eller katalogen.
 *
 * GPS-status-linje + favoritter legges til i F3/F6.
 */
export function ByggeplassChip() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId, erHeleProsjektet, settBygning, velgHeleProsjektet, gpsByggeplassId } =
    useByggeplass();
  const [visVelger, setVisVelger] = useState(false);

  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  // Lean cast (TS2589) — samme mønster som hjem.tsx/lokasjoner.tsx.
  const byggeplasser = (bygningQuery.data ?? []) as Array<{ id: string; name: string }>;

  const valgt = useMemo(
    () => byggeplasser.find((b) => b.id === valgtBygningId) ?? null,
    [byggeplasser, valgtBygningId],
  );

  // F3: GPS-forslag — kun relevant når treffet hører til dette prosjektet.
  const gpsValgt = useMemo(
    () => byggeplasser.find((b) => b.id === gpsByggeplassId) ?? null,
    [byggeplasser, gpsByggeplassId],
  );
  const paaPlass = !!valgtBygningId && gpsByggeplassId === valgtBygningId;
  const foreslar = !!gpsValgt && gpsByggeplassId !== valgtBygningId;

  // Ingen prosjekt = ingen kontekst → ingen chip (byggeplass-innen-prosjekt).
  if (!valgtProsjektId) return null;

  // A Krav 2: chippen skal ALDRI forsvinne stille. Laster → lastetilstand.
  if (bygningQuery.isLoading) {
    return (
      <View className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <ActivityIndicator size="small" color="#1e40af" />
        <Text className="text-sm text-gray-500">{t("kontekstChip.laster")}</Text>
      </View>
    );
  }
  // Lastet + tomt er en GYLDIG tilstand (prosjekt uten byggeplasser) → vis som tekst.
  if (byggeplasser.length === 0) {
    return (
      <View className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <MapPin size={18} color="#9ca3af" />
        <Text className="text-sm text-gray-500">{t("byggeplass.ingenPaaProsjekt")}</Text>
      </View>
    );
  }

  const tittel = erHeleProsjektet
    ? t("kontekstChip.heleProsjektet")
    : valgt?.name ?? t("byggeplassVelger.velg");

  return (
    <>
      <Pressable
        onPress={() => setVisVelger(true)}
        className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"
      >
        <MapPin size={18} color="#1e40af" />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-sitedoc-primary" numberOfLines={1}>
            {tittel}
          </Text>
          {/* Når en byggeplass filtrerer lista, si det eksplisitt — feltarbeideren
              skal aldri se et avkortet sett uten å vite at noe er skjult (mobil-
              speiling av webs «Viser: <byggeplass> · Vis hele prosjektet»). */}
          {valgtBygningId != null && (
            <Text className="text-xs text-amber-600" numberOfLines={1}>
              {t("byggeplass.filtrererListe")}
            </Text>
          )}
          {paaPlass && (
            <Text className="text-xs text-green-600" numberOfLines={1}>
              {t("byggeplass.gpsPaaPlass")}
            </Text>
          )}
          {foreslar && (
            <Text className="text-xs text-blue-600" numberOfLines={1}>
              {t("byggeplass.gpsForeslar")}: {gpsValgt?.name}
            </Text>
          )}
        </View>
        <ChevronDown size={18} color="#1e40af" />
      </Pressable>

      {visVelger && (
        <ByggeplassVelgerModal
          projectId={valgtProsjektId}
          valgtId={valgtBygningId}
          gpsForeslagId={gpsByggeplassId}
          tillatIngen
          ingenLabel={t("kontekstChip.heleProsjektet")}
          onVelg={(id) => {
            // «Hele prosjektet»-raden (id === null) gir samme utvei som webs
            // globale velger: nullstiller filteret OG blokkerer GPS-autovalg.
            if (id) settBygning(id);
            else velgHeleProsjektet();
            setVisVelger(false);
          }}
          onLukk={() => setVisVelger(false)}
        />
      )}
    </>
  );
}
