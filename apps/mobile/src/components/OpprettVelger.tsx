import { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  BackHandler,
  Alert,
} from "react-native";
// eslint-disable-next-line no-restricted-imports -- in-tree overlay (styles.overlay), ikke native <Modal>: samme frys-trygge mønster som MalVelger.
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { trpc } from "../lib/trpc";
import { formaterServerFeil } from "../lib/feil";
import { useProsjekt } from "../kontekst/ProsjektKontekst";
import { useByggeplass } from "../kontekst/ByggeplassKontekst";

/**
 * Gruppert opprett-velger (ordre opprett-uten-modal 2026-09-22) — erstatter den flate
 * `MalVelger` + `OpprettDokumentModal`-opprett-flyten på listeskjermene. Kopierer
 * web-mønsteret (`OpprettMalVelger` + `velgerGrupper`): maler listes gruppert
 * faggruppe → dokumentflyt → mal, og ETT trykk oppretter dokumentet direkte — brukeren
 * lander i utfyllingen. Ingen faggruppe-velger (utledes av flyten, server-side), ingen
 * flyt-velger (en mal i flere flyter står under hver, så trykket er entydig).
 *
 * Klienten sender IKKE `bestillerFaggruppeId` — serveren utleder den fra flyten
 * (`sjekkliste.ts`/`oppgave.ts`, delt `utledBestillerUtforer`). Lokasjon velges ikke
 * ved opprettelse: byggeplass/tegning arves fra `ByggeplassKontekst` og justeres inne i
 * dokumentet (GPS-forslaget bor på listeskjermens kontekstkort, ikke her).
 *
 * In-tree overlay (ikke native `<Modal>`) — samme frys-trygge mønster som `MalVelger`:
 * ved opprett unmountes overlayen og navigasjonen skyves uten et native ark som river
 * seg ned samtidig. `OpprettDokumentModal` beholdes for felt-oppgave-veien
 * (`sjekkliste/[id].tsx`), som setter posisjon på forhånd.
 */

interface MalData {
  id: string;
  name: string;
  prefix: string | null;
  category: string;
  opprettbar?: boolean;
  opprettbareFlytIder?: string[];
}

interface DokumentflytData {
  id: string;
  name: string;
  faggruppeId: string | null;
  medlemmer: Array<{ rolle: string; faggruppe: { id: string; name: string } | null }>;
}

interface FaggruppeData {
  id: string;
  name: string;
}

interface OpprettVelgerProps {
  synlig: boolean;
  kategori: "sjekkliste" | "oppgave";
  /** Kalles med det opprettede dokumentets id — kalleren navigerer + lukker velgeren. */
  onOpprettet: (id: string) => void;
  onLukk: () => void;
}

const NB = "nb-NO";

/** Mal-rader på prefiks (naturlig/numerisk), uten prefiks nederst (paritet web). */
function sammenlignMal(a: MalData, b: MalData): number {
  const ap = a.prefix?.trim() ?? "";
  const bp = b.prefix?.trim() ?? "";
  if (ap && !bp) return -1;
  if (!ap && bp) return 1;
  if (ap && bp) {
    const c = ap.localeCompare(bp, NB, { numeric: true, sensitivity: "base" });
    if (c !== 0) return c;
  }
  return a.name.localeCompare(b.name, NB, { numeric: true, sensitivity: "base" });
}

export function OpprettVelger({ synlig, kategori, onOpprettet, onLukk }: OpprettVelgerProps) {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  // Lokasjon arves fra global kontekst (samme kilde som chip/GPS skriver til).
  const { valgtBygningId, hentSistTegning } = useByggeplass();

  const malQuery = trpc.mal.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const dokumentflytQuery = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const faggruppeQuery = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );

  // Stabil array-identitet (unngår at grupper-useMemo + auto-opprett-effekten
  // thrasher når query.data er undefined og `?? []` ellers gir ny referanse hver render).
  const maler = useMemo(() => (malQuery.data ?? []) as MalData[], [malQuery.data]);
  const alleDokumentflyter = useMemo(
    () => (dokumentflytQuery.data ?? []) as DokumentflytData[],
    [dokumentflytQuery.data],
  );
  const faggrupper = useMemo(() => (faggruppeQuery.data ?? []) as FaggruppeData[], [faggruppeQuery.data]);

  const kategoriMaler = useMemo(
    () => maler.filter((m) => m.category === kategori),
    [maler, kategori],
  );
  const utilgjengeligeMaler = useMemo(
    () => kategoriMaler.filter((m) => m.opprettbar === false),
    [kategoriMaler],
  );

  // Tre: faggruppe (bestiller) → dokumentflyt → mal. En mal med flere opprettbare flyter
  // står under hver flyt-undergruppe (trykket blir dermed entydig — ingen steg-2).
  // Speiler modalens `flytKandidater` + webs `velgerGrupper`: kun flyter med
  // eier-faggruppe (`faggruppeId != null`) — bestiller kan da utledes av serveren.
  const grupper = useMemo(() => {
    const dfById = new Map(alleDokumentflyter.map((df) => [df.id, df]));
    const navnForFag = (id: string, df: DokumentflytData) =>
      faggrupper.find((f) => f.id === id)?.name ??
      df.medlemmer.find((m) => m.faggruppe?.id === id)?.faggruppe?.name ??
      "";
    const fagMap = new Map<
      string,
      { faggruppeId: string; faggruppeNavn: string; flyter: Map<string, { flytId: string; flytNavn: string; maler: MalData[] }> }
    >();
    for (const mal of kategoriMaler) {
      if (mal.opprettbar === false) continue;
      for (const flytId of mal.opprettbareFlytIder ?? []) {
        const df = dfById.get(flytId);
        if (!df || df.faggruppeId == null) continue;
        const fag =
          fagMap.get(df.faggruppeId) ??
          { faggruppeId: df.faggruppeId, faggruppeNavn: navnForFag(df.faggruppeId, df), flyter: new Map() };
        const flyt = fag.flyter.get(df.id) ?? { flytId: df.id, flytNavn: df.name, maler: [] };
        flyt.maler.push(mal);
        fag.flyter.set(df.id, flyt);
        fagMap.set(df.faggruppeId, fag);
      }
    }
    // Deterministisk sortering (paritet web): faggrupper + flyter alfabetisk, maler på prefiks.
    return [...fagMap.values()]
      .sort((a, b) => a.faggruppeNavn.localeCompare(b.faggruppeNavn, NB, { sensitivity: "base" }))
      .map((fag) => ({
        ...fag,
        flyter: [...fag.flyter.values()]
          .sort((x, y) => x.flytNavn.localeCompare(y.flytNavn, NB, { sensitivity: "base" }))
          .map((flyt) => ({ ...flyt, maler: [...flyt.maler].sort(sammenlignMal) })),
      }));
  }, [kategoriMaler, alleDokumentflyter, faggrupper]);

  // Flat liste av (mal, flyt)-blader — for auto-opprett når det finnes nøyaktig ett.
  const blader = useMemo(
    () => grupper.flatMap((f) => f.flyter.flatMap((fl) => fl.maler.map((m) => ({ malId: m.id, malNavn: m.name, flytId: fl.flytId })))),
    [grupper],
  );

  // Dobbelttrykk-vakt (synkron, mot to mutate() i samme frame). Nullstilles ved FEIL
  // så brukeren kan prøve på nytt, og ved lukking.
  const harOpprettet = useRef(false);
  const feilet = () => {
    harOpprettet.current = false;
  };
  const opprettSjekkliste = trpc.sjekkliste.opprett.useMutation({
    // eslint-disable-next-line
    onSuccess: (_data: unknown) => onOpprettet((_data as { id: string }).id),
    onError: (feil: { message?: string }) => {
      feilet();
      Alert.alert(t("feil.tittel"), formaterServerFeil(feil, t("opprettModal.kunneIkkeOpprette")));
    },
  });
  const opprettOppgave = trpc.oppgave.opprett.useMutation({
    // eslint-disable-next-line
    onSuccess: (_data: unknown) => onOpprettet((_data as { id: string }).id),
    onError: (feil: { message?: string }) => {
      feilet();
      Alert.alert(t("feil.tittel"), formaterServerFeil(feil, t("opprettModal.kunneIkkeOpprette")));
    },
  });
  const erPending = opprettSjekkliste.isPending || opprettOppgave.isPending;

  // Opprett direkte fra et blad. Sender IKKE bestiller/utfører-faggruppe — serveren
  // utleder dem fra flyten. Lokasjon arves fra kontekst (byggeplass + sist-tegning).
  function opprett(malId: string, malNavn: string, flytId: string) {
    if (erPending || harOpprettet.current) return;
    harOpprettet.current = true;
    const byggeplassId = valgtBygningId ?? undefined;
    const drawingId = valgtBygningId ? (hentSistTegning(valgtBygningId) ?? undefined) : undefined;
    if (kategori === "sjekkliste") {
      opprettSjekkliste.mutate({ templateId: malId, dokumentflytId: flytId, byggeplassId, drawingId });
    } else {
      // Oppgave krever tittel — default malnavn (redigerbar i detaljskjermen). Oppgave-
      // opprett tar ikke byggeplassId (kun drawingId), paritet med modalen.
      opprettOppgave.mutate({ templateId: malId, dokumentflytId: flytId, title: malNavn, drawingId });
    }
  }

  // Auto-opprett når det finnes nøyaktig ett blad (én mal, én flyt): trykk + → rett i
  // utfyllingen, ingen mellomskjerm (bevarer ett-klikk, paritet med tidligere auto-hopp).
  // Egen engangsvakt: fyres nøyaktig én gang per åpning, nullstilles KUN ved lukking (ikke
  // ved feil) — ellers ville en feilet auto-opprettelse loope alarm-dialogen.
  const harAutoOpprettet = useRef(false);
  const klar = !malQuery.isLoading && !dokumentflytQuery.isLoading;
  useEffect(() => {
    if (!synlig) {
      harOpprettet.current = false;
      harAutoOpprettet.current = false;
      return;
    }
    if (klar && blader.length === 1 && !harAutoOpprettet.current) {
      harAutoOpprettet.current = true;
      const b = blader[0]!;
      opprett(b.malId, b.malNavn, b.flytId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synlig, klar, blader]);

  // Android maskinvare-tilbake (in-tree overlay fanger ikke via onRequestClose).
  useEffect(() => {
    if (!synlig) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onLukk();
      return true;
    });
    return () => sub.remove();
  }, [synlig, onLukk]);

  if (!synlig) return null;
  // Mens data lastes, ved auto-opprett (ett blad), eller mens opprettelsen pågår: vis
  // ikke listen (den skal ikke blinke opp for så å forsvinne idet vi navigerer).
  const laster = malQuery.isLoading || dokumentflytQuery.isLoading;
  const autoOppretter = klar && blader.length === 1;

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
        <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
          <Text className="text-sm font-semibold text-white">
            {kategori === "sjekkliste" ? t("malVelger.velgSjekklistemal") : t("malVelger.velgOppgavemal")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={20} color="#ffffff" />
          </Pressable>
        </View>

        {laster || autoOppretter || erPending ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="text-sm text-gray-500">
              {erPending || autoOppretter ? t("opprettModal.oppretter") : t("malVelger.henter")}
            </Text>
          </View>
        ) : grupper.length === 0 && utilgjengeligeMaler.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-base text-gray-500">
              {kategori === "sjekkliste" ? t("malVelger.ingenSjekklistemaler") : t("malVelger.ingenOppgavemaler")}
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1">
            {grupper.map((fag) => (
              <View key={fag.faggruppeId} className="pt-3">
                {/* Nivå 1 — faggruppe (VERSALER) */}
                <Text className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {fag.faggruppeNavn}
                </Text>
                {fag.flyter.map((flyt) => (
                  <View key={flyt.flytId}>
                    {/* Nivå 2 — dokumentflyt */}
                    <Text className="px-5 pt-1 text-[13px] font-medium text-gray-400">
                      {flyt.flytNavn}
                    </Text>
                    {/* Nivå 3 — mal-rader; trykk oppretter direkte */}
                    {flyt.maler.map((mal) => (
                      <Pressable
                        key={`${flyt.flytId}:${mal.id}`}
                        onPress={() => opprett(mal.id, mal.name, flyt.flytId)}
                        className="flex-row items-center border-b border-gray-100 bg-white px-5 py-3"
                      >
                        <Text className="flex-1 text-sm font-medium text-gray-900">{mal.name}</Text>
                        {mal.prefix ? (
                          <View className="rounded bg-gray-100 px-2 py-1">
                            <Text className="text-xs font-medium text-gray-600">{mal.prefix}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            ))}

            {/* Utilgjengelige maler (kan ikke opprettes — ingen flyt bruker malen). Dempet. */}
            {utilgjengeligeMaler.length > 0 && (
              <View className="mt-2 border-t border-gray-100 pt-2">
                <Text className="px-4 pb-1 text-xs font-semibold uppercase text-gray-400">
                  {t("malVelger.visUtilgjengelige", { antall: utilgjengeligeMaler.length })}
                </Text>
                {utilgjengeligeMaler.map((mal) => (
                  <View key={mal.id} className="border-b border-gray-100 bg-white px-4 py-3 opacity-60">
                    <Text className="text-sm font-medium text-gray-500">{mal.name}</Text>
                    <Text className="text-xs text-gray-400">{t("malVelger.ingenFlytBrukerMal")}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
    zIndex: 1000,
    elevation: 1000,
  },
});
