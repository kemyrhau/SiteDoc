import { useMemo } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Phone, Mail, Contact } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../src/lib/trpc";
import { useProsjekt } from "../src/kontekst/ProsjektKontekst";
import { apnLenke } from "../src/lib/apnLenke";
import { useMiniToast, MiniToast } from "../src/components/MiniToast";

interface Faggruppe {
  id: string;
  name: string;
  color: string | null;
}

interface ProsjektMedlem {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string; phone: string | null };
  faggruppeKoblinger: Array<{ faggruppe: { id: string; name: string } }>;
}

type Seksjon = {
  id: string;
  navn: string;
  farge: string | null;
  kontakter: ProsjektMedlem[];
};

// Fargekart lik web (P31) — Tailwind-punktfarger per faggruppe.
const FARGE_MAP: Record<string, string> = {
  red: "#ef4444", orange: "#f97316", amber: "#f59e0b", yellow: "#eab308",
  lime: "#84cc16", green: "#22c55e", emerald: "#10b981", teal: "#14b8a6",
  cyan: "#06b6d4", sky: "#0ea5e9", blue: "#3b82f6", indigo: "#6366f1",
  violet: "#8b5cf6", purple: "#a855f7", fuchsia: "#d946ef", pink: "#ec4899",
  rose: "#f43f5e", slate: "#64748b",
};

function fargeHex(farge: string | null): string {
  return (farge && FARGE_MAP[farge]) || "#9ca3af";
}

/**
 * P31 Kontakter (mobil, K6) — read-only lesevisning gruppert per faggruppe med
 * klikk-for-å-ringe (tel:) og e-post (mailto:). Gjenbruker samme queries som
 * dokumentflyt-siden (faggruppe + medlem). Ingen CRUD.
 */
export default function KontakterSkjerm() {
  const router = useRouter();
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { melding, vis } = useMiniToast();

  async function apnKontakt(url: string, verdi: string) {
    const ok = await apnLenke(url);
    if (!ok) vis(t("kontakt.kunneIkkeApne", { verdi }));
  }

  const { data: faggrupper, isLoading: e1 } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const { data: medlemmer, isLoading: e2 } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const erLaster = e1 || e2;

  const seksjoner = useMemo<Seksjon[]>(() => {
    const fg = (faggrupper as Faggruppe[] | undefined) ?? [];
    const alle = (medlemmer as ProsjektMedlem[] | undefined) ?? [];
    const perFaggruppe = new Map<string, ProsjektMedlem[]>();
    const utenFaggruppe: ProsjektMedlem[] = [];

    for (const m of alle) {
      if (m.faggruppeKoblinger.length === 0) {
        utenFaggruppe.push(m);
      } else {
        for (const kobling of m.faggruppeKoblinger) {
          const liste = perFaggruppe.get(kobling.faggruppe.id) ?? [];
          liste.push(m);
          perFaggruppe.set(kobling.faggruppe.id, liste);
        }
      }
    }

    const resultat: Seksjon[] = fg
      .map((f) => ({
        id: f.id,
        navn: f.name,
        farge: f.color,
        kontakter: perFaggruppe.get(f.id) ?? [],
      }))
      .filter((s) => s.kontakter.length > 0);

    if (utenFaggruppe.length > 0) {
      resultat.push({
        id: "__uten__",
        navn: t("kontakter.utenFaggruppe"),
        farge: null,
        kontakter: utenFaggruppe,
      });
    }
    return resultat;
  }, [faggrupper, medlemmer, t]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#1f2937" />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-gray-900">
          {t("nav.kontakter")}
        </Text>
      </View>

      {erLaster ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      ) : seksjoner.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Contact size={40} color="#d1d5db" />
          <Text className="mt-3 text-sm text-gray-500">{t("kontakter.ingenKontakter")}</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="pb-8">
          {seksjoner.map((seksjon) => (
            <View key={seksjon.id} className="mt-4">
              <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 pb-1.5 pt-3">
                <View
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: fargeHex(seksjon.farge) }}
                />
                <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {seksjon.navn}
                </Text>
              </View>
              {seksjon.kontakter.map((k) => (
                <View
                  key={`${seksjon.id}-${k.id}`}
                  className="border-b border-gray-100 bg-white px-4 py-3"
                >
                  <Text className="text-sm font-medium text-gray-900">
                    {k.user.name ?? k.user.email}
                  </Text>
                  <View className="mt-1.5 flex-row flex-wrap gap-2">
                    {k.user.phone && (
                      <Pressable
                        onPress={() => apnKontakt(`tel:${k.user.phone}`, k.user.phone!)}
                        className="flex-row items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 active:bg-blue-100"
                      >
                        <Phone size={14} color="#1e40af" />
                        <Text className="text-xs text-blue-700">{k.user.phone}</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => apnKontakt(`mailto:${k.user.email}`, k.user.email)}
                      className="flex-row items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 active:bg-gray-200"
                    >
                      <Mail size={14} color="#4b5563" />
                      <Text className="text-xs text-gray-600">{k.user.email}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
      <MiniToast melding={melding} />
    </SafeAreaView>
  );
}
