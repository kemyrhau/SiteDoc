import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import { trpc } from "../lib/trpc";
import { formaterServerFeil } from "../lib/feil";
import { useProsjekt } from "../kontekst/ProsjektKontekst";
import { useByggeplass } from "../kontekst/ByggeplassKontekst";

// F1 (Option B): sist-brukt byggeplass/tegning leses fra og skrives til
// ByggeplassKontekst (eneste kilde) — modalen har ikke lenger egne
// `sitedoc_sist_*`-nøkler. Global aktiv byggeplass settes av chip/GPS, ikke her.

/** Sjekk om GPS-koordinat er innenfor tegningens georeferanse-bounds */
function erInnenforBounds(
  lat: number,
  lng: number,
  geo: { point1: { gps: { lat: number; lng: number } }; point2: { gps: { lat: number; lng: number } } },
): boolean {
  const minLat = Math.min(geo.point1.gps.lat, geo.point2.gps.lat);
  const maxLat = Math.max(geo.point1.gps.lat, geo.point2.gps.lat);
  const minLng = Math.min(geo.point1.gps.lng, geo.point2.gps.lng);
  const maxLng = Math.max(geo.point1.gps.lng, geo.point2.gps.lng);
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

type Prioritet = "low" | "medium" | "high" | "critical";

interface FaggruppeData {
  id: string;
  name: string;
}

interface MalData {
  id: string;
  name: string;
  prefix: string | null;
  category: string;
  subjects?: string[];
  // Flytresolusjon: serverens delte opprett-regel (`mal.opprettbareFlytIder`,
  // mal.ts:84-95). Modalen bruker DENNE til flyt-valg — ikke en egen regel — så
  // «vist som opprettbar» og «kan faktisk opprettes» er én sannhet (paritet web).
  opprettbareFlytIder?: string[];
  // Location-tvang (2026-08-19): server-avledet flagg — aktivt location-objekt i
  // malen → posisjon (drawingId + punkt) er påkrevd for å opprette.
  harAktivLocation?: boolean;
}

interface DokumentflytData {
  id: string;
  name: string;
  faggruppeId: string | null;
  medlemmer: Array<{
    id: string;
    steg: number;
    rolle: string;
    faggruppe: { id: string; name: string } | null;
  }>;
  maler: Array<{
    templateId: string;
    template: { id: string; name: string; category: string };
  }>;
}

interface BygningData {
  id: string;
  name: string;
}

interface GeoReferanse {
  point1: { gps: { lat: number; lng: number }; pixel: { x: number; y: number } };
  point2: { gps: { lat: number; lng: number }; pixel: { x: number; y: number } };
}

interface TegningData {
  id: string;
  name: string;
  drawingNumber: string | null;
  geoReference?: GeoReferanse | null;
  byggeplassId?: string | null;
  byggeplass?: { id: string; name: string } | null;
}

interface OpprettDokumentModalProps {
  synlig: boolean;
  kategori: "sjekkliste" | "oppgave";
  mal: MalData;
  onOpprettet: (id: string) => void;
  onLukk: () => void;
  onModalLukket?: () => void;
  // Props for oppgave fra sjekkliste
  sjekklisteId?: string;
  sjekklisteFeltId?: string;
  sjekklisteNummer?: string;
  feltLabel?: string;
  // Create-fra-tegning / kontekstkjede (2026-08-19): forhåndssatt punkt på tegning.
  // Satt → modalen hopper over sin egen lokasjonsvelger, viser en lesbar «plassert
  // på tegning»-oppsummering, og sender positionX/Y til opprett. Se
  // relay/inbox-mobil-kontekstkjede.md.
  posisjon?: { drawingId: string; byggeplassId: string | null; x: number; y: number };
}

const PRIORITETER: { verdi: Prioritet; labelKey: string }[] = [
  { verdi: "low", labelKey: "prioritet.lav" },
  { verdi: "medium", labelKey: "prioritet.middels" },
  { verdi: "high", labelKey: "prioritet.hoey" },
  { verdi: "critical", labelKey: "prioritet.kritisk" },
];

const PRIORITET_FARGER: Record<Prioritet, string> = {
  low: "bg-gray-200 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export function OpprettDokumentModal({
  synlig,
  kategori,
  mal,
  onOpprettet,
  onLukk,
  onModalLukket,
  sjekklisteId,
  sjekklisteFeltId,
  sjekklisteNummer,
  feltLabel,
  posisjon,
}: OpprettDokumentModalProps) {
  const { t } = useTranslation();
  const erOppgave = kategori === "oppgave";
  const erFraSjekkliste = !!sjekklisteId && !!sjekklisteFeltId;
  const { valgtProsjektId } = useProsjekt();
  // F1 (Option B): les default byggeplass + per-byggeplass siste-tegning fra
  // global kontekst. Modalen kaller IKKE settBygning (ingen stille nav-bytte).
  const {
    valgtBygningId: kontekstBygningId,
    hentSistTegning,
    settSistTegning,
  } = useByggeplass();

  const [emne, setEmne] = useState("");
  const [tittel, setTittel] = useState("");
  const [prioritet, setPrioritet] = useState<Prioritet>("medium");
  const [oppretterFaggruppeId, setOppretterFaggruppeId] = useState<string | null>(null);
  const [valgtBygningId, setValgtBygningId] = useState<string | null>(null);
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);
  const [valgtDokumentflytId, setValgtDokumentflytId] = useState<string | null>(null);
  const [lokasjonKilde, setLokasjonKilde] = useState<"gps" | "lagret" | "manuell" | null>(null);
  const [visLokasjonListe, setVisLokasjonListe] = useState(false);
  const [visOppretterListe, setVisOppretterListe] = useState(false);
  const [visDokumentflytListe, setVisDokumentflytListe] = useState(false);
  const [visBygningListe, setVisBygningListe] = useState(false);
  const [visTegningListe, setVisTegningListe] = useState(false);
  const [visEmneListe, setVisEmneListe] = useState(false);

  // `internSynlig` speiler `synlig`-propen. (Historisk hadde denne en `onShow`/
  // `onDismiss`-gate for Paper-arkitekturens VC-kollisjon; under Fabric/newArch er
  // modalen inline og de callbackene fyrer ikke pålitelig → gaten deadlocket ved
  // auto-opprett og etterlot en usynlig touch-fangende modal-host = frys. Fjernet;
  // se `fullførOpprett`. Reprodusert + verifisert i Release-sim 2026-08-19.)
  const [internSynlig, setInternSynlig] = useState(synlig);
  const harAutoOpprettet = useRef(false);
  useEffect(() => {
    setInternSynlig(synlig);
  }, [synlig]);

  // Default oppgave-tittel = malnavn ved modalåpning (redigerbar). Kun på
  // false→true-overgang, så brukerens redigering ikke overskrives.
  const forrigeSynlig = useRef(false);
  useEffect(() => {
    if (synlig && !forrigeSynlig.current && kategori === "oppgave") {
      setTittel(mal.name);
    }
    forrigeSynlig.current = synlig;
  }, [synlig, kategori, mal.name]);

  // Hent ALLE tegninger for prosjektet (for GPS-matching, ufiltrert)
  const alleTegningerQuery = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const alleTegninger = (alleTegningerQuery.data ?? []) as unknown as TegningData[];

  // GPS + sist brukt lokasjon ved modalåpning
  const harKjørtLokasjon = useRef(false);
  useEffect(() => {
    if (!synlig || harKjørtLokasjon.current) return;
    // Create-fra-tegning / kontekstkjede: et forhåndssatt punkt vinner over GPS/sist-
    // brukt. Modalen viser da en lesbar oppsummering i stedet for lokasjonsvelgeren.
    if (posisjon) {
      harKjørtLokasjon.current = true;
      setValgtBygningId(posisjon.byggeplassId);
      setValgtTegningId(posisjon.drawingId);
      setLokasjonKilde("manuell");
      return;
    }
    if (!valgtProsjektId || alleTegninger.length === 0) return;
    harKjørtLokasjon.current = true;

    (async () => {
      // F1: default byggeplass = global kontekst; default tegning = per-byggeplass
      // siste-tegning-minne (erstatter de gamle per-prosjekt-nøklene).
      const lagretBygningId = kontekstBygningId;
      const lagretTegningId = kontekstBygningId
        ? hentSistTegning(kontekstBygningId)
        : null;

      // Forsøk GPS
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const { latitude, longitude } = pos.coords;

          // Finn tegninger der GPS er innenfor bounds
          const treff = alleTegninger.filter((t) => {
            const geo = t.geoReference as GeoReferanse | null;
            if (!geo) return false;
            return erInnenforBounds(latitude, longitude, geo);
          });

          if (treff.length > 0) {
            // Prioriter sist brukte blant GPS-treff
            const sistBrukt = lagretTegningId ? treff.find((t) => t.id === lagretTegningId) : null;
            const valgt = sistBrukt ?? treff[0];
            setValgtTegningId(valgt.id);
            setValgtBygningId(valgt.byggeplassId ?? valgt.byggeplass?.id ?? null);
            setLokasjonKilde("gps");
            return;
          }
        }
      } catch {
        // GPS feilet stille — fall gjennom til sist brukte
      }

      // Fallback: sist brukte tegning
      if (lagretBygningId) {
        setValgtBygningId(lagretBygningId);
        if (lagretTegningId) setValgtTegningId(lagretTegningId);
        setLokasjonKilde("lagret");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synlig, valgtProsjektId, alleTegninger.length, kontekstBygningId]);

  // Nullstill refs når modal lukkes
  useEffect(() => {
    if (!synlig) {
      harKjørtLokasjon.current = false;
      harAutoOpprettet.current = false;
    }
  }, [synlig]);

  // Forhåndsdefinerte emner fra malen
  const malSubjects = Array.isArray(mal.subjects)
    ? mal.subjects.filter((s) => s.trim() !== "")
    : [];
  const harSubjects = malSubjects.length > 0;

  // Hent prosjektnavn via id (medlemssjekk, IKKE firma-scopet) — resolver
  // uansett firma-valg. Rettet: firma-scopet hentMine ga tom prosjektNavn for
  // fler-firma-brukere → «Prosjekt: Laster…» hang + tom oppgave-tittel.
  const prosjektQuery = trpc.prosjekt.hentMedId.useQuery(
    { id: valgtProsjektId! },
    { enabled: synlig && !!valgtProsjektId },
  );
  const prosjektNavn = (prosjektQuery.data as { name?: string } | undefined)?.name ?? "";

  // Alle faggrupper for navne-oppslag (bestiller/svarer-visning)
  const faggruppeQuery = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const faggrupper = (faggruppeQuery.data ?? []) as FaggruppeData[];

  // Hent dokumentflyter for prosjektet (kun for kandidat-DETALJER: navn + faggrupper)
  const dokumentflytQuery = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const alleDokumentflyter = (dokumentflytQuery.data ?? []) as DokumentflytData[];

  // Flytresolusjon (paritet web `malFlytStatus`): opprettbarheten kommer FRA
  // serveren (`mal.opprettbareFlytIder` — delt regel med opprett-valideringen).
  // Modalen bygger kun kandidat-detaljene, ikke et klient-duplikat av regelen.
  // Bestiller = flytens eier-faggruppe (`df.faggruppeId`); utfører = medlem med
  // rolle="utforer" (match web), fallback eier-faggruppe (intern flyt).
  const flytKandidater = useMemo(() => {
    const dfById = new Map(alleDokumentflyter.map((df) => [df.id, df]));
    const navnFor = (id: string, df: DokumentflytData) =>
      faggrupper.find((f) => f.id === id)?.name ??
      df.medlemmer.find((m) => m.faggruppe?.id === id)?.faggruppe?.name ??
      "";
    return (mal.opprettbareFlytIder ?? [])
      .map((id) => dfById.get(id))
      .filter((df): df is DokumentflytData => !!df && df.faggruppeId != null)
      .map((df) => {
        const utforer = df.medlemmer.find((m) => m.rolle === "utforer");
        const bestillerFaggruppeId = df.faggruppeId!;
        const utforerFaggruppeId = utforer?.faggruppe?.id ?? bestillerFaggruppeId;
        return {
          flytId: df.id,
          flytNavn: df.name,
          bestillerFaggruppeId,
          bestillerNavn: navnFor(bestillerFaggruppeId, df),
          utforerFaggruppeId,
          utforerNavn: utforer?.faggruppe?.name ?? navnFor(utforerFaggruppeId, df),
          erIntern: !utforer,
        };
      });
  }, [alleDokumentflyter, mal.opprettbareFlytIder, faggrupper]);

  // Bestiller-faggrupper = unike eier-faggrupper blant de opprettbare flytene
  const bestillerFaggrupper = useMemo(() => {
    const seen = new Map<string, FaggruppeData>();
    for (const k of flytKandidater) {
      if (!seen.has(k.bestillerFaggruppeId)) {
        seen.set(k.bestillerFaggruppeId, { id: k.bestillerFaggruppeId, name: k.bestillerNavn });
      }
    }
    return [...seen.values()];
  }, [flytKandidater]);

  // Auto-velg bestiller-faggruppe hvis kun én
  useEffect(() => {
    if (bestillerFaggrupper.length === 1 && !oppretterFaggruppeId) {
      setOppretterFaggruppeId(bestillerFaggrupper[0].id);
    }
  }, [bestillerFaggrupper, oppretterFaggruppeId]);

  // Opprettbare flyter for valgt bestiller-faggruppe
  const matchendeKandidater = useMemo(() => {
    if (!oppretterFaggruppeId) return [];
    return flytKandidater.filter((k) => k.bestillerFaggruppeId === oppretterFaggruppeId);
  }, [flytKandidater, oppretterFaggruppeId]);

  // Auto-velg flyt: kun én → koble automatisk
  useEffect(() => {
    if (matchendeKandidater.length === 1) {
      setValgtDokumentflytId(matchendeKandidater[0].flytId);
    } else if (matchendeKandidater.length === 0) {
      setValgtDokumentflytId(null);
    }
  }, [matchendeKandidater]);

  const valgtKandidat = matchendeKandidater.find((k) => k.flytId === valgtDokumentflytId) ?? null;
  const autoSvarerFaggruppeId = valgtKandidat?.utforerFaggruppeId ?? null;
  const autoSvarerNavn = valgtKandidat?.utforerNavn ?? "";

  // Hent bygninger for prosjektet
  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const bygninger = (bygningQuery.data ?? []) as BygningData[];

  // Tegninger filtrert etter valgt bygning (for manuell dropdown)
  const bygningTegninger = useMemo(() => {
    if (!valgtBygningId) return [];
    return alleTegninger.filter((t) => (t.byggeplassId ?? t.byggeplass?.id) === valgtBygningId);
  }, [alleTegninger, valgtBygningId]);

  // Lokasjonsvisning
  const valgtTegning = alleTegninger.find((t) => t.id === valgtTegningId);
  const valgtBygning = valgtTegning?.byggeplass ?? bygninger.find((b) => b.id === valgtBygningId);
  const lokasjonTekst = useMemo(() => {
    const deler: string[] = [];
    if (valgtBygning?.name) deler.push(valgtBygning.name);
    if (valgtTegning) {
      deler.push(valgtTegning.drawingNumber
        ? `${valgtTegning.drawingNumber} ${valgtTegning.name}`
        : valgtTegning.name);
    }
    return deler.join(" · ") || null;
  }, [valgtBygning, valgtTegning]);

  // eslint-disable-next-line
  const opprettSjekkliste = trpc.sjekkliste.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      const resultat = _data as { id: string };
      fullførOpprett(resultat.id);
    },
    onError: (feil: { message?: string }) => {
      Alert.alert(t("feil.tittel"), formaterServerFeil(feil, t("opprettModal.kunneIkkeOpprette")));
    },
  });

  // eslint-disable-next-line
  const opprettOppgave = trpc.oppgave.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      const resultat = _data as { id: string };
      fullførOpprett(resultat.id);
    },
    onError: (feil: { message?: string }) => {
      Alert.alert(t("feil.tittel"), formaterServerFeil(feil, t("opprettModal.kunneIkkeOpprette")));
    },
  });

  const erPending = opprettSjekkliste.isPending || opprettOppgave.isPending;

  const nullstillSkjema = useCallback(() => {
    setEmne("");
    setTittel("");
    setPrioritet("medium");
    setOppretterFaggruppeId(null);
    setValgtDokumentflytId(null);
    setValgtBygningId(null);
    setValgtTegningId(null);
    setLokasjonKilde(null);
    setVisLokasjonListe(false);
    setVisOppretterListe(false);
    setVisDokumentflytListe(false);
    setVisBygningListe(false);
    setVisTegningListe(false);
    setVisEmneListe(false);
  }, []);

  const håndterAvbryt = useCallback(() => {
    nullstillSkjema();
    onLukk();
  }, [nullstillSkjema, onLukk]);

  // Opprett-suksess: naviger DIREKTE. Fabric (newArch) rendrer modalen inline
  // (ingen presentert UIKit-VC → ingen VC/stack-push-kollisjon), og `<Modal>`s
  // `onShow`/`onDismiss` fyrer ikke pålitelig — den gamle P4a-gaten (utsett dismiss
  // til `onShow`) deadlocket når auto-opprett fullførte før presentasjon og
  // etterlot en usynlig touch-fangende modal-host (frysen). Parenten nullstiller
  // `valgtMal` → `synlig=false` → modalen rives ned.
  const fullførOpprett = useCallback(
    (id: string) => {
      nullstillSkjema();
      onOpprettet(id);
    },
    [nullstillSkjema, onOpprettet],
  );

  // Rapportér at modalen er lukket (statistikk/opprydding hos parent).
  const håndterDismiss = useCallback(() => {
    onModalLukket?.();
  }, [onModalLukket]);

  const håndterOpprett = useCallback(() => {
    if (!oppretterFaggruppeId) {
      Alert.alert(t("opprettModal.manglerOppretter"), t("opprettModal.velgOppretterFaggruppe"));
      return;
    }
    if (!valgtKandidat || !autoSvarerFaggruppeId) {
      Alert.alert(
        t("opprettModal.manglerDokumentflyt"),
        t("opprettModal.manglerDokumentflytBeskrivelse"),
      );
      return;
    }

    // F1 (Option B): husk siste tegning per byggeplass i felles kontekst.
    // Skriver IKKE global aktiv byggeplass (settBygning) — det er chip/GPS sin jobb.
    if (valgtBygningId && valgtTegningId) {
      settSistTegning(valgtBygningId, valgtTegningId);
    }

    if (kategori === "sjekkliste") {
      opprettSjekkliste.mutate({
        templateId: mal.id,
        bestillerFaggruppeId: oppretterFaggruppeId,
        utforerFaggruppeId: autoSvarerFaggruppeId,
        dokumentflytId: valgtKandidat.flytId,
        subject: emne.trim() || undefined,
        byggeplassId: valgtBygningId ?? undefined,
        drawingId: valgtTegningId ?? undefined,
        positionX: posisjon?.x,
        positionY: posisjon?.y,
      });
    } else {
      // Oppgave-tittel: fra sjekklistefelt, ellers redigert tittel (default malnavn).
      const oppgaveTittel = erFraSjekkliste && sjekklisteNummer && feltLabel
        ? `Oppgave fra ${sjekklisteNummer}: ${feltLabel}`
        : (tittel.trim() || mal.name);

      opprettOppgave.mutate({
        templateId: mal.id,
        bestillerFaggruppeId: oppretterFaggruppeId,
        utforerFaggruppeId: autoSvarerFaggruppeId,
        dokumentflytId: valgtKandidat.flytId,
        title: oppgaveTittel,
        priority: prioritet,
        checklistId: sjekklisteId || undefined,
        checklistFieldId: sjekklisteFeltId || undefined,
        drawingId: valgtTegningId ?? undefined,
        positionX: posisjon?.x,
        positionY: posisjon?.y,
      });
    }
  }, [
    oppretterFaggruppeId,
    valgtKandidat,
    autoSvarerFaggruppeId,
    kategori,
    mal.id,
    mal.name,
    tittel,
    emne,
    valgtBygningId,
    valgtTegningId,
    settSistTegning,
    prioritet,
    opprettSjekkliste,
    opprettOppgave,
    erFraSjekkliste,
    sjekklisteId,
    sjekklisteFeltId,
    sjekklisteNummer,
    feltLabel,
    posisjon,
  ]);

  const kanOpprett = !!oppretterFaggruppeId && !!valgtKandidat && !erPending;

  // P4a: skip bekreftelses-modalen når konteksten er entydig (faggruppe + flyt +
  // svarer utledet). Da opprettes utkast automatisk → trykk mal → rett i
  // utfyllingen, ingen «Opprett»-bekreftelse. Ved reell flertydighet (≥2
  // faggrupper/flyter) beholdes skjemaet for manuelt valg. Lokasjon (GPS) er
  // best-effort — det som er utledet ved opprett tas med, vi venter ikke.
  const skalAutoOpprett =
    !dokumentflytQuery.isLoading &&
    bestillerFaggrupper.length === 1 &&
    matchendeKandidater.length === 1 &&
    !!autoSvarerFaggruppeId;

  useEffect(() => {
    if (synlig && skalAutoOpprett && kanOpprett && !harAutoOpprettet.current) {
      harAutoOpprettet.current = true;
      håndterOpprett();
    }
  }, [synlig, skalAutoOpprett, kanOpprett, håndterOpprett]);

  // Fullskjerm-spinner (i stedet for skjema-flash) mens konteksten avgjøres eller
  // utkastet opprettes. Kun ambiguøse tilfeller viser det fulle skjemaet.
  const kontekstLaster = dokumentflytQuery.isLoading;
  const visSpinner =
    internSynlig && (kontekstLaster || skalAutoOpprett || erPending);

  // Lukk alle åpne dropdowns
  const lukkAlleDropdowns = () => {
    setVisOppretterListe(false);
    setVisDokumentflytListe(false);
    setVisLokasjonListe(false);
    setVisBygningListe(false);
    setVisTegningListe(false);
    setVisEmneListe(false);
  };

  const valgtOppretter = bestillerFaggrupper.find((e) => e.id === oppretterFaggruppeId);

  // Auto-opprett-path (og mens konteksten avgjøres): IKKE monter en native <Modal>.
  // Ved entydig kontekst opprettes utkastet automatisk (effekten på :543) og vi
  // navigerer rett inn — modalen her ville bare vist en fullskjerm-spinner i 1–2 s
  // FØR den rives ned + navigerer. Nettopp den present-så-dismiss-en av et ANDRE
  // native modal-VC, rett etter at MalVelger-pageSheet dismisser, etterlot en svart,
  // touch-fangende host under Fabric (tredje ledd i samme klasse som a29f89b2 +
  // df86b817 — hver fiks flyttet frysen ett ledd ned; denne fjerner leddet). Auto-
  // create-effekten er gated på `synlig`, ikke på at modalen er montert, så create +
  // navigasjon skjer uansett. Speiler MalVelgers egen `skalAutoVelge → return null`.
  // Den native modalen mountes nå KUN for det flertydige skjemaet (manuelt valg).
  if (synlig && (kontekstLaster || skalAutoOpprett)) return null;

  return (
    <Modal
      visible={internSynlig}
      animationType="slide"
      onRequestClose={onLukk}
      onDismiss={håndterDismiss}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
        {visSpinner ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="text-sm text-gray-500">{t("opprettModal.oppretter")}</Text>
          </View>
        ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        {/* Header */}
        <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
          <Pressable onPress={håndterAvbryt} hitSlop={8}>
            <Text className="text-sm font-medium text-white">{t("handling.avbryt")}</Text>
          </Pressable>
          <Text className="text-sm font-semibold text-white">
            {kategori === "sjekkliste" ? t("sjekklister.opprett") : t("oppgave.ny")}
          </Text>
          <Pressable onPress={håndterOpprett} disabled={!kanOpprett} hitSlop={8}>
            {erPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text
                className={`text-sm font-medium ${kanOpprett ? "text-white" : "text-white/40"}`}
              >
                {t("handling.opprett")}
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {/* 1. Mal-info med prefix-badge */}
          <View className="border-b border-gray-100 bg-gray-50 px-4 py-3">
            <Text className="text-xs font-medium text-gray-500">{t("opprettModal.mal")}</Text>
            <View className="mt-1 flex-row items-center gap-2">
              <Text className="text-sm font-medium text-gray-900">{mal.name}</Text>
              {mal.prefix ? (
                <View className="rounded bg-blue-100 px-2 py-0.5">
                  <Text className="text-xs font-medium text-blue-700">{mal.prefix}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* 2. Prosjekt (read-only, auto fra kontekst) */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="text-xs font-medium text-gray-500">{t("opprettModal.prosjekt")}</Text>
            <Text className="mt-1 text-sm text-gray-800">
              {prosjektNavn || t("handling.laster")}
            </Text>
          </View>

          {/* 2b. Tittel (oppgave) — redigerbar, default malnavn. Løpenummer
              tildeles + vises automatisk etter opprettelse. */}
          {erOppgave && (
            <View className="border-b border-gray-100 px-4 py-3">
              <Text className="mb-1 text-xs font-medium text-gray-500">{t("opprettModal.tittel")}</Text>
              <TextInput
                value={tittel}
                onChangeText={setTittel}
                placeholder={mal.name}
                placeholderTextColor="#9ca3af"
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800"
              />
            </View>
          )}

          {/* 3. Emne — dropdown med forhåndsdefinerte tekster, eller fritekst som fallback */}
          {!erOppgave && (
            <View className="border-b border-gray-100 px-4 py-3">
              <Text className="mb-1 text-xs font-medium text-gray-500">{t("opprettModal.emne")}</Text>
              {harSubjects ? (
                <>
                  <Pressable
                    onPress={() => {
                      lukkAlleDropdowns();
                      setVisEmneListe(!visEmneListe);
                    }}
                    className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
                  >
                    <Text
                      className={`text-sm ${emne ? "text-gray-800" : "text-gray-400"}`}
                    >
                      {emne || t("opprettModal.velgEmne")}
                    </Text>
                    <ChevronDown size={16} color="#9ca3af" />
                  </Pressable>
                  {visEmneListe && (
                    <View className="mt-1 rounded-lg border border-gray-200 bg-white">
                      <Pressable
                        onPress={() => {
                          setEmne("");
                          setVisEmneListe(false);
                        }}
                        className="border-b border-gray-50 px-3 py-2.5"
                      >
                        <Text className="text-sm italic text-gray-400">{t("opprettModal.ingenEmne")}</Text>
                      </Pressable>
                      {malSubjects.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => {
                            setEmne(s);
                            setVisEmneListe(false);
                          }}
                          className={`border-b border-gray-50 px-3 py-2.5 ${emne === s ? "bg-blue-50" : ""}`}
                        >
                          <Text
                            className={`text-sm ${emne === s ? "font-medium text-blue-700" : "text-gray-700"}`}
                          >
                            {s}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <TextInput
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800"
                  placeholder={t("opprettModal.beskrivEmne")}
                  placeholderTextColor="#9ca3af"
                  value={emne}
                  onChangeText={setEmne}
                />
              )}
            </View>
          )}

          {/* Sjekkliste-referanse (kun for oppgave fra sjekkliste) */}
          {erOppgave && erFraSjekkliste && (
            <View className="border-b border-gray-100 bg-blue-50 px-4 py-3">
              <Text className="text-xs font-medium text-blue-600">{t("oppgave.fraSjekkliste")}</Text>
              <Text className="mt-0.5 text-sm text-blue-800">
                {sjekklisteNummer ? `${sjekklisteNummer}: ` : ""}{feltLabel ?? ""}
              </Text>
            </View>
          )}

          {/* 4. Prioritet — skjult i forenklet oppgaveflyt (redigeres i detaljskjerm) */}

          {/* 5. Bestiller-faggruppe (eier-faggruppene i de opprettbare flytene) */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">
              {t("opprettModal.oppretterFaggruppe")} *
            </Text>
            {bestillerFaggrupper.length === 0 && dokumentflytQuery.isLoading ? (
              <View className="flex-row items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <ActivityIndicator size="small" color="#1e40af" />
                <Text className="text-sm text-gray-500">{t("opprettModal.henterDokumentflyt")}</Text>
              </View>
            ) : bestillerFaggrupper.length === 0 ? (
              <Text className="text-sm text-amber-600">{t("opprettModal.ingenDokumentflyt")}</Text>
            ) : bestillerFaggrupper.length === 1 ? (
              <View className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <Text className="text-sm text-gray-800">{bestillerFaggrupper[0].name}</Text>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    lukkAlleDropdowns();
                    setVisOppretterListe(!visOppretterListe);
                  }}
                  className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
                >
                  <Text
                    className={`text-sm ${valgtOppretter ? "text-gray-800" : "text-gray-400"}`}
                  >
                    {valgtOppretter?.name ?? t("opprettModal.velgFaggruppe")}
                  </Text>
                  <ChevronDown size={16} color="#9ca3af" />
                </Pressable>
                {visOppretterListe && (
                  <View className="mt-1 rounded-lg border border-gray-200 bg-white">
                    {bestillerFaggrupper.map((e) => (
                      <Pressable
                        key={e.id}
                        onPress={() => {
                          setOppretterFaggruppeId(e.id);
                          setValgtDokumentflytId(null);
                          setVisOppretterListe(false);
                        }}
                        className={`border-b border-gray-50 px-3 py-2.5 ${oppretterFaggruppeId === e.id ? "bg-blue-50" : ""}`}
                      >
                        <Text
                          className={`text-sm ${oppretterFaggruppeId === e.id ? "font-medium text-blue-700" : "text-gray-700"}`}
                        >
                          {e.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* 6. Dokumentflyt — auto-koblet hvis kun én, ellers dropdown */}
          {oppretterFaggruppeId && (
            <View className="border-b border-gray-100 bg-gray-50 px-4 py-3">
              <Text className="text-xs font-medium text-gray-500">{t("opprettModal.svarerFaggruppe")}</Text>
              {dokumentflytQuery.isLoading ? (
                <View className="mt-1 flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#1e40af" />
                  <Text className="text-sm text-gray-500">{t("opprettModal.henterDokumentflyt")}</Text>
                </View>
              ) : matchendeKandidater.length === 0 ? (
                <Text className="mt-1 text-sm text-amber-600">
                  {t("opprettModal.ingenDokumentflyt")}
                </Text>
              ) : matchendeKandidater.length === 1 ? (
                /* Én flyt — auto-koblet, vis read-only */
                <View className="mt-1 flex-row items-center gap-2">
                  <Text className="text-sm text-gray-800">{autoSvarerNavn}</Text>
                  {valgtKandidat?.erIntern && (
                    <Text className="text-xs text-gray-400">({t("opprettModal.internFlyt")})</Text>
                  )}
                </View>
              ) : (
                /* Flere flyter — vis dropdown */
                <>
                  <Pressable
                    onPress={() => {
                      lukkAlleDropdowns();
                      setVisDokumentflytListe(!visDokumentflytListe);
                    }}
                    className="mt-1 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5"
                  >
                    <Text className={`text-sm ${valgtKandidat ? "text-gray-800" : "text-gray-400"}`}>
                      {valgtKandidat
                        ? `${valgtKandidat.flytNavn} → ${autoSvarerNavn}`
                        : t("opprettModal.velgDokumentflyt")}
                    </Text>
                    <ChevronDown size={16} color="#9ca3af" />
                  </Pressable>
                  {visDokumentflytListe && (
                    <View className="mt-1 rounded-lg border border-gray-200 bg-white">
                      {matchendeKandidater.map((k) => (
                        <Pressable
                          key={k.flytId}
                          onPress={() => {
                            setValgtDokumentflytId(k.flytId);
                            setVisDokumentflytListe(false);
                          }}
                          className={`border-b border-gray-50 px-3 py-2.5 ${valgtDokumentflytId === k.flytId ? "bg-blue-50" : ""}`}
                        >
                          <Text className={`text-sm ${valgtDokumentflytId === k.flytId ? "font-medium text-blue-700" : "text-gray-700"}`}>
                            {k.flytNavn}
                          </Text>
                          <Text className="text-xs text-gray-400">
                            → {k.utforerNavn}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* 7. Lokasjon — auto-valgt fra GPS eller sist brukt, kan byttes manuelt */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">Lokasjon</Text>
            {posisjon ? (
              <View className="flex-row items-center gap-2">
                <MapPin size={14} color="#1e40af" />
                <View className="flex-1">
                  <Text className="text-sm text-gray-800">{lokasjonTekst ?? "Valgt tegning"}</Text>
                  <Text className="text-[10px] text-green-600">Punkt satt på tegning</Text>
                </View>
              </View>
            ) : lokasjonTekst ? (
              <Pressable
                onPress={() => {
                  lukkAlleDropdowns();
                  setVisLokasjonListe(!visLokasjonListe);
                }}
                className="flex-row items-center gap-2"
              >
                <MapPin size={14} color="#6b7280" />
                <View className="flex-1">
                  <Text className="text-sm text-gray-800">{lokasjonTekst}</Text>
                  {lokasjonKilde === "gps" && (
                    <Text className="text-[10px] text-green-600">Auto: GPS-posisjon</Text>
                  )}
                  {lokasjonKilde === "lagret" && (
                    <Text className="text-[10px] text-gray-400">Sist brukte</Text>
                  )}
                </View>
                <ChevronDown size={14} color="#9ca3af" />
              </Pressable>
            ) : alleTegningerQuery.isLoading ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#6b7280" />
                <Text className="text-sm text-gray-400">Henter lokasjon…</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  lukkAlleDropdowns();
                  setVisLokasjonListe(!visLokasjonListe);
                }}
                className="flex-row items-center gap-2"
              >
                <MapPin size={14} color="#9ca3af" />
                <Text className="text-sm text-gray-400">Velg lokasjon…</Text>
                <ChevronDown size={14} color="#9ca3af" />
              </Pressable>
            )}

            {/* Manuell lokasjonsliste: bygning → tegning (skjult når punkt alt er satt) */}
            {!posisjon && visLokasjonListe && (
              <View className="mt-2 rounded-lg border border-gray-200 bg-white">
                {/* Bygningsvalg */}
                {bygninger.map((b) => (
                  <View key={b.id}>
                    <Pressable
                      onPress={() => {
                        if (valgtBygningId === b.id) {
                          setValgtBygningId(null);
                          setValgtTegningId(null);
                        } else {
                          setValgtBygningId(b.id);
                          setValgtTegningId(null);
                        }
                        setLokasjonKilde("manuell");
                      }}
                      className={`border-b border-gray-50 px-3 py-2.5 ${valgtBygningId === b.id ? "bg-blue-50" : ""}`}
                    >
                      <Text className={`text-sm font-medium ${valgtBygningId === b.id ? "text-blue-700" : "text-gray-700"}`}>
                        {b.name}
                      </Text>
                    </Pressable>
                    {/* Tegninger under valgt bygning */}
                    {valgtBygningId === b.id && bygningTegninger.length > 0 && (
                      <View className="bg-gray-50">
                        {bygningTegninger.map((t) => (
                          <Pressable
                            key={t.id}
                            onPress={() => {
                              setValgtTegningId(t.id);
                              setLokasjonKilde("manuell");
                              setVisLokasjonListe(false);
                            }}
                            className={`border-b border-gray-100 px-6 py-2 ${valgtTegningId === t.id ? "bg-blue-50" : ""}`}
                          >
                            <Text className={`text-sm ${valgtTegningId === t.id ? "font-medium text-blue-700" : "text-gray-600"}`}>
                              {t.drawingNumber ? `${t.drawingNumber} ${t.name}` : t.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                {/* Fjern lokasjon */}
                {(valgtBygningId || valgtTegningId) && (
                  <Pressable
                    onPress={() => {
                      setValgtBygningId(null);
                      setValgtTegningId(null);
                      setLokasjonKilde(null);
                      setVisLokasjonListe(false);
                    }}
                    className="px-3 py-2.5"
                  >
                    <Text className="text-sm italic text-gray-400">Fjern lokasjon</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
