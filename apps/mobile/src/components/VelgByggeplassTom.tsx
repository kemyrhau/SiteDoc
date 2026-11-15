import { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "../kontekst/ProsjektKontekst";
import { useByggeplass } from "../kontekst/ByggeplassKontekst";
import { useAuth } from "../providers/AuthProvider";
import { useNettverk } from "../providers/NettverkProvider";
import { hentByggeplasserNavLokalt } from "../services/tegningKatalog";
import { trpc } from "../lib/trpc";

/** (22) Lista må vente på et byggeplassvalg: prosjektet har byggeplasser, ingen er valgt. */
export function useMaaVelgeByggeplass(): boolean {
  const { valgtBygningId, harByggeplasser } = useByggeplass();
  return harByggeplasser === true && !valgtBygningId;
}

/**
 * (22) Tomtilstand for lister uten byggeplassvalg: «Velg byggeplass» med ett-trykks-knapp
 * pr. byggeplass (samme kilde som toppvelgeren).
 * Valget lagres som manuelt valg (`settBygning`) og huskes.
 */
export function VelgByggeplassTom() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { settBygning } = useByggeplass();
  const { erPaaNettet } = useNettverk();
  const { bruker } = useAuth();
  const query = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId ?? "" },
    { enabled: !!valgtProsjektId && erPaaNettet },
  );
  const byggeplasser = useMemo(() => {
    const server = query.data as { id: string; name: string }[] | undefined;
    if (server) return server.map((b) => ({ id: b.id, name: b.name }));
    if (!valgtProsjektId || !bruker?.id) return [];
    return hentByggeplasserNavLokalt(valgtProsjektId, bruker.id).map((b) => ({ id: b.id, name: b.name }));
  }, [query.data, valgtProsjektId, bruker?.id]);

  return (
    <View className="items-center px-6 pt-16" testID="velg-byggeplass">
      <MapPin size={28} color="#d97706" />
      <Text className="mt-3 text-base font-semibold text-gray-900">{t("byggeplass.velgByggeplass")}</Text>
      <Text className="mt-1 text-center text-sm text-gray-500">{t("byggeplass.velgForListe")}</Text>
      <View className="mt-4 w-full gap-2">
        {byggeplasser.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => settBygning(b.id)}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 active:bg-blue-100"
          >
            <Text className="text-base text-sitedoc-primary">{b.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
