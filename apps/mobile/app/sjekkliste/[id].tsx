import { useCallback, useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Save, Check, AlertTriangle, Clock, CloudOff, Cloud, Trash2, ChevronDown, Share2, MapPin } from "lucide-react-native";
import { harBetingelse, harForelderObjekt, utledMinRolle, byggPosisjonsLedd, harBallenPosisjon, erAvsenderledd, erMedlemAvFlyt, retningsrettigheter, harMinstEttUtfyltFelt } from "@sitedoc/shared";
import type { FlytMedlemInfo, HarBallenDokument } from "@sitedoc/shared";
import { useTranslation } from "react-i18next";
import { Flytlinje } from "../../src/components/Flytlinje";
import type { FlytMedlem } from "../../src/components/Flytlinje";
import { DokumentHandlingslinje } from "../../src/components/DokumentHandlingslinje";
import { useSjekklisteSkjema } from "../../src/hooks/useSjekklisteSkjema";
import { useAutoVaer } from "../../src/hooks/useAutoVaer";
import { useOversettelse } from "../../src/hooks/useOversettelse";
import { useOpplastingsKo } from "../../src/providers/OpplastingsKoProvider";
import { useAuth } from "../../src/providers/AuthProvider";
import { useNettverk } from "../../src/providers/NettverkProvider";
import { StatusMerkelapp } from "../../src/components/StatusMerkelapp";
import { RapportObjektRenderer, DISPLAY_TYPER, UtfyllingSeksjoner } from "../../src/components/rapportobjekter";
import { FeltWrapper } from "../../src/components/rapportobjekter/FeltWrapper";
import { MalVelger } from "../../src/components/MalVelger";
import { OpprettDokumentModal } from "../../src/components/OpprettDokumentModal";
import { trpc } from "../../src/lib/trpc";
import { flytFaggruppeIder } from "../../src/lib/flyt-faggrupper";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { hentDatabase } from "../../src/db/database";
import { sjekklisteFeltdata, opplastingsKo } from "../../src/db/schema";
import { ekspanderEndring, byggKolonnerPerFelt, segmenterTilTekst } from "@sitedoc/pdf";
import { byggObjektTre } from "@sitedoc/shared";
import { TegningsVisning } from "../../src/components/TegningsVisning";
import type { Markør } from "../../src/components/TegningsVisning";
import { AUTH_CONFIG } from "../../src/config/auth";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { eq } from "drizzle-orm";

interface Transfer {
  id: string;
  fromStatus: string;
  toStatus: string;
  comment: string | null;
  createdAt: Date | string;
  sender?: { id: string; name: string | null } | null;
  recipientUser?: { id: string; name: string | null } | null;
  recipientGroup?: { id: string; name: string | null } | null;
}

interface EndringsloggRad {
  id: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date | string;
  user: { id: string; name: string | null; email: string };
}

function formaterHistorikkDato(dato: Date | string): string {
  const d = new Date(dato);
  return d.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formaterKlokke(dato: Date): string {
  return dato.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

interface MalData {
  id: string;
  name: string;
  prefix: string | null;
  category: string;
}

interface SjekklisteOppgave {
  id: string;
  number: number | null;
  checklistFieldId: string | null;
  title: string;
  status: string;
  template: { prefix: string | null } | null;
}

export default function SjekklisteUtfylling() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bruker } = useAuth();
  const { valgtProsjektId } = useProsjekt();
  const { erPaaNettet } = useNettverk();
  const utils = trpc.useUtils();

  const [visFaggruppeListe, settVisFaggruppeListe] = useState<"oppretter" | "svarer" | null>(null);
  // Arkiv-PDF (server-generert, ENESTE vei fra 2026-08-23 — mobil bygger ikke HTML lokalt lenger).
  // Mangel-kontrakten speiler web (renderTimeout + manglendeVedlegg). Fase 3: den lokale
  // expo-print-veien (byggSjekklisteHtml) er fjernet — telefonen må uansett være på nett for
  // å hente bilder/tegninger til en PDF.
  const [arkivMelding, settArkivMelding] = useState<{ type: "feil" | "advarsel"; tekst: string } | null>(null);
  const [visLokasjonModal, setVisLokasjonModal] = useState(false);
  const [visLokByttTegning, setVisLokByttTegning] = useState(false);
  const [lokTempPosX, setLokTempPosX] = useState<number | null>(null);
  const [lokTempPosY, setLokTempPosY] = useState<number | null>(null);
  const [lokTempTegningId, setLokTempTegningId] = useState<string | null>(null);
  const [lokTempBygningId, setLokTempBygningId] = useState<string | null>(null);

  // State for oppgave-fra-felt
  const [opprettOppgaveKategori, setOpprettOppgaveKategori] = useState<"oppgave" | null>(null);
  const [opprettOppgaveFeltId, setOpprettOppgaveFeltId] = useState<string | null>(null);
  const [opprettOppgaveFeltLabel, setOpprettOppgaveFeltLabel] = useState<string | null>(null);
  const [valgtOppgaveMal, setValgtOppgaveMal] = useState<MalData | null>(null);
  // Forhåndsposisjon for rad-oppgaver: radens drawing_position ?? dokumentets lokasjon. Modalen
  // krever fullt punkt (drawingId + x + y) → null når det mangler.
  const [opprettOppgavePosisjon, setOpprettOppgavePosisjon] = useState<
    { drawingId: string; byggeplassId: string | null; x: number; y: number } | null
  >(null);

  // Hent overføringer for historikk
  const detaljQuery = trpc.sjekkliste.hentMedId.useQuery(
    { id: id! },
    { enabled: !!id },
  );
  const sjekklisteDetalj = detaljQuery.data as {
    number?: number | null;
    transfers?: Transfer[];
    template?: { enableChangeLog?: boolean };
    changeLog?: EndringsloggRad[];
    drawing?: { id: string; name: string; drawingNumber?: string | null; fileUrl?: string | null; imageWidth?: number | null; imageHeight?: number | null } | null;
    drawingId?: string | null;
    positionX?: number | null;
    positionY?: number | null;
    byggeplass?: { id: string; name: string } | null;
    bestiller?: { name?: string | null } | null;
    creator?: { name?: string | null } | null;
    createdAt?: string;
  } | undefined;
  const overforinger = sjekklisteDetalj?.transfers;
  const sjekklisteNummer = sjekklisteDetalj?.number;

  // Hent oppgaver knyttet til denne sjekklisten
  const oppgaverQuery = trpc.oppgave.hentForSjekkliste.useQuery(
    { checklistId: id! },
    { enabled: !!id },
  );
  const sjekklisteOppgaver = (oppgaverQuery.data ?? []) as SjekklisteOppgave[];

  // Mapping: feltId/rad-nøkkel → oppgaver (C: LISTE, ikke én — datamodellen tillater flere på samme
  // rad; `map.set` gjorde før at siste vant og resten forsvant i stillhet). Sortert på nummer.
  const feltOppgaveMap = useMemo(() => {
    const map = new Map<string, SjekklisteOppgave[]>();
    for (const oppgave of sjekklisteOppgaver) {
      if (oppgave.checklistFieldId) {
        const liste = map.get(oppgave.checklistFieldId) ?? [];
        liste.push(oppgave);
        map.set(oppgave.checklistFieldId, liste);
      }
    }
    for (const liste of map.values()) liste.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    return map;
  }, [sjekklisteOppgaver]);

  // H5-paritet (2026-08-23): kolonne-labels for repeater-diff i endringsloggen — brukes av
  // ekspanderEndring (delt @sitedoc/pdf), samme som web + arkiv-PDF.
  const kolonnerPerFelt = useMemo(() => {
    const objs = ((sjekklisteDetalj as unknown as { template?: { objects?: unknown[] } })?.template?.objects ?? []) as {
      id: string;
      parentId?: string | null;
      sortOrder: number;
    }[];
    return byggKolonnerPerFelt(byggObjektTre(objs) as unknown as Parameters<typeof byggKolonnerPerFelt>[0]);
  }, [sjekklisteDetalj]);

  const { ventende, erAktiv } = useOpplastingsKo();

  // Bygninger og tegninger for lokasjonsvelger
  const bygningerQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const bygninger = (bygningerQuery.data ?? []) as Array<{ id: string; name: string }>;

  const alleTegningerQuery = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const alleTegninger = (alleTegningerQuery.data ?? []) as unknown as Array<{
    id: string; name: string; drawingNumber: string | null;
    fileUrl: string; fileType: string;
    byggeplassId: string | null; byggeplass: { id: string; name: string } | null;
    geoReference?: unknown | null;
  }>;

  // Tegninger/kart å plassere posisjon på — må ha fil. Georeferert tegning
  // (`geoReference`) fungerer som «kart» (kan være et georeferert kartutsnitt).
  const tilgjengeligeTegninger = useMemo(
    () => alleTegninger.filter((t) => t.fileUrl),
    [alleTegninger],
  );

  // Lokasjonsinformasjon fra sjekklisteDetalj
  const lokBygningNavn = sjekklisteDetalj?.byggeplass?.name;
  const lokTegningNavn = sjekklisteDetalj?.drawing
    ? (sjekklisteDetalj.drawing.drawingNumber
      ? `${sjekklisteDetalj.drawing.drawingNumber} ${sjekklisteDetalj.drawing.name}`
      : sjekklisteDetalj.drawing.name)
    : null;
  const lokasjonTekst = [lokBygningNavn, lokTegningNavn].filter(Boolean).join(" · ") || null;

  // Hent faggrupper for redigering
  const { data: mineFaggrupper } = trpc.medlem.hentMineFaggrupper.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const { data: alleFaggrupper } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  // Flytdata for ny handlingsmeny
  const { data: minFlytInfo } = trpc.gruppe.hentMinFlytInfo.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const { data: dokumentflyterRå } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const { data: tilgjengeligeFlyter } = trpc.sjekkliste.hentTilgjengeligeFlyter.useQuery(
    { id: id! },
    { enabled: !!id },
  );

  const { data: mineTillatelserRå } = trpc.gruppe.hentMineTillatelser.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const mineTillatelser = useMemo(
    () => new Set<string>(mineTillatelserRå ?? []),
    [mineTillatelserRå],
  );

  const flytMedlemmer = useMemo((): FlytMedlem[] => {
    const sj = sjekklisteDetalj as unknown as { dokumentflytId?: string | null };
    if (!sj?.dokumentflytId || !dokumentflyterRå) return [];
    const rå = dokumentflyterRå as unknown as Array<{ id: string; medlemmer: FlytMedlem[] }>;
    const flyt = rå.find((df) => df.id === sj.dokumentflytId);
    return flyt?.medlemmer ?? [];
  }, [sjekklisteDetalj, dokumentflyterRå]);

  // 4b (dokumentflyten er nøkkelen): faggruppene `company`-feltet (FirmaObjekt) får tilby.
  // Inline kall (IKKE useMemo med de dype tRPC-typene i deps — tipper TS2589).
  const tillatteFaggruppeIder = flytFaggruppeIder(
    (sjekklisteDetalj as unknown as { dokumentflytId?: string | null })?.dokumentflytId,
    dokumentflyterRå,
  );

  const minRolle = useMemo(() => {
    if (!minFlytInfo || !sjekklisteDetalj) return undefined;
    const sj = sjekklisteDetalj as unknown as { dokumentflytId?: string | null; bestillerFaggruppe?: { id: string }; utforerFaggruppe?: { id: string } };
    if (!sj.dokumentflytId) return undefined;
    const dokumentflyter = (dokumentflyterRå ?? []) as unknown as Array<{
      id: string;
      medlemmer: Array<{ rolle: string; faggruppeId?: string | null; projectMemberId?: string | null; groupId?: string | null }>;
    }>;
    const flyt = dokumentflyter.find((df) => df.id === sj.dokumentflytId);
    if (!flyt) return null;
    const medlemmer = flyt.medlemmer.map((m): FlytMedlemInfo => ({
      rolle: m.rolle, faggruppeId: m.faggruppeId ?? null,
      projectMemberId: m.projectMemberId ?? null, groupId: m.groupId ?? null,
    }));
    return utledMinRolle(
      { ...minFlytInfo, userId: "", erAdmin: (minFlytInfo.adminNiva !== null) },
      medlemmer,
      { bestillerFaggruppeId: sj.bestillerFaggruppe?.id ?? "", utforerFaggruppeId: sj.utforerFaggruppe?.id ?? "" },
    );
  }, [minFlytInfo, sjekklisteDetalj, dokumentflyterRå]);

  // Steg 3+4b (Fase 4): POSISJON-baserte rettigheter (harBallen + erAvsender + erMedlemAvFlyt + retningsrett).
  const posisjonRett = useMemo(() => {
    const tom = {
      harBallen: false, erAvsender: false, erMedlemAvFlyt: false,
      retningsrett: { kanSende: false, kanBesvare: false, kanVideresende: false, kanTerminere: false },
    };
    const aktivPosisjon = (sjekklisteDetalj as { aktivPosisjon?: number | null } | undefined)?.aktivPosisjon;
    if (!minFlytInfo || aktivPosisjon == null) return tom;
    const ledd = byggPosisjonsLedd(
      flytMedlemmer.map((m) => ({
        steg: m.steg,
        klassifisering: m.klassifisering ?? null,
        kanTerminereUtenBall: m.kanTerminereUtenBall ?? false,
        erHovedansvarlig: m.erHovedansvarlig ?? false,
        brukerId: m.projectMember?.user?.id ?? null,
        gruppeId: m.group?.id ?? null,
        faggruppeId: m.faggruppe?.id ?? null,
      })),
    );
    const bruker = {
      userId: minFlytInfo.userId,
      gruppeIder: minFlytInfo.gruppeIder,
      faggruppeIder: (minFlytInfo as { faggruppeIder?: string[] }).faggruppeIder ?? [],
      erAdmin: (minFlytInfo.adminNiva !== null),
    };
    const erMedlemAv = (l: (typeof ledd)[number]): boolean =>
      l.brukerIder.has(bruker.userId) ||
      bruker.gruppeIder.some((g) => l.gruppeIder.has(g)) ||
      bruker.faggruppeIder.some((f) => l.faggruppeIder.has(f));
    const harBallen = harBallenPosisjon(ledd, aktivPosisjon, bruker);
    const seerLedd = ledd.find((l) => erMedlemAv(l) && l.kanTerminereUtenBall) ?? ledd.find(erMedlemAv) ?? null;
    return {
      harBallen,
      erAvsender: erAvsenderledd(ledd, aktivPosisjon, bruker),
      erMedlemAvFlyt: erMedlemAvFlyt(ledd, bruker),
      retningsrett: retningsrettigheter({ harBallen, seerLedd, kanVideresende: (minFlytInfo.adminNiva !== null) }),
    };
  }, [sjekklisteDetalj, minFlytInfo, flytMedlemmer]);
  const harBallen = posisjonRett.harBallen;

  const flytRettighet = useMemo((): "redigerer" | "leser" | undefined => {
    if (!minFlytInfo || !sjekklisteDetalj || !dokumentflyterRå) return undefined;
    const sj = sjekklisteDetalj as unknown as { dokumentflytId?: string | null };
    if (!sj.dokumentflytId) return undefined;
    const rå = dokumentflyterRå as unknown as Array<{
      id: string;
      medlemmer: Array<{
        kanRedigere: boolean;
        faggruppeId?: string | null;
        projectMemberId?: string | null;
        groupId?: string | null;
      }>;
    }>;
    const flyt = rå.find((df) => df.id === sj.dokumentflytId);
    if (!flyt) return undefined;
    const fi = minFlytInfo as { projectMemberId: string; gruppeIder: string[] };
    for (const m of flyt.medlemmer) {
      if (m.projectMemberId && m.projectMemberId === fi.projectMemberId) return m.kanRedigere ? "redigerer" : "leser";
      if (m.groupId && fi.gruppeIder.includes(m.groupId)) return m.kanRedigere ? "redigerer" : "leser";
    }
    return undefined;
  }, [minFlytInfo, sjekklisteDetalj, dokumentflyterRå]);

  const rettighetInput = useMemo(() => {
    if (!minFlytInfo) return undefined;
    return {
      erAdmin: (minFlytInfo.adminNiva !== null),
      minRolle,
      tillatelser: mineTillatelser,
      harBallen,
      flytRettighet,
    };
  }, [minFlytInfo, minRolle, mineTillatelser, harBallen, flytRettighet]);

  const oppdaterMutasjon = trpc.sjekkliste.oppdater.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentMedId.invalidate({ id: id! });
    },
  });

  const endreStatusMutasjon = trpc.sjekkliste.endreStatus.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentMedId.invalidate({ id: id! });
      utils.sjekkliste.hentForProsjekt.invalidate();
    },
  });

  const slettMutasjon = trpc.sjekkliste.slett.useMutation({
    onSuccess: () => {
      // Rydd opp lokal SQLite-data
      const db = hentDatabase();
      if (db && id) {
        try {
          db.delete(sjekklisteFeltdata).where(eq(sjekklisteFeltdata.sjekklisteId, id)).run();
          db.delete(opplastingsKo).where(eq(opplastingsKo.sjekklisteId, id)).run();
        } catch {
          // Ignorer SQLite-feil ved opprydding
        }
      }
      utils.sjekkliste.hentForProsjekt.invalidate();
      // Funn A: HMS-lista (`hms.hentDokumenter`) er en egen query som ikke fanges
      // av sjekkliste-invalideringene — uten denne henger en slettet/forkastet
      // SJA igjen i HMS-fanen til manuell refresh.
      utils.hms.hentDokumenter.invalidate();
      router.back();
    },
    onError: (feil: { message?: string }) => {
      Alert.alert(t("feil.kunneIkkeSlett"), feil.message || t("feil.ukjentFeil"));
    },
  });

  const håndterSlett = useCallback(() => {
    Alert.alert(
      t("sjekkliste.slettSjekkliste"),
      t("bekreft.slettSjekkliste"),
      [
        { text: t("handling.avbryt"), style: "cancel" },
        {
          text: t("handling.slett"),
          style: "destructive",
          onPress: () => slettMutasjon.mutate({ id: id! }),
        },
      ],
    );
  }, [id, slettMutasjon]);

  // Funn B: HMS-melder forkaster sitt eget utkast — egen mikrotekst (ingen har
  // sett det, det legges i papirkurven), ikke den generelle «Slett sjekkliste»-
  // advarselen. Samme (myke) slett-mutasjon; kun dialogteksten skiller.
  const håndterForkast = useCallback(() => {
    Alert.alert(
      t("hms.forkast.tittel"),
      t("hms.forkast.bekreft"),
      [
        { text: t("handling.avbryt"), style: "cancel" },
        {
          text: t("hms.handling.forkast"),
          style: "destructive",
          onPress: () => slettMutasjon.mutate({ id: id! }),
        },
      ],
    );
  }, [id, slettMutasjon]);

  // Spor 2 / 5a: Send inn HMS-utkast (mobil oppretter SJA via sjekkliste.opprett → draft).
  const hmsSendInnMutasjon = trpc.sjekkliste.hmsSendInn.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentMedId.invalidate({ id: id! });
      utils.sjekkliste.hentForProsjekt.invalidate();
      // Funn A: etter Send inn flytter dokumentet status (draft → received) i
      // HMS-fanen — invalidér HMS-lista så det oppdateres uten manuell refresh.
      utils.hms.hentDokumenter.invalidate();
    },
    onError: (feil: { message?: string }) => {
      Alert.alert(t("feil.ukjentFeil"), feil.message ?? "");
    },
  });



  const {
    sjekkliste,
    erLaster,
    hentFeltVerdi,
    settVerdi,
    settKommentar,
    leggTilVedlegg,
    fjernVedlegg,
    erstattVedlegg,
    flyttVedlegg,
    erSynlig,
    valideringsfeil,
    lagre,
    harEndringer,
    erRedigerbar,
    lagreStatus,
    synkStatus,
  } = useSjekklisteSkjema(id!, rettighetInput);

  // On-demand oversettelse av firmainnhold
  const prosjektKildesprak = (sjekklisteDetalj?.template as unknown as { project?: { sourceLanguage?: string } })?.project?.sourceLanguage;
  const {
    oversettelser,
    laster: oversettelseLaster,
    visOversettKnapp,
    oversettFelt,
  } = useOversettelse(
    valgtProsjektId ?? undefined,
    prosjektKildesprak,
    sjekkliste?.template?.objects ?? [],
  );

  // Auto-hent værdata basert på dato og prosjektlokasjon
  useAutoVaer({
    prosjektId: valgtProsjektId,
    alleObjekter: sjekkliste?.template?.objects ?? [],
    hentFeltVerdi,
    settVerdi,
  });

  // P2 (tom-besvarelse): speiler server-guarden. Offline-first → beregnes fra lokal
  // svar-tilstand (samme delte helper som web + server). Deaktiverer Besvar til minst
  // ett svar-felt er utfylt (fyll → Lagre → Besvar).
  const besvarDeaktivertGrunn = useMemo(() => {
    const objs = (sjekkliste?.template?.objects ?? []) as { id: string; type: string }[];
    const data = Object.fromEntries(objs.map((o) => [o.id, hentFeltVerdi(o.id)]));
    return harMinstEttUtfyltFelt(objs, data) ? null : t("statushandling.laast.tomBesvarelse");
  }, [sjekkliste?.template?.objects, hentFeltVerdi, t]);

  // --- Arkiv-PDF (ENESTE vei fra 2026-08-23) ----------------------------
  // Server rendrer samme arkiv-PDF som web (`arkiv.rendr`). Auth via Bearer-token
  // på tRPC-klienten. PDF-en kommer som base64 → skrives til fil → deles via
  // `expo-sharing`. Ingen lokal HTML-bygging lenger (telefonen må være på nett for
  // å hente bilder/tegninger uansett).
  const rendrArkiv = trpc.arkiv.rendr.useMutation({
    onSuccess: async (res: {
      pdfBase64: string;
      filnavn: string;
      komplett: boolean;
      renderTimeout: boolean;
      dokumenter: { manglendeVedlegg: string[] }[];
    }) => {
      try {
        const filsti = `${FileSystem.cacheDirectory}${res.filnavn}`;
        await FileSystem.writeAsStringAsync(filsti, res.pdfBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(filsti, {
          mimeType: "application/pdf",
          dialogTitle: `Del ${sjekkliste?.title ?? "sjekkliste"}`,
          UTI: "com.adobe.pdf",
        });
      } catch (feil) {
        console.warn("Arkiv-PDF-deling feilet:", feil);
      }
      // Mangel-kontrakt (speiler web): timeout ≠ mangel. Ikke-blokkerende, inline.
      const antallMangler = res.dokumenter[0]?.manglendeVedlegg.length ?? 0;
      if (res.renderTimeout) {
        settArkivMelding({ type: "advarsel", tekst: t("arkiv.advarselTimeout") });
      } else if (antallMangler > 0) {
        settArkivMelding({ type: "advarsel", tekst: t("arkiv.advarselMangler", { antall: antallMangler }) });
      } else {
        settArkivMelding(null);
      }
    },
    onError: (error: { message?: string }) => {
      settArkivMelding({ type: "feil", tekst: error.message ?? t("arkiv.feil") });
    },
  });

  const håndterArkivPdf = useCallback(() => {
    if (!id) return;
    // Uten nett: si tydelig at PDF krever tilkobling, ikke feil stille.
    if (!erPaaNettet) {
      settArkivMelding({ type: "advarsel", tekst: t("arkiv.kreverTilkobling") });
      return;
    }
    settArkivMelding(null);
    rendrArkiv.mutate({ dokumenter: [{ id, type: "sjekkliste" }] });
  }, [id, erPaaNettet, rendrArkiv, t]);

  // Påkrevd-felt-teller (M2): live antall gjenstående påkrevde synlige felt. Deaktiverer
  // framover-primær (Send/Besvar) + caption. Read-only speiling av `valider()` — muterer ikke.
  const paakrevdeFeltGjenstaar = useMemo(() => {
    const objs = (sjekkliste?.template?.objects ?? []) as { id: string; type: string; required?: boolean }[];
    let n = 0;
    for (const o of objs) {
      if (DISPLAY_TYPER.has(o.type)) continue;
      if (!o.required) continue;
      if (!erSynlig(o as Parameters<typeof erSynlig>[0])) continue;
      const v = hentFeltVerdi(o.id).verdi;
      if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) n++;
    }
    return n;
  }, [sjekkliste?.template?.objects, erSynlig, hentFeltVerdi]);

  // Autolagret-mikrotekst (M2): stemple tidspunkt når en lokal lagring fullfører.
  const [sisteLagretTid, settSisteLagretTid] = useState<Date | null>(null);
  useEffect(() => {
    if (lagreStatus === "lagret") settSisteLagretTid(new Date());
  }, [lagreStatus]);
  const sisteLagretTekst = useMemo(
    () => (sisteLagretTid ? t("dokument.lagretAutomatisk", { tid: formaterKlokke(sisteLagretTid) }) : null),
    [sisteLagretTid, t],
  );

  const håndterTilbake = useCallback(async () => {
    if (harEndringer) {
      await lagre();
    }
    router.back();
  }, [harEndringer, lagre, router]);

  // «Lagre og lukk» (M2): lagrer og navigerer tilbake. Validerer ALDRI — utkast skal
  // kunne være ufullstendige (fabel 2026-07-30). Autolagring har allerede persistert.
  const håndterLagreOgLukk = useCallback(async () => {
    await lagre();
    router.back();
  }, [lagre, router]);

  // Beregn objekter og repeater-logikk FØR tidlige returns (hooks må alltid kjøres)
  const objekter = useMemo(() =>
    (sjekkliste?.template?.objects ?? []).slice().sort((a, b) => {
      // Sorter topptekst-objekter først, deretter datafelter, så sortOrder innenfor sone
      const zoneA = (a.config as Record<string, unknown>)?.zone === "topptekst" ? 0 : 1;
      const zoneB = (b.config as Record<string, unknown>)?.zone === "topptekst" ? 0 : 1;
      if (zoneA !== zoneB) return zoneA - zoneB;
      return a.sortOrder - b.sortOrder;
    }),
  [sjekkliste]);
  const repeaterIder = useMemo(() => new Set(
    objekter.filter((o) => o.type === "repeater").map((o) => o.id),
  ), [objekter]);
  const repeaterBarnIder = useMemo(() => new Set(
    objekter.filter((o) => o.parentId && repeaterIder.has(o.parentId)).map((o) => o.id),
  ), [objekter, repeaterIder]);
  const barneObjekterMap = useMemo(() => {
    const m = new Map<string, typeof objekter>();
    for (const obj of objekter) {
      if (obj.parentId && repeaterIder.has(obj.parentId)) {
        const liste = m.get(obj.parentId) ?? [];
        liste.push(obj);
        m.set(obj.parentId, liste);
      }
    }
    return m;
  }, [objekter, repeaterIder]);

  if (erLaster) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1e40af" />
        <Text className="mt-3 text-sm text-gray-500">{t("sjekkliste.henter")}</Text>
      </SafeAreaView>
    );
  }

  if (!sjekkliste) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-base text-gray-500">{t("sjekkliste.ikkeFunnet")}</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-blue-600">{t("dokument.gaaTilbake")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Spor 2 / 5a + Beslutning 1 (Blokk 10): HMS-melder redigerer sitt eget dokument når ballen
  // ligger hos melder-leddet (Ledd 1) og saken ikke er terminal — utkast (draft) ELLER etter
  // Returner (responded). Behandler er read-only på melderens felt (5c). Speiler web-detaljen.
  const erHms = (sjekklisteDetalj as { template?: { domain?: string } } | undefined)?.template?.domain === "hms";
  const bestillerUserId = (sjekklisteDetalj as { bestillerUserId?: string } | undefined)?.bestillerUserId;
  const erMelder = !!bestillerUserId && bestillerUserId === bruker?.id;
  const hmsAktivPosisjon = (sjekklisteDetalj as { aktivPosisjon?: number | null } | undefined)?.aktivPosisjon;
  const erTerminalHms = ["closed", "approved", "cancelled", "rejected"].includes(sjekkliste.status);
  const ballHosMelder =
    !erTerminalHms &&
    (sjekkliste.status === "draft" ||
      hmsAktivPosisjon === 1 ||
      (hmsAktivPosisjon == null && sjekkliste.status === "responded"));
  const leseModus = erHms ? !(erMelder && ballHosMelder) : !erRedigerbar;

  return (
    <SafeAreaView className="flex-1 bg-gray-100" edges={["top"]}>
      {/* Header */}
      <View className="bg-sitedoc-blue">
        <View className="flex-row items-center px-4 py-3">
          <Pressable onPress={håndterTilbake} hitSlop={12}>
            <ArrowLeft size={22} color="#ffffff" />
          </Pressable>
          <View className="flex-1 px-3">
            <View className="flex-row items-center gap-2">
              {sjekkliste.template?.prefix && sjekklisteNummer != null && (
                <Text className="text-xs font-bold text-white/70">{sjekkliste.template.prefix}{sjekklisteNummer}</Text>
              )}
              <Text className="flex-1 text-sm font-semibold text-white" numberOfLines={1}>
                {sjekkliste.title}
              </Text>
            </View>
            {sjekklisteDetalj?.createdAt && (
              <Text className="text-[10px] text-white/50">
                {new Date(sjekklisteDetalj.createdAt).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </Text>
            )}
          </View>
          <View className="flex-row items-center gap-1.5">
            {erRedigerbar && (
              <>
                {ventende > 0 && (
                  <View className="flex-row items-center gap-1">
                    <ActivityIndicator size="small" color="#fbbf24" />
                    <Text className="text-[10px] text-yellow-200">{ventende}</Text>
                  </View>
                )}
                {synkStatus === "synkroniserer" && <ActivityIndicator size="small" color="#93c5fd" />}
                {synkStatus === "lokalt_lagret" && ventende === 0 && <CloudOff size={14} color="#fbbf24" />}
                {synkStatus === "synkronisert" && ventende === 0 && lagreStatus === "idle" && <Cloud size={14} color="#86efac" />}
                {lagreStatus === "lagrer" && <ActivityIndicator size="small" color="#93c5fd" />}
                {lagreStatus === "lagret" && <Check size={16} color="#86efac" />}
                {lagreStatus === "feil" && <AlertTriangle size={16} color="#fca5a5" />}
              </>
            )}
            {/* Server-generert arkiv-PDF (samme motor som web) — eneste vei. Offline:
                CloudOff-ikon signaliserer FØR tap at PDF krever nett; tap forklarer
                med full mikrotekst (arkiv.kreverTilkobling). */}
            <Pressable
              onPress={håndterArkivPdf}
              hitSlop={12}
              disabled={rendrArkiv.isPending}
              accessibilityLabel={erPaaNettet ? t("handling.lastNedArkivPdf") : t("arkiv.kreverTilkobling")}
            >
              {rendrArkiv.isPending
                ? <ActivityIndicator size="small" color="#ffffff" />
                : !erPaaNettet
                  ? <CloudOff size={18} color="#fbbf24" />
                  : <Share2 size={18} color="#ffffff" />}
            </Pressable>
            <StatusMerkelapp status={sjekkliste.status} />
            {(() => {
              const recipientGroup = (sjekklisteDetalj as { recipientGroup?: { id: string; name: string | null } | null } | undefined)?.recipientGroup;
              if (!["sent", "received", "in_progress"].includes(sjekkliste.status)) return null;
              if (!recipientGroup?.name) return null;
              return (
                // Runde-2 (R5): seer-relativ «Venter på deg» / «Venter på: {navn}» (web-paritet).
                <View className="rounded bg-amber-50 px-1.5 py-0.5">
                  <Text className="text-xs font-medium text-amber-700">
                    {harBallen ? t("tabell.venterPaaDeg") : `${t("tabell.venterPaa")}: ${recipientGroup.name}`}
                  </Text>
                </View>
              );
            })()}
          </View>
        </View>
        {/* Steg 5: skjul flytlinje for HMS (paritet med web — HMS er eget løp, ikke posisjonsflyt). */}
        {(sjekklisteDetalj as { template?: { domain?: string } } | undefined)?.template?.domain !== "hms" && flytMedlemmer.length > 0 && (
          <Flytlinje
            medlemmer={flytMedlemmer}
            aktivPosisjon={(sjekklisteDetalj as { aktivPosisjon?: number | null } | undefined)?.aktivPosisjon}
            harBallen={harBallen}
            meg={{ userId: minFlytInfo?.userId, gruppeIder: minFlytInfo?.gruppeIder }}
            overforinger={overforinger}
            flytNavn={(tilgjengeligeFlyter as { gjeldende?: { name?: string | null } | null } | null | undefined)?.gjeldende?.name ?? null}
            formaterTid={formaterHistorikkDato}
          />
        )}
      </View>

      {/* Arkiv-PDF-melding: inline, ikke-blokkerende (ingen toast). Trykk for å lukke. */}
      {arkivMelding && (
        <Pressable
          onPress={() => settArkivMelding(null)}
          className={`px-3 py-2 ${arkivMelding.type === "feil" ? "bg-red-50" : "bg-amber-50"}`}
        >
          <Text className={`text-xs ${arkivMelding.type === "feil" ? "text-red-700" : "text-amber-700"}`}>
            {arkivMelding.tekst}
          </Text>
        </Pressable>
      )}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >

      {/* Felter */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 p-3 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        {/* Lokasjonsvelger — trykk for å åpne tegningsvisning */}
        <Pressable
          onPress={() => {
            if (leseModus) return;
            // Initialiser temp-state fra nåværende lokasjon
            const harLagretTegning = !!sjekklisteDetalj?.drawingId;
            setLokTempTegningId(sjekklisteDetalj?.drawingId ?? null);
            setLokTempBygningId(sjekklisteDetalj?.byggeplass?.id ?? null);
            setLokTempPosX(sjekklisteDetalj?.positionX ?? null);
            setLokTempPosY(sjekklisteDetalj?.positionY ?? null);

            // Vei videre når lokasjon mangler: gå rett til tegning/kart i stedet
            // for å lande på en tom «Ingen tegning valgt»-tilstand.
            if (!harLagretTegning && tilgjengeligeTegninger.length === 1) {
              // Én tegning/kart → åpne den direkte i tegningsvisningen
              const t = tilgjengeligeTegninger[0]!;
              setLokTempTegningId(t.id);
              setLokTempBygningId(t.byggeplassId ?? t.byggeplass?.id ?? null);
              setVisLokByttTegning(false);
            } else if (!harLagretTegning && tilgjengeligeTegninger.length > 1) {
              // Flere tegninger/kart → åpne velgeren direkte
              setVisLokByttTegning(true);
            } else {
              // Har lagret tegning, eller ingen finnes → modalen viser rett tilstand
              setVisLokByttTegning(false);
            }
            setVisLokasjonModal(true);
          }}
          className="rounded-lg bg-white px-4 py-3"
        >
          <View className="flex-row items-center gap-2">
            <MapPin size={14} color={lokasjonTekst ? "#1e40af" : "#9ca3af"} />
            <Text className={`flex-1 text-sm ${lokasjonTekst ? "text-gray-800" : "text-gray-400"}`} numberOfLines={1}>
              {lokasjonTekst ?? "Velg lokasjon…"}
            </Text>
            {!leseModus && <ChevronDown size={14} color="#9ca3af" />}
          </View>
        </Pressable>

        <UtfyllingSeksjoner
          objekter={objekter}
          render={(objekt) => {
          // Skip barn av repeatere — rendres inne i RepeaterObjekt
          if (repeaterBarnIder.has(objekt.id)) return null;
          // Sjekk synlighet (betinget felt)
          if (!erSynlig(objekt)) return null;
          // Skip location — rendres som lokasjonsvelger ovenfor
          if (objekt.type === "location") return null;

          const erDisplay = DISPLAY_TYPER.has(objekt.type);
          // Bruk parentId fra DB (ny) med fallback til config (gammel)
          const erBetinget = harForelderObjekt(objekt) || harBetingelse(objekt.config);

          // Beregn nesting-nivå for gradert innrykk
          const hentNestingNivå = (obj: typeof objekt): number => {
            const pid = obj.parentId ?? (obj.config.conditionParentId as string | undefined);
            if (!pid) return 0;
            const forelder = objekter.find((o) => o.id === pid);
            if (!forelder) return 0;
            return 1 + hentNestingNivå(forelder);
          };
          const nestingNivå = hentNestingNivå(objekt);

          // Display-typer (heading, subtitle) rendres uten wrapper
          if (erDisplay) {
            return (
              <View key={objekt.id} className={erBetinget ? "ml-4 pl-3" : ""}>
                <RapportObjektRenderer
                  objekt={objekt}
                  verdi={null}
                  onEndreVerdi={() => {}}
                  leseModus={leseModus}
                />
              </View>
            );
          }

          // Utfyllbare felt med FeltWrapper
          const feltVerdi = hentFeltVerdi(objekt.id);
          // Sjekkliste er redigerbar for den som har ballen + admin/registrator
          // (dokumentflyt.md § 2) — ikke append-only. Kun dokument-status styrer
          // lesemodus; enkeltfelt låses ikke etter innsending.
          const verdiLeseModus = leseModus;

          // Oppgave-kobling for dette feltet (vanlige felt: uendret, én badge — C gjelder kun rader)
          const feltOppgave = feltOppgaveMap.get(objekt.id)?.[0];
          const oppgaveNummer = feltOppgave
            ? `${feltOppgave.template?.prefix ?? ""}${feltOppgave.number ?? ""}`
            : undefined;

          const erRepeater = objekt.type === "repeater";
          // Rad-scopet oppgave-adapter — KUN repeater. Whole-field-oppgaven på repeateren skrus AV
          // (per-rad er entydig; prod har 0 whole-field-koblinger på repeater). Reversibelt: fjern
          // `erRepeater`-vaktene. Speiler web.
          const radOppgaver = erRepeater
            ? {
                // C: ALLE oppgaver på raden (kan være flere).
                finnForRad: (nokkel: string) =>
                  (feltOppgaveMap.get(nokkel) ?? []).map((o) => {
                    const nr = `${o.template?.prefix ?? ""}${o.number ?? ""}`;
                    return { id: o.id, nummer: nr.trim() ? nr : undefined };
                  }),
                onOpprett: (
                  nokkel: string,
                  radPosisjon: { drawingId?: string | null; positionX?: number | null; positionY?: number | null } | null,
                  radNummer: number,
                ) => {
                  setOpprettOppgaveFeltId(nokkel);
                  // Funn 3+2: radnummeret FORAN etiketten, slik rad-headeren leses («2 Observasjon»).
                  setOpprettOppgaveFeltLabel(`${radNummer} ${objekt.label}`);
                  setOpprettOppgaveKategori("oppgave");
                  // Radens posisjon ?? dokumentets lokasjon. Modalen krever fullt punkt.
                  const kilde = radPosisjon ?? {
                    drawingId: sjekklisteDetalj?.drawingId ?? null,
                    positionX: sjekklisteDetalj?.positionX ?? null,
                    positionY: sjekklisteDetalj?.positionY ?? null,
                  };
                  setOpprettOppgavePosisjon(
                    kilde.drawingId && kilde.positionX != null && kilde.positionY != null
                      ? {
                          drawingId: kilde.drawingId,
                          byggeplassId: sjekklisteDetalj?.byggeplass?.id ?? null,
                          x: kilde.positionX,
                          y: kilde.positionY,
                        }
                      : null,
                  );
                },
                onNaviger: (oid: string) => router.push(`/oppgave/${oid}`),
              }
            : undefined;

          return (
            <FeltWrapper
              key={objekt.id}
              objekt={objekt}
              kommentar={feltVerdi.kommentar}
              vedlegg={feltVerdi.vedlegg}
              onEndreKommentar={(k) => settKommentar(objekt.id, k)}
              onLeggTilVedlegg={(v) => leggTilVedlegg(objekt.id, v)}
              onFjernVedlegg={(vId) => fjernVedlegg(objekt.id, vId)}
              onErstattVedlegg={(vId, nyUrl, nyttFilnavn) => erstattVedlegg(objekt.id, vId, nyUrl, nyttFilnavn)}
              onFlyttVedlegg={(vId, retning) => flyttVedlegg(objekt.id, vId, retning)}
              leseModus={leseModus}
              sjekklisteId={sjekkliste.id}
              nestingNivå={nestingNivå}
              valideringsfeil={valideringsfeil[objekt.id]}
              oppgaveNummer={erRepeater ? undefined : oppgaveNummer && oppgaveNummer.trim() ? oppgaveNummer : undefined}
              oppgaveId={erRepeater ? undefined : feltOppgave?.id}
              onOpprettOppgave={
                erRepeater
                  ? undefined // repeater bruker per-rad-oppgaver (radOppgaver); whole-field avskrudd
                  : () => {
                      setOpprettOppgaveFeltId(objekt.id);
                      setOpprettOppgaveFeltLabel(objekt.label);
                      setOpprettOppgaveKategori("oppgave");
                      // 🔴 Lokasjonsarv: hardkodet null før → oppgave fra vanlig felt arvet aldri
                      // dokumentets lokasjon. Nå samme dokument-fallback som rad-stien (modalen
                      // krever fullt punkt: drawingId + x + y).
                      const d = sjekklisteDetalj?.drawingId ?? null;
                      const x = sjekklisteDetalj?.positionX ?? null;
                      const y = sjekklisteDetalj?.positionY ?? null;
                      setOpprettOppgavePosisjon(
                        d && x != null && y != null
                          ? { drawingId: d, byggeplassId: sjekklisteDetalj?.byggeplass?.id ?? null, x, y }
                          : null,
                      );
                    }
              }
              onNavigerTilOppgave={(oppgaveId) => router.push(`/oppgave/${oppgaveId}`)}
              oversettelser={oversettelser}
              oversettelseLaster={oversettelseLaster}
              onOversett={() => oversettFelt(objekt)}
              visOversettKnapp={visOversettKnapp}
              originalData={(feltVerdi as unknown as { original?: { spraak: string; verdi?: string; kommentar?: string } }).original}
            >
              <RapportObjektRenderer
                objekt={objekt}
                verdi={feltVerdi.verdi}
                onEndreVerdi={(v) => settVerdi(objekt.id, v)}
                leseModus={verdiLeseModus}
                barneObjekter={barneObjekterMap.get(objekt.id)}
                sjekklisteId={sjekkliste.id}
                radOppgaver={radOppgaver}
                tillatteFaggruppeIder={tillatteFaggruppeIder}
              />
            </FeltWrapper>
          );
          }}
        />

        {/* Endringslogg */}
        {sjekklisteDetalj?.template?.enableChangeLog && (sjekklisteDetalj?.changeLog ?? []).length > 0 && (
          <View className="mt-4">
            <View className="flex-row items-center gap-2 px-1 pb-2">
              <Clock size={16} color="#6b7280" />
              <Text className="text-sm font-semibold text-gray-700">{t("dokument.endringslogg")}</Text>
            </View>
            <View className="rounded-lg bg-white">
              {(sjekklisteDetalj.changeLog ?? []).map((rad, i) => {
                // H5: delt ekspanderEndring (som web/arkiv) — tolker repeater/vær korrekt og
                // returnerer TOM liste for kanoniske no-ops (som web filtrerer bort). Én logglinje
                // kan bli flere diff-rader (én per endret repeater-celle).
                const diffs = ekspanderEndring(
                  rad.fieldLabel,
                  rad.oldValue,
                  rad.newValue,
                  kolonnerPerFelt[(rad as { fieldId?: string }).fieldId ?? ""] ?? [],
                );
                if (diffs.length === 0) return null; // no-op — ingen falsk logglinje
                return (
                  <View key={rad.id} className={`px-3 py-2.5 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-medium text-gray-700">
                        {rad.user.name ?? rad.user.email}
                      </Text>
                      <Text className="text-xs text-gray-400">{formaterHistorikkDato(rad.createdAt)}</Text>
                    </View>
                    {diffs.map((d, j) => {
                      const fra = segmenterTilTekst(d.fraVerdi);
                      const til = segmenterTilTekst(d.tilVerdi);
                      return (
                        <Text key={j} className="mt-0.5 text-xs text-gray-600">
                          {t("dokument.endret")} <Text className="font-medium">{d.felt}</Text>
                          {fra != null && fra !== "" ? ` fra «${fra}»` : ""}
                          {` til «${til ?? ""}»`}
                        </Text>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Tidslinje */}
        {overforinger && overforinger.length > 0 && (
          <View className="mt-4">
            <View className="flex-row items-center gap-2 px-1 pb-2">
              <Clock size={16} color="#6b7280" />
              <Text className="text-sm font-semibold text-gray-700">{t("tidslinje.tittel")}</Text>
            </View>
            <View className="rounded-lg bg-white px-3 py-2">
              {overforinger.map((ovf, i) => {
                const erSiste = i === overforinger.length - 1;
                const harMottaker = ovf.recipientUser || ovf.recipientGroup;
                return (
                  <View key={ovf.id} className="flex-row">
                    {/* Vertikal linje + prikk */}
                    <View className="mr-3 items-center" style={{ width: 16 }}>
                      <View
                        className={`h-3 w-3 rounded-full ${erSiste ? "bg-blue-600" : "bg-gray-400"}`}
                        style={{ marginTop: 4 }}
                      />
                      {!erSiste && (
                        <View className="flex-1 bg-gray-200" style={{ width: 1 }} />
                      )}
                    </View>

                    {/* Innhold */}
                    <View className={`flex-1 ${!erSiste ? "pb-3" : ""}`}>
                      <View className="flex-row items-center gap-1.5">
                        <StatusMerkelapp status={ovf.fromStatus} />
                        <Text className="text-xs text-gray-400">→</Text>
                        <StatusMerkelapp status={ovf.toStatus} />
                        <Text className="ml-auto text-xs text-gray-400">
                          {formaterHistorikkDato(ovf.createdAt)}
                        </Text>
                      </View>
                      {/* Avsender → Mottaker */}
                      <View className="mt-0.5 flex-row items-center gap-1">
                        {ovf.sender?.name && (
                          <Text className="text-xs text-gray-500">{ovf.sender.name}</Text>
                        )}
                        {harMottaker && (
                          <>
                            <Text className="text-xs text-gray-400">→</Text>
                            <Text className="text-xs text-gray-500">
                              {ovf.recipientUser?.name ?? ovf.recipientGroup?.name}
                            </Text>
                          </>
                        )}
                      </View>
                      {ovf.comment && (
                        <Text className="mt-0.5 text-xs italic text-gray-500">
                          &ldquo;{ovf.comment}&rdquo;
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Handlingslinje (M2). Spor 2 / 5a: HMS-melder med ballen (utkast/returnert) får
          dedikert Send inn/Forkast/Send tilbake — mobil oppretter SJA via sjekkliste.opprett
          (→ draft), så denne stien MÅ kunne sende inn + varsle behandler. */}
      <View className="border-t border-gray-200 bg-white px-4 py-3">
        {erHms && erMelder && ballHosMelder ? (
          <View className="gap-2">
            <Text className="text-sm leading-relaxed text-gray-600">
              {sjekkliste.status === "draft" ? t("hms.utkast.forklaring") : t("hms.retur.forklaring")}
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => hmsSendInnMutasjon.mutate({ id: id! })}
                disabled={hmsSendInnMutasjon.isPending}
                className="flex-1 items-center justify-center rounded-lg bg-sitedoc-blue py-3"
                style={hmsSendInnMutasjon.isPending ? { opacity: 0.5 } : undefined}
              >
                <Text className="text-base font-semibold text-white">
                  {sjekkliste.status === "draft" ? t("hms.handling.sendInn") : t("hms.handling.sendTilbake")}
                </Text>
              </Pressable>
              {sjekkliste.status === "draft" && (
                <Pressable
                  onPress={håndterForkast}
                  className="items-center justify-center rounded-lg border border-gray-300 px-5 py-3"
                >
                  <Text className="text-base font-semibold text-gray-700">{t("hms.handling.forkast")}</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
        <DokumentHandlingslinje
          status={sjekkliste.status}
          erLaster={endreStatusMutasjon.isPending}
          onEndreStatus={(nyStatus, kommentarTekst, mottaker) => {
            endreStatusMutasjon.mutate({
              id: id!,
              nyStatus: nyStatus as "draft" | "sent" | "received" | "in_progress" | "responded" | "approved" | "rejected" | "closed" | "cancelled",
              senderId: bruker?.id ?? "",
              kommentar: kommentarTekst,
              recipientUserId: mottaker?.userId,
              recipientGroupId: mottaker?.groupId,
              dokumentflytId: mottaker?.dokumentflytId,
            });
          }}
          onSlett={["draft", "cancelled"].includes(sjekkliste.status) ? håndterSlett : undefined}
          tilgjengeligeFlyter={(tilgjengeligeFlyter ?? null) as unknown as Parameters<typeof DokumentHandlingslinje>[0]["tilgjengeligeFlyter"]}
          minRolle={minRolle ?? null}
          adminNiva={minFlytInfo?.adminNiva ?? null}
          besvarDeaktivertGrunn={besvarDeaktivertGrunn}
          medlemmer={flytMedlemmer}
          aktivPosisjon={(sjekklisteDetalj as { aktivPosisjon?: number | null } | undefined)?.aktivPosisjon}
          retningsrett={posisjonRett.retningsrett}
          harBallen={posisjonRett.harBallen}
          erAvsender={posisjonRett.erAvsender}
          erMedlemAvFlyt={posisjonRett.erMedlemAvFlyt}
          paakrevdeFeltGjenstaar={paakrevdeFeltGjenstaar}
          erRedigerbar={erRedigerbar}
          sisteLagretTekst={sisteLagretTekst}
          onLagreOgLukk={håndterLagreOgLukk}
        />
        )}
      </View>

      </KeyboardAvoidingView>

      {/* Lokasjonsmodal — tegningsvisning med posisjonsprikk */}
      <Modal visible={visLokasjonModal} animationType="slide" onRequestClose={() => setVisLokasjonModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }} edges={["top"]}>
          {(() => {
            const aktivTegning = lokTempTegningId
              ? alleTegninger.find((t) => t.id === lokTempTegningId)
              : null;
            const tegningUrl = aktivTegning?.fileUrl
              ? (aktivTegning.fileUrl.startsWith("http")
                ? aktivTegning.fileUrl
                : `${AUTH_CONFIG.apiUrl}${aktivTegning.fileUrl}`)
              : null;

            // «Bytt tegning»-liste — kun når bruker eksplisitt trykker «Bytt tegning»
            if (visLokByttTegning) {
              return (
                <View className="flex-1">
                  <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
                    <Pressable onPress={() => setVisLokByttTegning(false)} hitSlop={8}>
                      <Text className="text-sm font-medium text-white">Tilbake</Text>
                    </Pressable>
                    <Text className="text-sm font-semibold text-white">Bytt tegning</Text>
                    <View style={{ width: 50 }} />
                  </View>
                  <ScrollView className="flex-1" contentContainerClassName="p-3 gap-1">
                    {(() => {
                      const bygningIder = new Set(bygninger.map((b) => b.id));
                      const grupper: Array<{ id: string; navn: string; tegninger: typeof tilgjengeligeTegninger }> = bygninger
                        .map((b) => ({
                          id: b.id,
                          navn: b.name,
                          tegninger: tilgjengeligeTegninger.filter(
                            (t) => (t.byggeplassId ?? t.byggeplass?.id) === b.id,
                          ),
                        }))
                        .filter((g) => g.tegninger.length > 0);
                      // Georeferert kart / tegning uten byggeplass — ellers usynlig i lista
                      const løse = tilgjengeligeTegninger.filter(
                        (t) => !bygningIder.has((t.byggeplassId ?? t.byggeplass?.id) ?? ""),
                      );
                      if (løse.length > 0) {
                        grupper.push({ id: "__løse", navn: "Kart", tegninger: løse });
                      }
                      if (grupper.length === 0) {
                        return (
                          <Text className="mt-8 px-6 text-center text-sm text-gray-500">
                            Prosjektet har ingen tegning eller kart å plassere posisjon på.
                          </Text>
                        );
                      }
                      return grupper.map((g) => (
                        <View key={g.id} className="mb-2">
                          <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1 mb-1">
                            {g.navn}
                          </Text>
                          {g.tegninger.map((t) => (
                            <Pressable
                              key={t.id}
                              onPress={() => {
                                setLokTempTegningId(t.id);
                                setLokTempBygningId(t.byggeplassId ?? t.byggeplass?.id ?? null);
                                setLokTempPosX(null);
                                setLokTempPosY(null);
                                setVisLokByttTegning(false);
                              }}
                              className={`flex-row items-center gap-2 rounded-lg px-3 py-2.5 ${lokTempTegningId === t.id ? "bg-blue-50" : "bg-white"}`}
                            >
                              <Text className={`flex-1 text-sm ${lokTempTegningId === t.id ? "font-medium text-blue-700" : "text-gray-700"}`}>
                                {t.drawingNumber ? `${t.drawingNumber} ${t.name}` : t.name}
                              </Text>
                              {t.geoReference != null && (
                                <Text className="text-[10px] font-semibold uppercase tracking-wider text-green-600">
                                  Kart
                                </Text>
                              )}
                            </Pressable>
                          ))}
                        </View>
                      ));
                    })()}
                  </ScrollView>
                </View>
              );
            }

            // Ingen tegning valgt — vis tom tilstand med «Velg tegning»-knapp
            if (!tegningUrl) {
              return (
                <View className="flex-1">
                  <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
                    <Pressable onPress={() => setVisLokasjonModal(false)} hitSlop={8}>
                      <Text className="text-sm font-medium text-white">Avbryt</Text>
                    </Pressable>
                    <Text className="text-sm font-semibold text-white">Lokasjon</Text>
                    <View style={{ width: 50 }} />
                  </View>
                  <View className="flex-1 items-center justify-center gap-3 px-8">
                    <MapPin size={32} color="#9ca3af" />
                    {tilgjengeligeTegninger.length === 0 ? (
                      <Text className="text-center text-sm text-gray-500">
                        Prosjektet har ingen tegning eller kart å plassere posisjon på.
                      </Text>
                    ) : (
                      <>
                        <Text className="text-center text-sm text-gray-500">
                          Ingen tegning valgt. Velg en tegning eller kart for å markere posisjon.
                        </Text>
                        <Pressable
                          onPress={() => setVisLokByttTegning(true)}
                          className="mt-2 rounded-lg bg-blue-700 px-6 py-2.5"
                        >
                          <Text className="text-sm font-medium text-white">Velg tegning</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              );
            }

            // Tegningsvisning med posisjonsprikk
            const markører: Markør[] = lokTempPosX != null && lokTempPosY != null
              ? [{ id: "pos", x: lokTempPosX, y: lokTempPosY, farge: "#ef4444" }]
              : [];

            return (
              <View className="flex-1">
                <TegningsVisning
                  tegningUrl={tegningUrl}
                  tegningNavn={aktivTegning?.drawingNumber
                    ? `${aktivTegning.drawingNumber} ${aktivTegning.name}`
                    : aktivTegning?.name ?? ""}
                  onLukk={() => setVisLokasjonModal(false)}
                  onTrykk={(posX, posY) => {
                    setLokTempPosX(posX);
                    setLokTempPosY(posY);
                  }}
                  markører={markører}
                />
                {/* Bunnbar: Bytt tegning + Lagre */}
                <View className="flex-row items-center justify-between border-t border-gray-200 bg-white px-5 py-4">
                  <Pressable onPress={() => setVisLokByttTegning(true)} hitSlop={12} className="rounded-lg px-3 py-2">
                    <Text className="text-sm font-medium text-blue-600">Bytt tegning</Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      oppdaterMutasjon.mutate({
                        id: id!,
                        byggeplassId: lokTempBygningId,
                        drawingId: lokTempTegningId,
                        positionX: lokTempPosX,
                        positionY: lokTempPosY,
                      });
                      if (valgtProsjektId && lokTempBygningId && lokTempTegningId) {
                        import("expo-secure-store").then((ss) => {
                          ss.setItemAsync(`sitedoc_sist_bygning_${valgtProsjektId}`, lokTempBygningId!);
                          ss.setItemAsync(`sitedoc_sist_tegning_${valgtProsjektId}`, lokTempTegningId!);
                        });
                      }
                      setVisLokasjonModal(false);
                    }}
                    className="rounded-lg bg-blue-700 px-6 py-2.5"
                  >
                    <Text className="text-sm font-medium text-white">Lagre</Text>
                  </Pressable>
                </View>
              </View>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* Malvelger for oppgave fra felt */}
      <MalVelger
        synlig={opprettOppgaveKategori === "oppgave" && !valgtOppgaveMal}
        kategori="oppgave"
        onVelg={(mal) => setValgtOppgaveMal(mal)}
        onLukk={() => {
          setOpprettOppgaveKategori(null);
          setOpprettOppgaveFeltId(null);
          setOpprettOppgaveFeltLabel(null);
        }}
      />

      {/* Opprett oppgave fra felt-modal */}
      <OpprettDokumentModal
        synlig={opprettOppgaveKategori === "oppgave" && !!valgtOppgaveMal}
        kategori="oppgave"
        mal={valgtOppgaveMal ?? { id: "", name: "", prefix: null, category: "" }}
        sjekklisteId={sjekkliste?.id}
        sjekklisteFeltId={opprettOppgaveFeltId ?? undefined}
        sjekklisteNummer={
          sjekkliste?.template.prefix && sjekklisteNummer != null
            ? `${sjekkliste.template.prefix}${sjekklisteNummer}`
            : undefined
        }
        feltLabel={opprettOppgaveFeltLabel ?? undefined}
        posisjon={opprettOppgavePosisjon ?? undefined}
        onOpprettet={(oppgaveId) => {
          setValgtOppgaveMal(null);
          setOpprettOppgaveKategori(null);
          setOpprettOppgaveFeltId(null);
          setOpprettOppgaveFeltLabel(null);
          setOpprettOppgavePosisjon(null);
          // Oppdater oppgavelisten for denne sjekklisten
          utils.oppgave.hentForSjekkliste.invalidate({ checklistId: id! });
          // Naviger til oppgave-detaljskjerm
          router.push(`/oppgave/${oppgaveId}`);
        }}
        onLukk={() => {
          setValgtOppgaveMal(null);
          setOpprettOppgaveKategori(null);
          setOpprettOppgaveFeltId(null);
          setOpprettOppgaveFeltLabel(null);
          setOpprettOppgavePosisjon(null);
        }}
      />
    </SafeAreaView>
  );
}
