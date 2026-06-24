import { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { MapPin, ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "../kontekst/ProsjektKontekst";
import { useByggeplass } from "../kontekst/ByggeplassKontekst";
import { hentByggeplasserForProsjektLokalt } from "../services/byggeplassKatalog";
import { ByggeplassVelgerModal } from "./timer-detalj/ByggeplassVelger";

/**
 * Delt header-chip for global aktiv byggeplass (F2 av «Mobil global byggeplass-UX»).
 * Byggeplass-only (prosjekt er implisitt via aktivt prosjekt). Trykk → bottom-sheet
 * «Bytt byggeplass» (gjenbruk `ByggeplassVelgerModal`), skriver `settBygning`
 * (eneste globale setter sammen med GPS — F3). Vises kun når et prosjekt er aktivt.
 *
 * GPS-status-linje + favoritter legges til i F3/F6.
 */
export function ByggeplassChip() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId, settBygning } = useByggeplass();
  const [visVelger, setVisVelger] = useState(false);

  const byggeplasser = useMemo(
    () => (valgtProsjektId ? hentByggeplasserForProsjektLokalt(valgtProsjektId) : []),
    [valgtProsjektId],
  );

  const valgt = useMemo(
    () => byggeplasser.find((b) => b.id === valgtBygningId) ?? null,
    [byggeplasser, valgtBygningId],
  );

  // Ingen kontekst (intet prosjekt) eller ingen byggeplasser i cache → ingen chip.
  if (!valgtProsjektId || byggeplasser.length === 0) return null;

  const tittel = valgt?.navn ?? t("byggeplassVelger.velg");

  return (
    <>
      <Pressable
        onPress={() => setVisVelger(true)}
        className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"
      >
        <MapPin size={18} color="#1e40af" />
        <Text className="flex-1 text-sm font-semibold text-sitedoc-primary" numberOfLines={1}>
          {tittel}
        </Text>
        <ChevronDown size={18} color="#1e40af" />
      </Pressable>

      {visVelger && (
        <ByggeplassVelgerModal
          projectId={valgtProsjektId}
          valgtId={valgtBygningId}
          onVelg={(id) => {
            settBygning(id);
            setVisVelger(false);
          }}
          onLukk={() => setVisVelger(false)}
        />
      )}
    </>
  );
}
