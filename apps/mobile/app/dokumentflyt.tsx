import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, GitBranch, Phone, Mail, ChevronDown, ChevronRight } from "lucide-react-native";
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

interface DokumentflytMedlem {
  rolle: string;
  kanRedigere: boolean;
  projectMember: { user: { id: string } } | null;
}

interface Dokumentflyt {
  id: string;
  name: string;
  faggruppeId: string | null;
  medlemmer: DokumentflytMedlem[];
}

interface FlytDeltakelse {
  flytNavn: string;
  rolle: string;
  kanRedigere: boolean;
}

type Tilgang = "rediger" | "les" | null;

interface FaggruppeMedlem {
  member: ProsjektMedlem;
  tilgang: Tilgang;
  flyter: FlytDeltakelse[];
}

interface FaggruppeSeksjon {
  id: string;
  navn: string;
  farge: string | null;
  medlemmer: FaggruppeMedlem[];
}

// Fargekart lik web/kontakter (P31) — Tailwind-punktfarger per faggruppe.
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

// Rolle → i18n-nøkkel (speiler ROLLE_KONFIG i web-dokumentflyt-siden).
const ROLLE_NOEKKEL: Record<string, string> = {
  registrator: "dokumentflyt.registrator",
  bestiller: "dokumentflyt.bestiller",
  utforer: "dokumentflyt.utforer",
  godkjenner: "dokumentflyt.godkjenner",
};

// Kontakt-chips (tlf + e-post) — brukt i begge visninger. Åpner via apnLenke;
// `apnKontakt` viser stille fallback hvis lenken ikke kan åpnes (f.eks. mailto i
// simulator). Tlf-chip vises kun når nummer er registrert.
function KontaktChips({
  epost,
  tlf,
  apnKontakt,
}: {
  epost: string;
  tlf: string | null;
  apnKontakt: (url: string, verdi: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {tlf ? (
        <Pressable
          onPress={() => apnKontakt(`tel:${tlf}`, tlf)}
          className="flex-row items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 active:bg-blue-100"
        >
          <Phone size={14} color="#1e40af" />
          <Text className="text-xs text-blue-700">{tlf}</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => apnKontakt(`mailto:${epost}`, epost)}
        className="flex-row items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 active:bg-gray-200"
      >
        <Mail size={14} color="#4b5563" />
        <Text className="text-xs text-gray-600">{epost}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Dokumentflyt (mobil) — READ-ONLY oversikt over prosjektets medlemsliste med to
 * visninger (segmentkontroll): «Etter faggruppe» (medlemmer per faggruppe med
 * aggregert les/rediger-tilgang, per-flyt-detalj ved trykk) og «Etter person»
 * (én linje per menneske med navn/e-post/tlf). Bro-skjerm mot kunderunden (F2);
 * dokumentflyt-redesign er eget fremtidig tema. Gjenbruker samme queries som
 * web-dokumentflyt- og Kontakter-visningen. INGEN mutasjoner, ingen redigering.
 *
 * Modell-merknad (input til dokumentflyt-redesign): les/rediger (`kanRedigere`) er
 * definert per dokumentflyt-medlemskap, ikke per faggruppe — én person kan være
 * Redigerer i én flyt og Leser i en annen innen samme faggruppe. Oversikten
 * aggregerer «Redigerer hvis minst én flyt gir det». Tilgang via brukergruppe
 * (ikke direkte projectMember) er ikke ekspandert her.
 */
export default function DokumentflytSkjerm() {
  const router = useRouter();
  const { t } = useTranslation();
  const { valgtProsjektId, lasterProsjektId } = useProsjekt();

  const [visning, setVisning] = useState<"faggruppe" | "person">("faggruppe");
  const [ekspandert, setEkspandert] = useState<Set<string>>(new Set());
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
  const { data: dokumentflyter, isLoading: e3 } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const erLaster = !!valgtProsjektId && (e1 || e2 || e3);

  // Per (faggruppeId → brukerId) → dokumentflyt-deltakelser. Kilde for
  // aggregert tilgang + per-flyt-detalj. Gruppe-medlemmer (uten projectMember)
  // hoppes over — kun direkte person-medlemskap ekspanderes.
  const flytOppslag = useMemo(() => {
    const map = new Map<string, Map<string, FlytDeltakelse[]>>();
    const flyter = (dokumentflyter as Dokumentflyt[] | undefined) ?? [];
    for (const flyt of flyter) {
      if (!flyt.faggruppeId) continue;
      let perBruker = map.get(flyt.faggruppeId);
      if (!perBruker) {
        perBruker = new Map();
        map.set(flyt.faggruppeId, perBruker);
      }
      for (const m of flyt.medlemmer) {
        const brukerId = m.projectMember?.user?.id;
        if (!brukerId) continue;
        const liste = perBruker.get(brukerId) ?? [];
        liste.push({ flytNavn: flyt.name, rolle: m.rolle, kanRedigere: m.kanRedigere });
        perBruker.set(brukerId, liste);
      }
    }
    return map;
  }, [dokumentflyter]);

  const faggruppeSeksjoner = useMemo<FaggruppeSeksjon[]>(() => {
    const fg = (faggrupper as Faggruppe[] | undefined) ?? [];
    const alle = (medlemmer as ProsjektMedlem[] | undefined) ?? [];
    return fg
      .map((f) => {
        const perBruker = flytOppslag.get(f.id);
        // Et medlem hører til faggruppen hvis det er faggruppe-koblet ELLER
        // deltar i en av faggruppens dokumentflyter (union) — begge er relevante
        // for «hvem har tilgang».
        const medlemmerIGruppe: FaggruppeMedlem[] = alle
          .filter(
            (m) =>
              m.faggruppeKoblinger.some((k) => k.faggruppe.id === f.id) ||
              (perBruker?.has(m.user.id) ?? false),
          )
          .map((member) => {
            const flyter = perBruker?.get(member.user.id) ?? [];
            const tilgang: Tilgang =
              flyter.length === 0 ? null : flyter.some((x) => x.kanRedigere) ? "rediger" : "les";
            return { member, tilgang, flyter };
          });
        return { id: f.id, navn: f.name, farge: f.color, medlemmer: medlemmerIGruppe };
      })
      .filter((s) => s.medlemmer.length > 0);
  }, [faggrupper, medlemmer, flytOppslag]);

  const personer = useMemo<ProsjektMedlem[]>(() => {
    const alle = (medlemmer as ProsjektMedlem[] | undefined) ?? [];
    return [...alle].sort((a, b) =>
      (a.user.name ?? a.user.email).localeCompare(b.user.name ?? b.user.email),
    );
  }, [medlemmer]);

  function toggleEkspander(noekkel: string) {
    setEkspandert((prev) => {
      const ny = new Set(prev);
      if (ny.has(noekkel)) ny.delete(noekkel);
      else ny.add(noekkel);
      return ny;
    });
  }

  function rolleLabel(rolle: string): string {
    const noekkel = ROLLE_NOEKKEL[rolle];
    return noekkel ? t(noekkel) : rolle;
  }

  function TilgangBadge({ tilgang }: { tilgang: Exclude<Tilgang, null> }) {
    return (
      <View className={`rounded px-1.5 py-0.5 ${tilgang === "rediger" ? "bg-gray-100" : "bg-amber-100"}`}>
        <Text className={`text-[10px] font-medium ${tilgang === "rediger" ? "text-gray-600" : "text-amber-700"}`}>
          {tilgang === "rediger" ? t("dokumentflyt.redigerer") : t("dokumentflyt.leserRettighet")}
        </Text>
      </View>
    );
  }

  const visSegment = () => (
    <View className="flex-row gap-1 border-b border-gray-200 bg-white px-4 py-2">
      {(["faggruppe", "person"] as const).map((v) => {
        const aktiv = visning === v;
        return (
          <Pressable
            key={v}
            onPress={() => setVisning(v)}
            className={`flex-1 items-center rounded-md py-2 ${aktiv ? "bg-blue-50" : "bg-gray-50"}`}
          >
            <Text className={`text-xs font-medium ${aktiv ? "text-blue-700" : "text-gray-500"}`}>
              {v === "faggruppe" ? t("dokumentflyt.etterFaggruppe") : t("dokumentflyt.etterPerson")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const visFaggruppeVisning = () => {
    if (faggruppeSeksjoner.length === 0) {
      return (
        <View className="flex-1 items-center justify-center px-8">
          <GitBranch size={40} color="#d1d5db" />
          <Text className="mt-3 text-center text-sm text-gray-500">
            {t("dokumentflyt.ingenMedlemmer")}
          </Text>
        </View>
      );
    }
    return (
      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        {faggruppeSeksjoner.map((seksjon) => (
          <View key={seksjon.id} className="mt-4">
            <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 pb-1.5 pt-3">
              <View className="h-3 w-3 rounded-full" style={{ backgroundColor: fargeHex(seksjon.farge) }} />
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {seksjon.navn}
              </Text>
            </View>
            {seksjon.medlemmer.map((fm) => {
              const noekkel = `${seksjon.id}:${fm.member.id}`;
              const kanEkspandere = fm.flyter.length > 0;
              const erApen = ekspandert.has(noekkel);
              return (
                <View key={noekkel} className="border-b border-gray-100 bg-white">
                  <Pressable
                    onPress={() => kanEkspandere && toggleEkspander(noekkel)}
                    className="flex-row items-center gap-2 px-4 py-3 active:bg-gray-50"
                  >
                    <View className="w-4">
                      {kanEkspandere &&
                        (erApen ? (
                          <ChevronDown size={16} color="#9ca3af" />
                        ) : (
                          <ChevronRight size={16} color="#9ca3af" />
                        ))}
                    </View>
                    <Text className="flex-1 text-sm text-gray-800" numberOfLines={1}>
                      {fm.member.user.name ?? fm.member.user.email}
                    </Text>
                    {fm.tilgang && <TilgangBadge tilgang={fm.tilgang} />}
                  </Pressable>
                  {erApen && (
                    <View className="gap-1 bg-gray-50 px-4 pb-3 pl-10">
                      {fm.flyter.map((f, i) => (
                        <View key={`${noekkel}-${i}`} className="flex-row items-center gap-2">
                          <Text className="flex-1 text-xs text-gray-600" numberOfLines={1}>
                            {f.flytNavn}
                          </Text>
                          <Text className="text-[11px] text-gray-500">{rolleLabel(f.rolle)}</Text>
                          <TilgangBadge tilgang={f.kanRedigere ? "rediger" : "les"} />
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    );
  };

  const visPersonVisning = () => {
    if (personer.length === 0) {
      return (
        <View className="flex-1 items-center justify-center px-8">
          <GitBranch size={40} color="#d1d5db" />
          <Text className="mt-3 text-center text-sm text-gray-500">
            {t("dokumentflyt.ingenMedlemmer")}
          </Text>
        </View>
      );
    }
    return (
      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        {personer.map((p) => (
          <View key={p.id} className="border-b border-gray-100 bg-white px-4 py-3">
            <Text className="text-sm font-medium text-gray-900">{p.user.name ?? p.user.email}</Text>
            <View className="mt-1.5">
              <KontaktChips epost={p.user.email} tlf={p.user.phone} apnKontakt={apnKontakt} />
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const visInnhold = () => {
    if (lasterProsjektId || erLaster) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      );
    }
    if (!valgtProsjektId) {
      return (
        <View className="flex-1 items-center justify-center px-8">
          <GitBranch size={40} color="#d1d5db" />
          <Text className="mt-3 text-center text-sm text-gray-500">
            {t("dokumentflyt.velgProsjekt")}
          </Text>
        </View>
      );
    }
    return (
      <>
        {visSegment()}
        {visning === "faggruppe" ? visFaggruppeVisning() : visPersonVisning()}
      </>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#1f2937" />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-gray-900">
          {t("dokumentflyt.tittel")}
        </Text>
      </View>
      {visInnhold()}
      <MiniToast melding={melding} />
    </SafeAreaView>
  );
}
