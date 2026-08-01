"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Spinner, StatusBadge, Card } from "@sitedoc/ui";
import { Check, AlertCircle, Loader2, Printer, Pencil } from "lucide-react";
import { harMinstEttUtfyltFelt } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { finnMottakerNavn } from "@/lib/videresend-valg";
import { useSjekklisteSkjema } from "@/hooks/useSjekklisteSkjema";
import { useAutoVaer } from "@/hooks/useAutoVaer";
import { RapportObjektRenderer, DISPLAY_TYPER, SKJULT_I_UTFYLLING } from "@/components/rapportobjekter/RapportObjektRenderer";
import { FeltWrapper } from "@/components/rapportobjekter/FeltWrapper";
import { UtfyllingSeksjoner } from "@/components/rapportobjekter/UtfyllingSeksjoner";
import { PrintHeader } from "@/components/PrintHeader";
import { OpprettOppgaveModal } from "@/components/OpprettOppgaveModal";
import { DokumentHandlingsmeny } from "@/components/DokumentHandlingsmeny";
import { HmsHandlingsflate, type HmsHandlingType } from "@/components/HmsHandlingsflate";
import { FlytIndikator } from "@/components/FlytIndikator";
import { perspektivEtikett, kvitteringEtikett } from "@sitedoc/shared";
import { useFlytKontekst, type MinFlytInfoUtsnitt } from "@/hooks/useFlytKontekst";
import { LokasjonVelger } from "@/components/LokasjonVelger";
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

export default function SjekklisteDetaljSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string; sjekklisteId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  // Oppgave-opprettelsesmodal state
  const [opprettOppgaveFeltId, setOpprettOppgaveFeltId] = useState<string | null>(null);
  const [opprettOppgaveFeltLabel, setOpprettOppgaveFeltLabel] = useState("");

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

  // Flyt-kontekst — ekstrahert hook (TS2589-avlastning): de fire tunge tRPC-type-memoene
  // bor nå i useFlytKontekst der rå-outputene widenes til unknown. Identisk logikk.
  const { harBallen, erAvsender, erMedlemAvFlyt, retningsrett, minRolle, flytRettighet, flytMedlemmer, aktivPosisjon, rettighetInput } = useFlytKontekst({
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
      router.push(`/dashbord/${params.prosjektId}/sjekklister`);
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

  /* ---------------------------------------------------------------- */
  /*  Dedikert HMS-løp (Ordre B)                                       */
  /* ---------------------------------------------------------------- */

  // HMS-dokumenter (domain="hms") får en egen handlingsflate i stedet for den
  // generelle statusmaskinen. Domenet leses fra malen på full-queryen.
  const erHms =
    (fullSjekklisteRå as { template?: { domain?: string } } | undefined)?.template?.domain === "hms";

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

  const hmsLaster =
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
    bestiller?: { name?: string | null };
    bestillerUserId?: string;
    recipientUserId?: string | null;
    recipientGroupId?: string | null;
    recipientGroup?: { id: string; name: string } | null;
    createdAt?: string;
    lestAvMottakerVed?: string | null;
    byggeplass?: { id: string; name: string } | null;
    drawing?: { id: string; name: string; drawingNumber: string | null } | null;
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

  // Bygg map: feltId → oppgave
  const feltOppgaveMap = useMemo(() => {
    const map = new Map<string, SjekklisteOppgave>();
    for (const oppgave of sjekklisteOppgaver) {
      if (oppgave.checklistFieldId) {
        map.set(oppgave.checklistFieldId, oppgave);
      }
    }
    return map;
  }, [sjekklisteOppgaver]);

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

  // P2 (tom-besvarelse): speiler server-guarden. Beregnes fra lagret svar-data
  // (samme delte helper + samme input som serveren) → UI viser aldri en Besvar
  // serveren avviser. Deaktivert til minst ett svar-felt er utfylt og lagret.
  const besvarDeaktivertGrunn = useMemo(() => {
    const objs = (sjekkliste?.template?.objects ?? []) as { id: string; type: string }[];
    const data = ((sjekkliste as unknown as { data?: unknown })?.data ?? null) as Record<string, { verdi?: unknown; kommentar?: unknown; vedlegg?: unknown }> | null;
    return harMinstEttUtfyltFelt(objs, data) ? null : t("statushandling.laast.tomBesvarelse");
  }, [sjekkliste, t]);

  const leseModus = !erRedigerbar;

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
      valgtId: fullSjekkliste?.byggeplass?.id ?? null,
      tomLabel: t("kontekstChip.heleProsjektet"),
      alternativer: bygninger.map((b) => ({ id: b.id, navn: b.name })),
      onVelg: (id) =>
        oppdaterMutasjon.mutate({ id: params.sjekklisteId, byggeplassId: id, drawingId: null }),
    },
    {
      etikett: t("tabell.utforer"),
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
        prosjektnummer={prosjekt?.projectNumber ?? ""}
        eksterntNummer={prosjekt?.externalProjectNumber}
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
        visInterntNummer={(prosjekt as { showInternalProjectNumber?: boolean } | undefined)?.showInternalProjectNumber !== false}
      />

      {/* Skjerm-header: sticky ved scrolling */}
      <div className="print-skjul sticky top-0 z-10 bg-white border-b border-gray-100 -mx-6 px-4 sm:px-6 py-3 mb-3">
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
                <span data-testid="venter-paa" className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 whitespace-nowrap">
                  {t("tabell.venterPaa")}: {navn}
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
            <div className="hidden sm:block">
              <FlytIndikator
                medlemmer={flytMedlemmer}
                aktivPosisjon={aktivPosisjon}
                visUtveier
              />
            </div>
            <div className="sm:hidden">
              <FlytIndikator
                medlemmer={flytMedlemmer}
                aktivPosisjon={aktivPosisjon}
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
              erOppretter={
                !!fullSjekkliste?.bestillerUserId &&
                fullSjekkliste.bestillerUserId === minFlytInfo?.userId
              }
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
            minRolle={minRolle}
            adminNiva={minFlytInfo?.adminNiva ?? null}
            flytMedlemmer={flytMedlemmer}
            mineFlytIder={mineFlyter}
            recipientUserId={fullSjekkliste?.recipientUserId}
            recipientGroupId={fullSjekkliste?.recipientGroupId}
            bestillerUserId={fullSjekkliste?.bestillerUserId}
            lestAvMottakerVed={fullSjekkliste?.lestAvMottakerVed}
            besvarDeaktivertGrunn={besvarDeaktivertGrunn}
          />
          )}
          <button
            onClick={() => window.open(`/utskrift/sjekkliste/${params.sjekklisteId}?print=true`, "_blank")}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            title="Skriv ut"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>

        {/* Lokasjon */}
        <div className="mt-2 max-w-md print-skjul">
          <LokasjonVelger
            prosjektId={params.prosjektId}
            tegningId={(sjekkliste as unknown as { drawingId?: string | null }).drawingId}
            tegningNavn={(sjekkliste as unknown as { drawing?: { name?: string } | null }).drawing?.name}
            bygningNavn={(sjekkliste as unknown as { byggeplass?: { name?: string } | null }).byggeplass?.name}
            positionX={(sjekkliste as unknown as { positionX?: number | null }).positionX}
            positionY={(sjekkliste as unknown as { positionY?: number | null }).positionY}
            visPosisjon
            onLagre={(data) => {
              oppdaterMutasjon.mutate({
                id: params.sjekklisteId,
                drawingId: data.drawingId,
                byggeplassId: data.byggeplassId ?? undefined,
                positionX: data.positionX ?? null,
                positionY: data.positionY ?? null,
              });
            }}
            leseModus={["closed", "approved"].includes(sjekkliste.status)}
          />
        </div>
      </div>

      {/* Rapportobjekter */}
      <UtfyllingSeksjoner
        objekter={objekter}
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

          const feltOppgave = feltOppgaveMap.get(objekt.id);
          const oppgaveNummer = feltOppgave && feltOppgave.number != null
            ? feltOppgave.template?.prefix
              ? `${feltOppgave.template.prefix}-${String(feltOppgave.number).padStart(3, "0")}`
              : String(feltOppgave.number).padStart(3, "0")
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
                oppgaveNummer={oppgaveNummer}
                oppgaveId={feltOppgave?.id}
                onOpprettOppgave={() => {
                  setOpprettOppgaveFeltId(objekt.id);
                  setOpprettOppgaveFeltLabel(objekt.label);
                }}
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
                />
              </FeltWrapper>
            </div>
          );
        }}
      />

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
      />

    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Historikk                                                          */
/* ------------------------------------------------------------------ */

interface EndringsloggRad {
  id: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

function formaterVerdi(json: string | null): string {
  if (json == null) return "—";
  try {
    const parsed = JSON.parse(json);
    if (parsed === null || parsed === "") return "—";
    if (typeof parsed === "string") return parsed;
    if (typeof parsed === "number" || typeof parsed === "boolean") return String(parsed);
    if (Array.isArray(parsed)) return parsed.join(", ");
    return json;
  } catch {
    return json;
  }
}

function EndringsloggSeksjon({ sjekklisteId }: { sjekklisteId: string }) {
  const { data: sjekkliste } = trpc.sjekkliste.hentMedId.useQuery({ id: sjekklisteId });

  const enableChangeLog = (sjekkliste?.template as { enableChangeLog?: boolean } | undefined)?.enableChangeLog;
  const changeLog = ((sjekkliste as { changeLog?: EndringsloggRad[] } | undefined)?.changeLog ?? []);

  if (!enableChangeLog || changeLog.length === 0) return null;

  return (
    <Card className="mt-6">
      <h4 className="mb-3 text-sm font-medium text-gray-500">Endringslogg</h4>
      <div className="flex flex-col gap-1.5">
        {changeLog.map((rad) => (
          <div key={rad.id} className="flex items-start gap-2 text-xs print-no-break">
            <span className="shrink-0 text-gray-400">
              {new Date(rad.createdAt).toLocaleString("nb-NO", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="shrink-0 font-medium text-gray-600">
              {rad.user.name ?? rad.user.email}
            </span>
            <span className="text-gray-500">
              endret <span className="font-medium">{rad.fieldLabel}</span>
              {rad.oldValue != null && (
                <> fra &laquo;{formaterVerdi(rad.oldValue)}&raquo;</>
              )}
              {" "}til &laquo;{formaterVerdi(rad.newValue)}&raquo;
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

