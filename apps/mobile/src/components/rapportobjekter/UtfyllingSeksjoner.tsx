import { useState, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Check, AlertTriangle } from "lucide-react-native";
import { grupperMedOverskrift, beregnSeksjonUtfylling, type SeksjonUtfylling } from "@sitedoc/shared";

type MinObjekt = { id: string; type: string; label: string; parentId?: string | null };

/**
 * Per-felt utfyllingsoppslag fra skjermen: er feltet synlig (betinget synlighet) og har det en
 * reell verdi? `null` → feltet skal ikke telles (repeater-barn). Skjermene har allerede
 * `erSynlig` + `hentFeltVerdi` i scope; typefiltreringen eier `beregnSeksjonUtfylling`.
 */
export type FeltStatusOppslag<T> = (objekt: T) => { synlig: boolean; harVerdi: boolean } | null;

/**
 * Kollapsbare heading-seksjoner i mobil utfylling (fase M-3a del 2, pkt 2).
 * Grupperer den flate objektlista på rot-headings (delt logikk i
 * `@sitedoc/shared`) UTEN datamodell-endring. Felter før første heading vises
 * ugruppert. `render` gjenbruker skjermens eksisterende per-objekt-rendring.
 *
 * Utfyllingsstatus (Kenneth-gatet 05.09): headeren viser «X av Y utfylt» med ✓/⚠ per seksjon
 * — en kollapset seksjon kan ellers bli glemt og la uutfylte kontrollpunkter stå i et dokument
 * som ser ferdig ut. Telleren gjelder KUN feltverdi (kommentar/vedlegg er tilbehør).
 */
export function UtfyllingSeksjoner<T extends MinObjekt>({
  objekter,
  render,
  feltStatus,
}: {
  objekter: T[];
  render: (objekt: T) => ReactNode;
  feltStatus: FeltStatusOppslag<T>;
}) {
  const { t } = useTranslation();
  const seksjoner = grupperMedOverskrift(objekter);
  const [kollapsede, setKollapsede] = useState<Set<string>>(new Set());

  // Ingen rot-headings → ren flat visning uten seksjons-krom.
  if (!seksjoner.some((s) => s.overskrift !== null)) {
    return <>{objekter.map(render)}</>;
  }

  function veksle(id: string) {
    setKollapsede((forrige) => {
      const neste = new Set(forrige);
      if (neste.has(id)) neste.delete(id);
      else neste.add(id);
      return neste;
    });
  }

  return (
    <>
      {seksjoner.map((seksjon, i) => {
        if (!seksjon.overskrift) {
          return <View key={`ledende-${i}`}>{seksjon.felter.map(render)}</View>;
        }
        const id = seksjon.overskrift.id;
        const kollapset = kollapsede.has(id);
        const status = beregnSeksjonUtfylling(seksjon.felter, feltStatus);
        return (
          <View key={id} className="mb-2 overflow-hidden rounded-xl border border-gray-200">
            <Pressable
              onPress={() => veksle(id)}
              className="flex-row items-center justify-between bg-gray-50 px-4 py-3"
            >
              <Text className="flex-1 text-base font-semibold text-gray-900">
                {seksjon.overskrift.label}
              </Text>
              <View className="flex-row shrink-0 items-center gap-2">
                {status.tilstand !== "tom" && <SeksjonStatusMerke status={status} t={t} />}
                {kollapset ? (
                  <ChevronRight size={18} color="#6b7280" />
                ) : (
                  <ChevronDown size={18} color="#6b7280" />
                )}
              </View>
            </Pressable>
            {!kollapset && <View className="px-2 pb-2 pt-1">{seksjon.felter.map(render)}</View>}
          </View>
        );
      })}
    </>
  );
}

/** Høyrestilt «X av Y utfylt» + ✓/⚠. ⚠ KUN ved urørt — delvis bærer signalet i tallet alene. */
function SeksjonStatusMerke({
  status,
  t,
}: {
  status: SeksjonUtfylling;
  t: (nokkel: string, opts?: Record<string, unknown>) => string;
}) {
  const { utfylt, totalt, tilstand } = status;
  if (tilstand === "komplett") {
    return (
      <View className="flex-row items-center gap-1">
        <Text className="text-sm font-medium text-emerald-700">
          {t("seksjonsstatus.utfylt", { utfylt, totalt })}
        </Text>
        <Check size={14} color="#047857" />
      </View>
    );
  }
  if (tilstand === "urort") {
    return (
      <View className="flex-row items-center gap-1">
        <Text className="text-sm font-medium text-amber-600">
          {t("seksjonsstatus.urort", { utfylt, totalt })}
        </Text>
        <AlertTriangle size={14} color="#d97706" />
      </View>
    );
  }
  return (
    <Text className="text-sm font-medium text-gray-600">
      {t("seksjonsstatus.utfylt", { utfylt, totalt })}
    </Text>
  );
}
