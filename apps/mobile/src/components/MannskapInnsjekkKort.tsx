import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { HardHat, LogIn, LogOut } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useProsjekt } from "../kontekst/ProsjektKontekst";
import { useByggeplass } from "../kontekst/ByggeplassKontekst";
import { useNettverk } from "../providers/NettverkProvider";

/**
 * Manuell §15-innsjekk/utsjekk på byggeplass (Fase A, vy i PSI-modulen).
 * ONLINE-ONLY: presence er katastrofe-mønstrings-data — en offline-innsjekk som
 * ikke syncer er farlig for §15-listen. Ingen offline-kø i Fase A; tydelig
 * «krever nett» når offline. Presence ≠ lønnstid (ingen timer-kobling).
 */
export function MannskapInnsjekkKort() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const { erPaaNettet } = useNettverk();
  const utils = trpc.useUtils();

  const statusQuery = trpc.mannskap.minStatus.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && erPaaNettet },
  );

  const sjekkInn = trpc.mannskap.sjekkInn.useMutation({
    onSuccess: () => utils.mannskap.minStatus.invalidate(),
    onError: (e: { message: string }) => Alert.alert(t("mannskap.feil"), e.message),
  });
  const sjekkUt = trpc.mannskap.sjekkUt.useMutation({
    onSuccess: () => utils.mannskap.minStatus.invalidate(),
    onError: (e: { message: string }) => Alert.alert(t("mannskap.feil"), e.message),
  });

  if (!valgtProsjektId) return null;

  const status = statusQuery.data;
  const behandler = sjekkInn.isPending || sjekkUt.isPending;

  // Online-only: tydelig «krever nett»
  if (!erPaaNettet) {
    return (
      <View className="mx-4 mt-3 flex-row items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <HardHat size={16} color="#9ca3af" />
        <Text className="flex-1 text-sm text-gray-500">{t("mannskap.kreverNett")}</Text>
      </View>
    );
  }

  if (status) {
    const inn = new Date(status.innsjekkTid).toLocaleTimeString("no-NB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <View className="mx-4 mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
        <View className="flex-row items-center gap-2">
          <HardHat size={16} color="#10b981" />
          <Text className="flex-1 text-sm font-medium text-green-800">
            {t("mannskap.loggetInn", {
              sted: status.byggeplassNavn ?? t("mannskap.byggeplassen"),
              tid: inn,
            })}
          </Text>
        </View>
        <Pressable
          onPress={() =>
            sjekkUt.mutate({
              projectId: valgtProsjektId,
              byggeplassId: status.byggeplassId ?? null,
            })
          }
          disabled={behandler}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-lg bg-red-600 py-3 active:bg-red-700 disabled:opacity-50"
        >
          {behandler ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <LogOut size={16} color="#ffffff" />
          )}
          <Text className="text-sm font-semibold text-white">{t("mannskap.loggUt")}</Text>
        </Pressable>
      </View>
    );
  }

  // Ikke innsjekket → logg inn på valgt byggeplass
  return (
    <Pressable
      onPress={() =>
        sjekkInn.mutate({
          projectId: valgtProsjektId,
          byggeplassId: valgtBygningId ?? null,
          kilde: "app",
        })
      }
      disabled={behandler}
      className="mx-4 mt-3 flex-row items-center justify-center gap-2 rounded-lg bg-blue-600 py-4 active:bg-blue-700 disabled:opacity-50"
    >
      {behandler ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <LogIn size={18} color="#ffffff" />
      )}
      <Text className="text-base font-semibold text-white">{t("mannskap.loggInn")}</Text>
    </Pressable>
  );
}
