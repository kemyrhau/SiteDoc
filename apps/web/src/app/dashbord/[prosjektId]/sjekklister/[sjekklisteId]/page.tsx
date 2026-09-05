"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Spinner, StatusBadge, Card } from "@sitedoc/ui";
import { prosjektReferanseForUtskrift, ekspanderEndring, byggKolonnerPerFelt } from "@sitedoc/pdf";
import type { ProsjektForPdf, Utskriftsinnstillinger, Segment } from "@sitedoc/pdf";
import { byggObjektTre } from "@sitedoc/shared/types";
import { Check, AlertCircle, Loader2, Pencil, ArrowLeft, ShieldAlert, Download, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { finnMottakerNavn } from "@/lib/videresend-valg";
import { useSjekklisteSkjema } from "@/hooks/useSjekklisteSkjema";
import { useAutoVaer } from "@/hooks/useAutoVaer";
import { RapportObjektRenderer, DISPLAY_TYPER, SKJULT_I_UTFYLLING } from "@/components/rapportobjekter/RapportObjektRenderer";
import { flytFaggruppeIder } from "@/lib/flyt-faggrupper";
import { FeltWrapper } from "@/components/rapportobjekter/FeltWrapper";
import { UtfyllingSeksjoner } from "@/components/rapportobjekter/UtfyllingSeksjoner";
import { PrintHeader } from "@/components/PrintHeader";
import { OpprettOppgaveModal } from "@/components/OpprettOppgaveModal";
import { DokumentHandlingsmeny } from "@/components/DokumentHandlingsmeny";
import { HmsHandlingsflate, type HmsHandlingType } from "@/components/HmsHandlingsflate";
import { HmsMelderBanner } from "@/components/HmsMelderBanner";
import { HmsMelderTillegg } from "@/components/HmsMelderTillegg";
import { FlytIndikator } from "@/components/FlytIndikator";
import { perspektivEtikett, kvitteringEtikett, harFeltVerdi, standardFeltNavn } from "@sitedoc/shared";
import { useFlytKontekst, type MinFlytInfoUtsnitt } from "@/hooks/useFlytKontekst";
import { LokasjonVelger } from "@/components/LokasjonVelger";
import { EmneVelger } from "@/components/EmneVelger";
import type { RapportObjekt } from "@/components/rapportobjekter/typer";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { useOversettelse } from "@/hooks/useOversettelse";
import { DokumentTidslinje } from "@/components/DokumentTidslinje";
import { DokumentKontekstChipLinje } from "@/components/kontekst-chip/DokumentKontekstChipLinje";
import { usePresence } from "@/hooks/usePresence";

/* ------------------------------------------------------------------ */
/*  LagreIndikator                                                     */
/* ------------------------------------------------------------------ */

function LagreIndikator({ status }: { status: "idle" | "lagrer" | "lagret" | "feil" }) {
  const { t } = useTranslation();
  if (status === "idle") return null;
  if (status === "lagrer") {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Loader2 size={14} className="animate-spin" />
        {t("lagring.lagrer")}
      </span>
    );
  }
  if (status === "lagret") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <Check size={14} />
        {t("lagring.lagret")}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-500">
      <AlertCircle size={14} />
      {t("lagring.feil")}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

interface SjekklisteOppgave {
  id: string;
  number: number | null;
  checklistFieldId: string | null;
  template: { prefix: string | null } | null;
}

/** «BEF-001» (prefix + nullpadd) el. «001» (uten prefix); undefined når nummer mangler. */
function formaterOppgaveNr(o: SjekklisteOppgave | undefined): string | undefined {
  if (!o || o.number == null) return undefined;
  const nr = String(o.number).padStart(3, "0");
  return o.template?.prefix ? `${o.template.prefix}-${nr}` : nr;
}

/** Last ned en base64-PDF som fil (arkiv-PDF returneres i responsen, vei 3b). */
function lastNedPdfBase64(pdfBase64: string, filnavn: string): void {
  const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SjekklisteDetaljSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string; sjekklisteId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  // Oppgave-opprettelsesmodal state
  const [opprettOppgaveFeltId, setOpprettOppgaveFeltId] = useState<string | null>(null);
  const [opprettOppgaveFeltLabel, setOpprettOppgaveFeltLabel] = useState("");
  // Forhåndsposisjon for rad-oppgaver: radens egen drawing_position ?? dokumentets lokasjon.
  const [opprettOppgavePosisjon, setOpprettOppgavePosisjon] = useState<{
    drawingId?: string | null;
    positionX?: number | null;
    positionY?: number | null;
  } | null>(null);

  // --- Hent brukerinfo og prosjektdata FØR skjema-hook ---

  const { data: minFlytInfo } = trpc.gruppe.hentMinFlytInfo.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  // H3 (videresend-rettighet): flyt-medlemskap for å begrense videresend-mottakere til egne flyter.
  const { data: mineFlyter } = trpc.medlem.hentMineFlyter.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  const { data: mineTillatelserRå } = trpc.gruppe.hentMineTillatelser.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const mineTillatelser = useMemo(
    () => new Set<string>(mineTillatelserRå ?? []),
    [mineTillatelserRå],
  );

  const { data: alleFaggrupperRå } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const { data: dokumentflyterRå } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const alleFaggrupper = (alleFaggrupperRå ?? []) as Array<{ id: string; name: string; color: string | null }>;
  const dokumentflyter = (dokumentflyterRå ?? []) as unknown as import("@/lib/videresend-valg").DokumentflytData[];

  // Hent full sjekklistedata for tidslinje/recipient/creator
  const { data: fullSjekklisteRå } = trpc.sjekkliste.hentMedId.useQuery(
    { id: params.sjekklisteId },
    { enabled: !!params.sjekklisteId },
  );

  // HMS-dokumenter (domain="hms", f.eks. SJA) får egen handlingsflate (Ordre D).
  // Ordre 2.3/Funn G: SJA er en checklist under panseret, men konteksten er HMS —
  // retur + brødsmule peker mot HMS-lista, ikke Sjekklister.
  const erHms =
    (fullSjekklisteRå as { template?: { domain?: string } } | undefined)?.template?.domain === "hms";
  const listeSti = `/dashbord/${params.prosjektId}/${erHms ? "hms" : "sjekklister"}`;

  // Flyt-kontekst — ekstrahert hook (TS2589-avlastning): de fire tunge tRPC-type-memoene
  // bor nå i useFlytKontekst der rå-outputene widenes til unknown. Identisk logikk.
  const { harBallen, erAvsender, erMedlemAvFlyt, retningsrett, minRolle, flytMedlemmer, flytNavn, aktivPosisjon, rettighetInput } = useFlytKontekst({
    fullDokRå: fullSjekklisteRå,
    dokumentflyterRå,
    minFlytInfo: minFlytInfo as MinFlytInfoUtsnitt | undefined,
    mineTillatelser,
  });

  // --- Skjema-hook med rettighetsinfo ---

  const {
    sjekkliste,
    erLaster,
    hentFeltVerdi,
    settVerdi,
    settKommentar,
    leggTilVedlegg,
    fjernVedlegg,
    erSynlig,
    valideringsfeil,
    erRedigerbar,
    lagreStatus,
  } = useSjekklisteSkjema(params.sjekklisteId, rettighetInput);

  const { standardTegning } = useByggeplass();
  const { andreRedaktorer } = usePresence(params.sjekklisteId, "sjekkliste");

  const slettMutasjon = trpc.sjekkliste.slett.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentForProsjekt.invalidate();
      router.push(listeSti);
    },
    // Uten onError feilet sletting STILLE — knappen så død ut selv om serveren
    // avviste korrekt (slettevakt). Vis serverens melding (den sier hva brukeren
    // kan gjøre), ikke et klient-regelsett nummer to. `statusFeil` når både
    // banneret (ikke-HMS) og handlingsmenyens `feilmelding` (også HMS).
    onError: (error: { message?: string }) => {
      setStatusFeil(error.message ?? "Kunne ikke slette dokumentet. Prøv igjen.");
    },
  });

  const oppdaterMutasjon = trpc.sjekkliste.oppdater.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentMedId.invalidate({ id: params.sjekklisteId });
    },
  });

  const [statusFeil, setStatusFeil] = useState<string | null>(null);
  // Kvitterings-øyeblikket (A-3b Del 1b): momentan bekreftelse etter egen handling,
  // vist optimistisk i badgen og erstattet av sann perspektiv-tilstand når den ryddes.
  // Klient-only — ALDRI lagret tilstand. Nøklet på HANDLING (tekstNoekkel, ikke
  // nyStatus — nyStatus er ikke injektiv over handlinger, se kvitteringEtikett).
  // handlingRef fanger tekstNoekkel ved klikk, siden mutate-input-typen (Zod-schema)
  // ikke bærer den — å legge den til der ville gitt en TS excess-property-feil.
  const [kvittering, setKvittering] = useState<ReturnType<typeof kvitteringEtikett>>(null);
  const kvitteringTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handlingRef = useRef<string | undefined>(undefined);
  useEffect(() => () => clearTimeout(kvitteringTimer.current), []);

  const endreStatusMutasjon = trpc.sjekkliste.endreStatus.useMutation({
    onSuccess: () => {
      setStatusFeil(null);
      const k = handlingRef.current ? kvitteringEtikett(handlingRef.current) : null;
      if (k) {
        setKvittering(k);
        clearTimeout(kvitteringTimer.current);
        kvitteringTimer.current = setTimeout(() => setKvittering(null), 2200);
      }
      utils.sjekkliste.hentForProsjekt.invalidate();
      utils.sjekkliste.hentMedId.invalidate({ id: params.sjekklisteId });
    },
    // TS2589-avlastning: eksplisitt grunn-type på error unngår instansiering av den dype
    // tRPC-feiltypen (denne fila ligger på TS' instansierings-tak).
    onError: (error: { message?: string }) => {
      setStatusFeil(error.message ?? "Kunne ikke endre status. Prøv igjen.");
    },
  });

  // Arkiv-PDF: rendr dokumentet til én PDF og last den ned (vei 3b — PDF i respons).
  // Melding skilles bevisst: timeout → «prøv igjen» hjelper; manglende vedlegg →
  // dokumentet ER ufullstendig (last ned likevel, hullet er merket i PDF-en).
  const [arkivMelding, setArkivMelding] = useState<{ type: "feil" | "advarsel"; tekst: string } | null>(null);
  const rendrArkiv = trpc.arkiv.rendr.useMutation({
    onSuccess: (res: {
      pdfBase64: string;
      filnavn: string;
      komplett: boolean;
      renderTimeout: boolean;
      dokumenter: { manglendeVedlegg: string[] }[];
    }) => {
      lastNedPdfBase64(res.pdfBase64, res.filnavn);
      const antallMangler = res.dokumenter[0]?.manglendeVedlegg.length ?? 0;
      if (res.renderTimeout) {
        setArkivMelding({ type: "advarsel", tekst: t("arkiv.advarselTimeout") });
      } else if (antallMangler > 0) {
        setArkivMelding({ type: "advarsel", tekst: t("arkiv.advarselMangler", { antall: antallMangler }) });
      } else {
        setArkivMelding(null);
      }
    },
    // TS2589-avlastning: eksplisitt grunn-type på error (samme som endreStatus).
    onError: (error: { message?: string }) => {
      setArkivMelding({ type: "feil", tekst: error.message ?? t("arkiv.feil") });
    },
  });

  /* ---------------------------------------------------------------- */
  /*  Dedikert HMS-løp (Ordre B)                                       */
  /* ---------------------------------------------------------------- */

  // erHms + listeSti er avledet ved full-queryen over (Funn G-retur).

  const { data: erHmsAdmin = false } = trpc.hms.erHmsAdmin.useQuery(
    { projectId: params.prosjektId },
    { enabled: erHms && !!params.prosjektId },
  );

  // Delt suksess/feil-håndtering for de fire HMS-mutasjonene.
  const hmsMutasjonOpts = {
    onSuccess: () => {
      setStatusFeil(null);
      utils.sjekkliste.hentForProsjekt.invalidate();
      utils.sjekkliste.hentMedId.invalidate({ id: params.sjekklisteId });
    },
    onError: (error: { message?: string }) => {
      setStatusFeil(error.message ?? "Kunne ikke utføre HMS-handlingen. Prøv igjen.");
    },
  };

  const hmsBesvarMutasjon = trpc.sjekkliste.hmsBesvar.useMutation(hmsMutasjonOpts);
  const hmsLukkMutasjon = trpc.sjekkliste.hmsLukk.useMutation(hmsMutasjonOpts);
  const hmsGjenapneMutasjon = trpc.sjekkliste.hmsGjenapne.useMutation(hmsMutasjonOpts);
  const hmsTilfoyMutasjon = trpc.sjekkliste.hmsTilfoyInformasjon.useMutation(hmsMutasjonOpts);
  const hmsSendInnMutasjon = trpc.sjekkliste.hmsSendInn.useMutation(hmsMutasjonOpts);

  const hmsLaster =
    hmsSendInnMutasjon.isPending ||
    hmsBesvarMutasjon.isPending ||
    hmsLukkMutasjon.isPending ||
    hmsGjenapneMutasjon.isPending ||
    hmsTilfoyMutasjon.isPending;

  const utforHmsHandling = useCallback(
    (type: HmsHandlingType, tekst: string | undefined) => {
      const id = params.sjekklisteId;
      if (type === "tilfoyInformasjon") {
        hmsTilfoyMutasjon.mutate({ id, kommentar: tekst ?? "" });
      } else if (type === "besvar") {
        hmsBesvarMutasjon.mutate({ id, begrunnelse: tekst ?? "" });
      } else if (type === "lukk") {
        hmsLukkMutasjon.mutate({ id, kommentar: tekst });
      } else if (type === "gjenapne") {
        hmsGjenapneMutasjon.mutate({ id, kommentar: tekst });
      }
    },
    [params.sjekklisteId, hmsTilfoyMutasjon, hmsBesvarMutasjon, hmsLukkMutasjon, hmsGjenapneMutasjon],
  );


  // Hent prosjektdata for print-header
  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  // P4b: byggeplasser for byggeplass-chippen i kontekst-chip-linja (utfyllingsmodus).
  const { data: bygningerRå } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const bygninger = (bygningerRå ?? []) as Array<{ id: string; name: string; number: number | null }>;

  // P4b: redigerbar tittel (utfyllingsmodus). Lokalt utkast så feltet ikke
  // hopper mens oppdater-mutasjonen kjører; skriver via eksisterende oppdater.
  const [redigererTittel, setRedigererTittel] = useState(false);
  const [tittelUtkast, setTittelUtkast] = useState("");

  // fullSjekklisteRå hentet ovenfor — cast for typesikkerhet
  const fullSjekkliste = fullSjekklisteRå as {
    number?: number | null;
    dokumentflytId?: string | null;
    bestiller?: { name?: string | null };
    bestillerUserId?: string;
    recipientUserId?: string | null;
    recipientGroupId?: string | null;
    recipientGroup?: { id: string; name: string } | null;
    createdAt?: string;
    lestAvMottakerVed?: string | null;
    byggeplass?: { id: string; name: string } | null;
    drawing?: { id: string; name: string; drawingNumber: string | null } | null;
    // Dokument-lokasjon (tegningsmarkør) — arves av rad-oppgaver når raden mangler egen posisjon.
    // Skalar-felt fra `hentMedId` (bruker `include` → alle Checklist-kolonner er med).
    drawingId?: string | null;
    positionX?: number | null;
    positionY?: number | null;
    subject?: string | null;
    // FASTE FELT: malen TILLATER emne/lokasjon (showSubject/showLocation), + forslagsliste.
    template?: { showSubject?: boolean; showLocation?: boolean; subjects?: unknown } | null;
  } | undefined;

  // Oversettelse (Lag 2): on-demand felt-oversettelse for bruker med annet språk
  const prosjektKildesprak = (fullSjekklisteRå as { template?: { project?: { sourceLanguage?: string } } } | undefined)?.template?.project?.sourceLanguage;
  const {
    oversettelser,
    laster: oversettelseLaster,
    visOversettKnapp,
    oversettFelt,
  } = useOversettelse(
    params.prosjektId,
    prosjektKildesprak,
    (sjekkliste?.template?.objects ?? []) as { id: string; label: string; config: Record<string, unknown> }[],
  );

  // Hent oppgaver tilknyttet denne sjekklisten
  const { data: sjekklisteOppgaverRå } = trpc.oppgave.hentForSjekkliste.useQuery(
    { checklistId: params.sjekklisteId },
    { enabled: !!params.sjekklisteId },
  );
  const sjekklisteOppgaver = (sjekklisteOppgaverRå ?? []) as SjekklisteOppgave[];

  // Bygg map: feltId/rad-nøkkel → oppgaver. C (2026-08-22): en LISTE per nøkkel, ikke én oppgave.
  // Datamodellen tillater flere oppgaver på samme felt/rad (checklistFieldId er ikke unik); før
  // gjorde `map.set` at siste vant og resten forsvant i stillhet. Nå grupperes de, stabilt sortert
  // på nummer så badge-rekkefølgen ikke hopper mellom rendringer.
  const feltOppgaveMap = useMemo(() => {
    const map = new Map<string, SjekklisteOppgave[]>();
    for (const oppgave of sjekklisteOppgaver) {
      if (oppgave.checklistFieldId) {
        const liste = map.get(oppgave.checklistFieldId) ?? [];
        liste.push(oppgave);
        map.set(oppgave.checklistFieldId, liste);
      }
    }
    for (const liste of map.values()) {
      liste.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    }
    return map;
  }, [sjekklisteOppgaver]);

  // 4b (dokumentflyten er nøkkelen): faggrupper som er MEDLEM av dokumentets flyt — begrenser
  // `company`-feltet (FirmaObjekt). null = flyt-løst dokument (gyldig) → FirmaObjekt viser alle.
  // Ikke memoisert — se oppgave-detaljsiden: dype tRPC-typer i deps-array tipper TS2589. Billig.
  const tillatteFaggruppeIder = flytFaggruppeIder(
    (fullSjekklisteRå as unknown as { dokumentflytId?: string | null } | undefined)?.dokumentflytId,
    dokumentflyterRå,
  );

  // 🔴 Lokasjonsarv (2026-08-23): dokumentets lokasjon som en oppgave arver når raden/feltet ikke
  // har egen posisjon. BEGGE opprett-stiene bruker denne — tidligere hardkodet whole-field-stien
  // `null`, så en oppgave fra et vanlig felt aldri arvet dokumentets Z-20-01 (kun rad-stien fikk
  // fallbacken). Kilde: `fullSjekkliste` (= fullSjekklisteRå/hentMedId — alle Checklist-skalarer).
  const dokumentPosisjon = {
    drawingId: fullSjekkliste?.drawingId ?? null,
    positionX: fullSjekkliste?.positionX ?? null,
    positionY: fullSjekkliste?.positionY ?? null,
  };

  // L9 (2026-09-04): dokumentets dokumentlokasjon-tegning — siste fallback for «sist brukte»
  // tegning i en repeater-feltpin (etter forrige rads tegning). KUN tegning + navn, aldri pin.
  const dokumentTegning = fullSjekkliste?.drawingId
    ? {
        drawingId: fullSjekkliste.drawingId,
        drawingName: fullSjekkliste.drawing?.drawingNumber
          ? `${fullSjekkliste.drawing.drawingNumber} ${fullSjekkliste.drawing.name}`
          : (fullSjekkliste.drawing?.name ?? null),
      }
    : null;

  // Bygg trestruktur og flat ut i DFS-rekkefølge (forelder → barn → neste forelder)
  const objekter = useMemo(() => {
    const rå = (sjekkliste?.template?.objects ?? []) as RapportObjekt[];
    const sortert = [...rå].sort((a, b) => {
      // Topptekst-objekter først, deretter datafelter, så sortOrder innenfor sone
      const zoneA = (a.config as Record<string, unknown>)?.zone === "topptekst" ? 0 : 1;
      const zoneB = (b.config as Record<string, unknown>)?.zone === "topptekst" ? 0 : 1;
      if (zoneA !== zoneB) return zoneA - zoneB;
      return a.sortOrder - b.sortOrder;
    });

    // Grupper barn etter parentId
    const barnMap = new Map<string, RapportObjekt[]>();
    const rotObjekter: RapportObjekt[] = [];

    for (const obj of sortert) {
      if (obj.parentId) {
        const liste = barnMap.get(obj.parentId) ?? [];
        liste.push(obj);
        barnMap.set(obj.parentId, liste);
      } else {
        rotObjekter.push(obj);
      }
    }

    // DFS-flatting: forelder → barn rekursivt
    const resultat: RapportObjekt[] = [];
    function leggTilRekursivt(objekter: RapportObjekt[]) {
      for (const obj of objekter) {
        resultat.push(obj);
        const barn = barnMap.get(obj.id);
        if (barn) leggTilRekursivt(barn);
      }
    }
    leggTilRekursivt(rotObjekter);

    return resultat;
  }, [sjekkliste]);

  // Automatisk værhenting basert på prosjektkoordinater og dato
  useAutoVaer({
    prosjektId: params.prosjektId,
    alleObjekter: objekter,
    hentFeltVerdi,
    settVerdi,
  });

  // Finn barn av repeatere (for å skippe dem i hoved-loopen)
  const { repeaterBarnIder, barneObjekterMap } = useMemo(() => {
    const repeaterIder = new Set(objekter.filter((o) => o.type === "repeater").map((o) => o.id));
    const barnIder = new Set<string>();
    const barnMap = new Map<string, RapportObjekt[]>();

    for (const obj of objekter) {
      if (obj.parentId && repeaterIder.has(obj.parentId)) {
        barnIder.add(obj.id);
        const liste = barnMap.get(obj.parentId) ?? [];
        liste.push(obj);
        barnMap.set(obj.parentId, liste);
      }
    }

    return { repeaterBarnIder: barnIder, barneObjekterMap: barnMap };
  }, [objekter]);

  // Beregn nesting-nivå for et objekt (rekursivt)
  const hentNestingNivå = useCallback(
    (objekt: RapportObjekt, alleObjekter: RapportObjekt[]): number => {
      const parentId = objekt.parentId ?? (objekt.config.conditionParentId as string | undefined);
      if (!parentId) return 0;
      const forelder = alleObjekter.find((o) => o.id === parentId);
      if (!forelder) return 0;
      return 1 + hentNestingNivå(forelder, alleObjekter);
    },
    [],
  );

  // Finn vær-verdi for print-header
  const vaerTekst = useMemo(() => {
    const vaerObjekt = objekter.find((o) => o.type === "weather");
    if (!vaerObjekt) return null;
    const vaerVerdi = hentFeltVerdi(vaerObjekt.id).verdi as {
      temp?: string;
      conditions?: string;
      wind?: string;
      precipitation?: string;
    } | null;
    if (!vaerVerdi) return null;
    const deler: string[] = [];
    if (vaerVerdi.temp) deler.push(vaerVerdi.temp);
    if (vaerVerdi.conditions) deler.push(vaerVerdi.conditions);
    if (vaerVerdi.wind) deler.push(`Vind ${vaerVerdi.wind}`);
    if (vaerVerdi.precipitation) deler.push(`Nedbør ${vaerVerdi.precipitation}`);
    return deler.length > 0 ? deler.join(", ") : null;
  }, [objekter, hentFeltVerdi]);

  // Sjekkliste-nummer med prefiks
  const sjekklisteNummer = useMemo(() => {
    const nummer = fullSjekkliste?.number;
    const prefix = sjekkliste?.template?.prefix;
    if (nummer == null) return null;
    const nummerPad = String(nummer).padStart(3, "0");
    return prefix ? `${prefix}-${nummerPad}` : nummerPad;
  }, [fullSjekkliste?.number, sjekkliste?.template?.prefix]);

  // Spor 2 / 5a + Beslutning 1 (Blokk 10): HMS-melder redigerer sitt eget dokument når ballen
  // ligger hos melder-leddet (Ledd 1) og saken ikke er terminal — utkast (draft) ELLER etter
  // Returner (responded). Behandler er ALLTID read-only på melderens felt (5c). For ikke-HMS
  // gjelder flyt-rollen som før. Speiler oppgave-detaljen (delt mønster).
  const erMelder =
    !!fullSjekkliste?.bestillerUserId && fullSjekkliste.bestillerUserId === minFlytInfo?.userId;
  const erTerminalHms = ["closed", "approved", "cancelled", "rejected"].includes(sjekkliste?.status ?? "");
  const ballHosMelder =
    !erTerminalHms &&
    (sjekkliste?.status === "draft" ||
      aktivPosisjon === 1 ||
      (aktivPosisjon == null && sjekkliste?.status === "responded"));
  const leseModus = erHms ? !(erMelder && ballHosMelder) : !erRedigerbar;

  if (erLaster) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!sjekkliste) {
    return <p className="py-12 text-center text-gray-500">Sjekklisten ble ikke funnet.</p>;
  }

  const oppretterBruker = fullSjekkliste?.bestiller?.name;

  // P4b: kontekst-chip-linje (utfyllingsmodus). Prosjekt + mal = display;
  // byggeplass = velger (overstyring via oppdater); faggruppe (utfører) =
  // velger kun i utkast (server tillater faggruppe-endring kun i draft).
  const sjekklisteCast = sjekkliste as unknown as {
    title: string;
    status: string;
    template?: { id: string; name?: string | null } | null;
    utforerFaggruppe?: { id: string; name?: string | null } | null;
  };
  const erUtkast = sjekklisteCast.status === "draft";
  // Byggeplass er del av det et godkjent dokument påstår → chippen dør på approved/closed
  // (server avviser óg). Byttes byggeplass, må dokumentet gjenåpnes — det gir et spor.
  const erLaast = sjekklisteCast.status === "approved" || sjekklisteCast.status === "closed";

  function lagreTittel() {
    const ny = tittelUtkast.trim();
    setRedigererTittel(false);
    if (ny && ny !== sjekklisteCast.title) {
      oppdaterMutasjon.mutate({ id: params.sjekklisteId, title: ny });
    }
  }

  const kontekstChips: import("@/components/kontekst-chip/DokumentKontekstChipLinje").Chip[] = [
    {
      etikett: t("kontekstChip.prosjekt"),
      verdi: prosjekt?.name ?? t("kontekstChip.laster"),
      type: "display",
    },
    {
      etikett: t("kontekstChip.byggeplass"),
      verdi: fullSjekkliste?.byggeplass?.name ?? t("kontekstChip.heleProsjektet"),
      type: "velger",
      deaktivert: erLaast,
      deaktivertGrunn: t("kontekstChip.byggeplassLaastGodkjent"),
      valgtId: fullSjekkliste?.byggeplass?.id ?? null,
      tomLabel: t("kontekstChip.heleProsjektet"),
      alternativer: bygninger.map((b) => ({ id: b.id, navn: b.name })),
      onVelg: (id) =>
        oppdaterMutasjon.mutate({ id: params.sjekklisteId, byggeplassId: id, drawingId: null }),
    },
    {
      // Runde-2 (#6): «UTFØRER»-etikett → «Faggruppe» (relasjonell benevnelse; chip-verdien er selve
      // faggruppen). Rører ikke velger-oppførselen.
      etikett: t("tabell.faggruppe"),
      verdi: sjekklisteCast.utforerFaggruppe?.name ?? "—",
      type: "velger",
      deaktivert: !erUtkast,
      deaktivertGrunn: t("kontekstChip.faggruppeKunUtkast"),
      valgtId: sjekklisteCast.utforerFaggruppe?.id ?? null,
      alternativer: alleFaggrupper.map((f) => ({ id: f.id, navn: f.name })),
      onVelg: (id) => {
        if (id) oppdaterMutasjon.mutate({ id: params.sjekklisteId, utforerFaggruppeId: id });
      },
    },
    {
      etikett: t("sjekklister.mal"),
      verdi: sjekklisteCast.template?.name ?? "—",
      type: "display",
    },
  ];

  return (
    <div className="max-w-3xl pb-12">
      {/* Print-header: skjult på skjerm, synlig ved print */}
      <PrintHeader
        prosjektnavn={prosjekt?.name ?? ""}
        prosjektnummer={prosjektReferanseForUtskrift(
          prosjekt as unknown as ProsjektForPdf,
          (prosjekt as unknown as { utskriftsinnstillinger?: Utskriftsinnstillinger | null })?.utskriftsinnstillinger,
        )}
        sjekklisteTittel={sjekkliste.title}
        sjekklisteNummer={sjekklisteNummer}
        bestiller={sjekkliste.bestillerFaggruppe?.name}
        bestillerBruker={oppretterBruker ?? null}
        utforer={sjekkliste.utforerFaggruppe?.name}
        vaerTekst={vaerTekst}
        logoUrl={prosjekt?.logoUrl}
        prosjektAdresse={prosjekt?.address}
        status={sjekkliste.status}
        byggeplassNavn={fullSjekkliste?.byggeplass?.name}
        tegningNavn={fullSjekkliste?.drawing?.drawingNumber
          ? `${fullSjekkliste.drawing.drawingNumber} ${fullSjekkliste.drawing.name}`
          : fullSjekkliste?.drawing?.name}
      />

      {/* Skjerm-header: sticky ved scrolling */}
      <div className="print-skjul sticky top-0 z-10 bg-white border-b border-gray-100 -mx-6 px-4 sm:px-6 py-3 mb-3">
        {/* Ordre 2.3/Funn G: HMS-brødsmule — SJA er checklist under panseret, men
            konteksten er HMS. «← HMS» returnerer til HMS-lista, ikke Sjekklister. */}
        {erHms && (
          <button
            type="button"
            onClick={() => router.push(listeSti)}
            className="mb-1.5 inline-flex min-h-8 items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-sitedoc-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <ShieldAlert className="h-3.5 w-3.5" />
            {t("hms.tittel")}
          </button>
        )}
        {/* Rad 1: Nummer + Tittel + Dato + Status */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {sjekklisteNummer && (
            <span className="text-sm font-bold text-gray-500">{sjekklisteNummer}</span>
          )}
          {/* P4b: redigerbar tittel (utfyllingsmodus). Klikk blyant → input;
              Enter/blur lagrer via oppdater. Manuell tom tittel forkastes. */}
          {redigererTittel ? (
            <input
              autoFocus
              value={tittelUtkast}
              onChange={(e) => setTittelUtkast(e.target.value)}
              onBlur={lagreTittel}
              onKeyDown={(e) => {
                if (e.key === "Enter") lagreTittel();
                if (e.key === "Escape") setRedigererTittel(false);
              }}
              maxLength={255}
              aria-label={t("handling.rediger")}
              className="min-h-11 max-w-[60vw] rounded-md border border-sitedoc-primary px-2 py-0.5 text-base font-bold focus:outline-none sm:max-w-none sm:text-lg"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setTittelUtkast(sjekkliste.title);
                setRedigererTittel(true);
              }}
              title={t("handling.rediger")}
              className="group flex min-h-11 items-center gap-1.5 text-left"
            >
              <span className="truncate text-base font-bold max-w-[55vw] sm:max-w-none sm:text-lg">
                {sjekkliste.title}
              </span>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-gray-500" />
            </button>
          )}
          <LagreIndikator status={lagreStatus} />
          {andreRedaktorer.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700">
              <Pencil className="h-3 w-3 animate-pulse" />
              <span className="hidden sm:inline">{andreRedaktorer.map((u) => u.navn).join(", ")} redigerer</span>
              <span className="sm:hidden">{andreRedaktorer.length}</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {fullSjekkliste?.createdAt && (
              <span className="hidden sm:inline text-xs text-gray-400">
                {new Date(fullSjekkliste.createdAt).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </span>
            )}
            <StatusBadge
              status={sjekkliste.status}
              lestAvMottakerVed={fullSjekkliste?.lestAvMottakerVed}
              // HMS bruker sin egen tilstandsmaskin (Sendt/Besvart/Lukket, D1) —
              // flat status-mapping, ikke dokumentflyt-perspektivet.
              perspektiv={erHms ? undefined : (kvittering ?? perspektivEtikett(sjekkliste.status, { rolle: minRolle ?? null, harBallen, erAdmin: minFlytInfo?.erAdmin ?? false }, "sjekkliste"))}
            />
            {/* Ball-holder-chip (Del 1c): person foran faggruppe, synlig når ballen er i spill.
                Skjules for HMS — der finnes ingen dokumentflyt-mottaker (HMS-løpet, Ordre B). */}
            {(() => {
              if (erHms) return null;
              if (!["sent", "received", "in_progress", "responded", "rejected"].includes(sjekkliste.status)) return null;
              const navn =
                finnMottakerNavn(flytMedlemmer, fullSjekkliste?.recipientUserId, fullSjekkliste?.recipientGroupId) ??
                fullSjekkliste?.recipientGroup?.name;
              if (!navn) return null;
              return (
                // Runde-2 (R5): seer-relativ — «Venter på deg» når innlogget har ballen, ellers
                // «Venter på {navn}» (mottakerens ledд). Leverer «venter på»-nyansen Q1-kollapsen tok
                // fra loggen, som visning (aldri statusfakta).
                <span data-testid="venter-paa" className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 whitespace-nowrap">
                  {harBallen ? t("tabell.venterPaaDeg") : `${t("tabell.venterPaa")}: ${navn}`}
                </span>
              );
            })()}
          </div>
        </div>

        {/* P4b Rad 1b: kontekst-chip-linje (utfyllingsmodus) — prosjekt ·
            byggeplass · faggruppe · mal. Skjult ved print. */}
        <div className="print-skjul mt-2">
          <DokumentKontekstChipLinje chips={kontekstChips} />
        </div>

        {/* Rad 2: FlytIndikator (full bredde på mobil).
            F1b: HMS-dok er nå flyt-bundet (2 ledd), men HMS har egen HmsHandlingsflate —
            flytlinja ville vært redundant + vise "?" for null-medlem-oppretterboksen til
            Fase 2-matcheren navngir den. Skjul for HMS her (paritet med perspektiv-skjul under). */}
        {!erHms && flytMedlemmer.length > 0 && (
          <div className="mt-2">
            {/* Runde-2 (#7/#8): flyt-navn som caption over flytlinja (f.eks. «Sitedoc Ansatte»). */}
            {flytNavn && (
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">{flytNavn}</div>
            )}
            <div className="hidden sm:block">
              <FlytIndikator
                medlemmer={flytMedlemmer}
                aktivPosisjon={aktivPosisjon}
                harBallen={harBallen}
                visUtveier
              />
            </div>
            <div className="sm:hidden">
              <FlytIndikator
                medlemmer={flytMedlemmer}
                aktivPosisjon={aktivPosisjon}
                harBallen={harBallen}
                kompakt
                visUtveier
              />
            </div>
          </div>
        )}

        {/* Feilmelding fra endreStatus-mutasjon (HMS viser sin egen i handlingsflaten) */}
        {statusFeil && !erHms && (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {statusFeil}
          </div>
        )}

        {/* Rad 3: Handlingsknapper (full bredde på mobil) */}
        <div className="mt-2 flex items-center gap-2">
          {erHms ? (
            <HmsHandlingsflate
              status={sjekkliste.status}
              erHmsAdmin={erHmsAdmin}
              erLaster={hmsLaster}
              feilmelding={statusFeil}
              onUtfor={utforHmsHandling}
            />
          ) : (
          <DokumentHandlingsmeny
            status={sjekkliste.status}
            aktivPosisjon={aktivPosisjon}
            retningsrett={retningsrett}
            harBallen={harBallen}
            erAvsender={erAvsender}
            erMedlemAvFlyt={erMedlemAvFlyt}
            erLaster={endreStatusMutasjon.isPending || slettMutasjon.isPending}
            onEndreStatus={(nyStatus, handlingNoekkel, kommentar, mottaker) => {
              handlingRef.current = handlingNoekkel;
              endreStatusMutasjon.mutate({
                id: params.sjekklisteId,
                nyStatus: nyStatus as "draft" | "sent" | "received" | "in_progress" | "responded" | "approved" | "rejected" | "closed" | "cancelled",
                senderId: undefined,
                kommentar,
                recipientUserId: mottaker?.userId,
                recipientGroupId: mottaker?.groupId,
                dokumentflytId: mottaker?.dokumentflytId,
              });
            }}
            onSlett={() => slettMutasjon.mutate({ id: params.sjekklisteId })}
            alleFaggrupper={alleFaggrupper}
            dokumentflyter={dokumentflyter}
            templateId={sjekkliste.template?.id ?? (sjekkliste as unknown as { templateId?: string }).templateId}
            standardFaggruppeId={sjekkliste.utforerFaggruppe?.id}
            aktivDokumentflytId={fullSjekkliste?.dokumentflytId ?? undefined}
            minRolle={minRolle}
            adminNiva={minFlytInfo?.adminNiva ?? null}
            flytMedlemmer={flytMedlemmer}
            mineFlytIder={mineFlyter}
            recipientUserId={fullSjekkliste?.recipientUserId}
            recipientGroupId={fullSjekkliste?.recipientGroupId}
            bestillerUserId={fullSjekkliste?.bestillerUserId}
            lestAvMottakerVed={fullSjekkliste?.lestAvMottakerVed}
            kanSletteSomOppretter={erMelder && erUtkast}
          />
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() =>
                rendrArkiv.mutate({ dokumenter: [{ id: params.sjekklisteId, type: "sjekkliste" }] })
              }
              disabled={rendrArkiv.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              title={t("handling.lastNedArkivPdf")}
            >
              {rendrArkiv.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{t("handling.lastNedArkivPdf")}</span>
            </button>
          </div>
        </div>

        {/* Arkiv-PDF: ikke-blokkerende melding (advarsel = amber, hard feil = rød) */}
        {arkivMelding && (
          <div
            className={
              arkivMelding.type === "feil"
                ? "mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                : "mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
            }
          >
            {arkivMelding.tekst}
          </div>
        )}

        {/* Emne (FASTE FELT Del A#3) — malen TILLATER (showSubject ≠ false). */}
        {fullSjekkliste?.template?.showSubject !== false && (
          <div className="mt-2 max-w-md print-skjul">
            <EmneVelger
              emne={fullSjekkliste?.subject ?? null}
              forslag={Array.isArray(fullSjekkliste?.template?.subjects)
                ? (fullSjekkliste.template.subjects as unknown[]).map(String)
                : []}
              // Emne er en merkelapp for gjenfinning, ikke dokumentasjon — skal kunne settes/rettes
              // også etter godkjenning (Kenneth-vedtak 2026-08-29, speiler oppgave). Server-vakten
              // (sjekkliste.oppdater) slipper `subject` forbi godkjent-låsen; her speiler vi
              // dokumentets redigeringsrett (ballholder-editor + admin) via samme `leseModus` som
              // styrer feltredigering. Lokasjon/byggeplass forblir låst ved approved/closed.
              leseModus={leseModus}
              onLagre={(emne) => oppdaterMutasjon.mutate({ id: params.sjekklisteId, subject: emne })}
            />
          </div>
        )}

        {/* Lokasjon (FASTE FELT Del B#2) — malen TILLATER (showLocation ≠ false). */}
        {fullSjekkliste?.template?.showLocation !== false && (
        <div className="mt-2 max-w-md print-skjul">
          <LokasjonVelger
            prosjektId={params.prosjektId}
            tegningId={(sjekkliste as unknown as { drawingId?: string | null }).drawingId}
            tegningNavn={(sjekkliste as unknown as { drawing?: { name?: string } | null }).drawing?.name}
            bygningNavn={(sjekkliste as unknown as { byggeplass?: { name?: string } | null }).byggeplass?.name}
            positionX={(sjekkliste as unknown as { positionX?: number | null }).positionX}
            positionY={(sjekkliste as unknown as { positionY?: number | null }).positionY}
            lokasjonOmfang={(fullSjekkliste as unknown as { lokasjonOmfang?: "punkt" | "byggeplass" | null }).lokasjonOmfang ?? null}
            visPosisjon
            onLagre={(data) => {
              oppdaterMutasjon.mutate({
                id: params.sjekklisteId,
                drawingId: data.drawingId,
                byggeplassId: data.byggeplassId ?? undefined,
                positionX: data.positionX ?? null,
                positionY: data.positionY ?? null,
                lokasjonOmfang: data.lokasjonOmfang ?? null,
              });
            }}
            leseModus={["closed", "approved"].includes(sjekkliste.status)}
            /* Auto-åpning (krav 3): kun utkast, omfang ikke valgt, ingen tegning fra før.
               showLocation-gaten wrapper allerede blokka. Lukking uten valg lagrer ingenting. */
            autoÅpne={
              sjekkliste.status === "draft" &&
              ((fullSjekkliste as unknown as { lokasjonOmfang?: "punkt" | "byggeplass" | null }).lokasjonOmfang ?? null) == null &&
              !(sjekkliste as unknown as { drawingId?: string | null }).drawingId
            }
          />
        </div>
        )}
      </div>

      {/* Spor 2 / 5a: HMS melder-handlingsbanner — Send inn/Forkast (utkast) eller
          Send tilbake (returnert). Vises kun for melder når ballen ligger hos melder-leddet. */}
      {erHms && erMelder && ballHosMelder && (
        <HmsMelderBanner
          status={sjekkliste.status}
          laster={hmsLaster || slettMutasjon.isPending}
          onSendInn={() => hmsSendInnMutasjon.mutate({ id: params.sjekklisteId })}
          onForkast={() => slettMutasjon.mutate({ id: params.sjekklisteId })}
        />
      )}

      {/* Rapportobjekter */}
      <UtfyllingSeksjoner
        objekter={objekter}
        feltStatus={(objekt) => {
          // Repeater-barn telles ikke som eget kontrollpunkt (repeateren teller for hele raden).
          if (repeaterBarnIder.has(objekt.id)) return null;
          return { synlig: erSynlig(objekt), harVerdi: harFeltVerdi(hentFeltVerdi(objekt.id).verdi) };
        }}
        render={(objekt) => {
          // Skip barn av repeatere — de rendres inne i RepeaterObjekt
          if (repeaterBarnIder.has(objekt.id)) return null;
          if (!erSynlig(objekt)) return null;
          if (!leseModus && SKJULT_I_UTFYLLING.has(objekt.type)) return null;

          const erDisplay = DISPLAY_TYPER.has(objekt.type);
          const nestingNivå = hentNestingNivå(objekt, objekter);
          const feltVerdi = hentFeltVerdi(objekt.id);
          // Sjekkliste er redigerbar for den som har ballen + admin/registrator
          // (dokumentflyt.md § 2) — ikke append-only. Kun dokument-status styrer
          // lesemodus; enkeltfelt låses ikke etter innsending.
          const verdiLeseModus = leseModus;

          // Signaturliste (SJA/HMS-runder): egen server-drevet ramme, ingen FeltWrapper
          // (Kenneth-vedtak: ingen tilbehør). Bærer dokument-referansen ned.
          if (objekt.type === "signature_list") {
            return (
              <div key={objekt.id} className="print-no-break">
                <RapportObjektRenderer
                  objekt={objekt}
                  verdi={null}
                  onEndreVerdi={() => {}}
                  leseModus={verdiLeseModus}
                  prosjektId={params.prosjektId}
                  dokumentRef={{ checklistId: params.sjekklisteId }}
                />
              </div>
            );
          }

          // Display-typer rendres uten wrapper
          if (erDisplay) {
            const marginKlasse = nestingNivå > 0
              ? nestingNivå === 1 ? "ml-4" : nestingNivå === 2 ? "ml-8" : "ml-12"
              : "";
            const rammeKlasse = "";
            return (
              <div key={objekt.id} className={`print-no-break ${marginKlasse} ${rammeKlasse}`}>
                <RapportObjektRenderer
                  objekt={objekt}
                  verdi={feltVerdi.verdi}
                  onEndreVerdi={(v) => settVerdi(objekt.id, v)}
                  leseModus={verdiLeseModus}
                  prosjektId={params.prosjektId}
                />
              </div>
            );
          }

          // Vanlige felt: uendret — én badge (den første). C (flere per rad) gjelder KUN
          // repeater-rader; whole-field-oppgaver forblir 1:1 i visningen.
          const feltOppgave = feltOppgaveMap.get(objekt.id)?.[0];
          const oppgaveNummer = formaterOppgaveNr(feltOppgave);

          const erRepeater = objekt.type === "repeater";
          // Rad-scopet oppgave-adapter — KUN repeater. Whole-field-oppgaven på repeateren skrus AV
          // (per-rad er den entydige veien; to feste-måter er nettopp tvetydigheten vi fjernet
          // 2026-08-22). Både OPPRETTELSE og BADGE-VISNING utelates: prod har 0 whole-field-
          // koblinger på repeater (Kenneth-måling) → ingen bakoverkompat å bevare. Reversibelt:
          // fjern `erRepeater`-vaktene (her + oppgaveNummer/oppgaveId/onOpprettOppgave under) for å
          // slå «oppgave på hele tabellen» på igjen om behovet dukker opp.
          const radOppgaver = erRepeater
            ? {
                // C: ALLE oppgaver på raden (kan være flere), ikke bare den første.
                finnForRad: (nokkel: string) =>
                  (feltOppgaveMap.get(nokkel) ?? []).map((o) => ({ id: o.id, nummer: formaterOppgaveNr(o) })),
                onOpprett: (
                  nokkel: string,
                  radPosisjon: { drawingId?: string | null; positionX?: number | null; positionY?: number | null } | null,
                  radNummer: number,
                ) => {
                  setOpprettOppgaveFeltId(nokkel);
                  // Funn 3+2: radnummeret FORAN etiketten, slik rad-headeren selv leses («2 Observasjon»,
                  // ikke «Observasjon (rad 2)»).
                  setOpprettOppgaveFeltLabel(`${radNummer} ${objekt.label}`);
                  // Funn 1: dokument-lokasjon-fallbacken leses fra `fullSjekkliste` (= fullSjekklisteRå,
                  // hentMedId) — IKKE fra `sjekkliste` (useSjekklisteSkjema), som sprer posisjon
                  // BETINGET fra en annen query og ga `undefined` (skjult av `as unknown as`) → «Ikke satt».
                  // Kjede: radens egen posisjon → SJEKKLISTENS → ingen.
                  setOpprettOppgavePosisjon(radPosisjon ?? dokumentPosisjon);
                },
                onNaviger: (id: string) =>
                  router.push(`/dashbord/${params.prosjektId}/oppgaver?oppgave=${id}`),
              }
            : undefined;

          return (
            <div key={objekt.id} className="print-no-break">
              <FeltWrapper
                objekt={objekt}
                kommentar={feltVerdi.kommentar}
                vedlegg={feltVerdi.vedlegg}
                onEndreKommentar={(k) => settKommentar(objekt.id, k)}
                onLeggTilVedlegg={(v) => leggTilVedlegg(objekt.id, v)}
                onFjernVedlegg={(id) => fjernVedlegg(objekt.id, id)}
                leseModus={leseModus}
                nestingNivå={nestingNivå}
                valideringsfeil={valideringsfeil[objekt.id]}
                prosjektId={params.prosjektId}
                byggeplassId={fullSjekkliste?.byggeplass?.id}
                standardTegningId={standardTegning?.id}
                oppgaveNummer={erRepeater ? undefined : oppgaveNummer}
                oppgaveId={erRepeater ? undefined : feltOppgave?.id}
                onOpprettOppgave={
                  erRepeater
                    ? undefined // avskrudd: repeater bruker per-rad-oppgaver (se radOppgaver).
                    // Whole-field-badge på repeater er også utelatt: prod har 0 slike koblinger
                    // (Kenneth-måling 2026-08-22) → visningsveien ville vært død fra dag én.
                    : () => {
                        setOpprettOppgaveFeltId(objekt.id);
                        setOpprettOppgaveFeltLabel(objekt.label);
                        // 🔴 Lokasjonsarv-buggen: hardkodet `null` her → oppgave fra vanlig felt
                        // arvet aldri dokumentets lokasjon. Nå samme fallback som rad-stien.
                        setOpprettOppgavePosisjon(dokumentPosisjon);
                      }
                }
                onNavigerTilOppgave={(id) =>
                  router.push(`/dashbord/${params.prosjektId}/oppgaver?oppgave=${id}`)
                }
                oversettelser={oversettelser}
                oversettelseLaster={oversettelseLaster}
                onOversett={() => oversettFelt(objekt as { id: string; label: string; config: Record<string, unknown> })}
                visOversettKnapp={visOversettKnapp}
                originalData={(feltVerdi as unknown as { original?: { spraak: string; verdi?: string; kommentar?: string } }).original}
              >
                <RapportObjektRenderer
                  objekt={objekt}
                  verdi={feltVerdi.verdi}
                  onEndreVerdi={(v) => settVerdi(objekt.id, v)}
                  leseModus={verdiLeseModus}
                  prosjektId={params.prosjektId}
                  barneObjekter={barneObjekterMap.get(objekt.id)}
                  radOppgaver={radOppgaver}
                  tillatteFaggruppeIder={tillatteFaggruppeIder}
                  dokumentTegning={dokumentTegning}
                />
              </FeltWrapper>
            </div>
          );
        }}
      />

      {/* Spor 2 / 5b: «Tillegg fra melder» — synlig feltlås + tidsstemplet tillegg-logg.
          Vises for melderen etter at saken er sendt (ikke i utkast). Melder eier innholdet. */}
      {erHms && erMelder && sjekkliste.status !== "draft" && (
        <HmsMelderTillegg
          overforinger={((fullSjekklisteRå as { transfers?: unknown[] }).transfers ?? []) as Parameters<typeof HmsMelderTillegg>[0]["overforinger"]}
          bestillerUserId={fullSjekkliste?.bestillerUserId}
          feltlaast={!ballHosMelder && !erTerminalHms}
          kanTilfoye={["sent", "received", "responded"].includes(sjekkliste.status)}
          laster={hmsLaster}
          onTilfoy={(tekst) => hmsTilfoyMutasjon.mutate({ id: params.sjekklisteId, kommentar: tekst })}
        />
      )}

      {/* Endringslogg */}
      {sjekkliste?.template && (
        <EndringsloggSeksjon sjekklisteId={params.sjekklisteId} />
      )}

      {/* Tidslinje */}
      {fullSjekklisteRå && (
        <DokumentTidslinje
          overforinger={((fullSjekklisteRå as { transfers?: unknown[] }).transfers ?? []) as Array<{
            id: string; fromStatus: string; toStatus: string; comment: string | null; createdAt: string;
            sender?: { id: string; name: string | null } | null;
            recipientUser?: { id: string; name: string | null } | null;
            recipientGroup?: { id: string; name: string | null } | null;
          }>}
          opprettetAv={fullSjekkliste?.bestiller?.name ?? null}
          opprettetDato={(fullSjekklisteRå as { createdAt?: string }).createdAt ?? null}
        />
      )}

      {/* Opprett oppgave fra felt */}
      <OpprettOppgaveModal
        open={!!opprettOppgaveFeltId}
        onClose={() => setOpprettOppgaveFeltId(null)}
        prosjektId={params.prosjektId}
        sjekklisteId={params.sjekklisteId}
        sjekklisteFeltId={opprettOppgaveFeltId ?? ""}
        sjekklisteNummer={sjekklisteNummer}
        feltLabel={opprettOppgaveFeltLabel}
        forhandsPosisjon={opprettOppgavePosisjon}
        sjekklisteFlytId={(fullSjekklisteRå as { dokumentflytId?: string | null } | undefined)?.dokumentflytId ?? null}
        returnerTil={`${listeSti}/${params.sjekklisteId}`}
      />

    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Historikk                                                          */
/* ------------------------------------------------------------------ */

interface EndringsloggRad {
  id: string;
  fieldId: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

type MalObjekt = { id: string; label: string; parentId?: string | null; sortOrder: number };

/** Segmenter → JSX: endrede ord i <strong> (ord-diff fra @sitedoc/pdf, ikke HTML). */
function RenderSegmenter({ segs }: { segs: Segment[] }) {
  return (
    <>
      {segs.map((s, i) => (s.endret ? <strong key={i}>{s.tekst}</strong> : <span key={i}>{s.tekst}</span>))}
    </>
  );
}

/**
 * Endringslogg — gjenbruker den avhengighetsfrie transformen fra `@sitedoc/pdf`
 * (`ekspanderEndring`) i stedet for lokal JSON-formatering. Fikser to bugs som
 * har vært synlige i web hele tiden: repeater-verdier ble `[object Object]`
 * (`array.join`) og vær-objekter ble rå JSON. Transformen ekspanderer repeater-
 * endringer til «Rad N — kolonne: X → Y», normaliserer bort signert-URL-query,
 * og dropper kanoniske no-ops (vær-rekkefølge).
 */
function EndringsloggSeksjon({ sjekklisteId }: { sjekklisteId: string }) {
  const { t } = useTranslation();
  // D (bygg 50): loggen skal ikke stå åpen — sammenleggbar, lukket som standard
  // (speiler mobil `sjekkliste/[id].tsx`). enableChangeLog og radene er urørt.
  const [visLogg, setVisLogg] = useState(false);
  const { data: sjekkliste } = trpc.sjekkliste.hentMedId.useQuery({ id: sjekklisteId });

  // Smale refs (ikke hele `sjekkliste`) i dep-arrayene — den tRPC-infererte typen
  // trigger TS2589 «excessively deep» hvis den havner i useMemo-deps.
  const template = sjekkliste?.template as { objects?: MalObjekt[]; enableChangeLog?: boolean } | undefined;
  const changeLog = (sjekkliste as { changeLog?: EndringsloggRad[] } | undefined)?.changeLog;
  const enableChangeLog = template?.enableChangeLog;

  const kolonnerPerFelt = useMemo(() => {
    // byggObjektTre-returtypen er ikke rekursiv (dyp `children: unknown[]`) —
    // cast som i sammenstilling.ts. byggKolonnerPerFelt leser kun id/label/children.
    return byggKolonnerPerFelt(byggObjektTre(template?.objects ?? []) as unknown as Parameters<typeof byggKolonnerPerFelt>[0], standardFeltNavn);
  }, [template]);

  const rader = useMemo(() => {
    return (changeLog ?? []).flatMap((rad) =>
      ekspanderEndring(rad.fieldLabel, rad.oldValue, rad.newValue, kolonnerPerFelt[rad.fieldId]).map((d, i) => ({
        key: `${rad.id}-${i}`,
        felt: d.felt,
        fraVerdi: d.fraVerdi,
        tilVerdi: d.tilVerdi,
        createdAt: rad.createdAt,
        bruker: rad.user.name ?? rad.user.email,
      })),
    );
  }, [changeLog, kolonnerPerFelt]);

  if (!enableChangeLog || rader.length === 0) return null;

  return (
    <Card className="mt-6">
      <button
        type="button"
        onClick={() => setVisLogg((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={visLogg}
      >
        <Clock className="h-4 w-4 shrink-0 text-gray-500" />
        <span className="flex-1 text-sm font-medium text-gray-500">{t("dokument.endringslogg")}</span>
        {visLogg ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>
      {visLogg && (
      <div className="mt-3 flex flex-col gap-1.5">
        {rader.map((rad) => (
          <div key={rad.key} className="flex items-start gap-2 text-xs print-no-break">
            <span className="shrink-0 text-gray-400">
              {new Date(rad.createdAt).toLocaleString("nb-NO", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="shrink-0 font-medium text-gray-600">{rad.bruker}</span>
            <span className="text-gray-500">
              <span className="font-medium">{rad.felt}</span>
              {rad.fraVerdi != null && <> fra &laquo;<RenderSegmenter segs={rad.fraVerdi} />&raquo;</>}
              {" "}til &laquo;{rad.tilVerdi != null ? <RenderSegmenter segs={rad.tilVerdi} /> : "Ikke utfylt"}&raquo;
            </span>
          </div>
        ))}
      </div>
      )}
    </Card>
  );
}

