"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo, useCallback } from "react";
import { Spinner, StatusBadge, Card } from "@sitedoc/ui";
import { Check, AlertCircle, Loader2, Printer, Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSjekklisteSkjema } from "@/hooks/useSjekklisteSkjema";
import { useAutoVaer } from "@/hooks/useAutoVaer";
import { RapportObjektRenderer, DISPLAY_TYPER, SKJULT_I_UTFYLLING } from "@/components/rapportobjekter/RapportObjektRenderer";
import { FeltWrapper } from "@/components/rapportobjekter/FeltWrapper";
import { PrintHeader } from "@/components/PrintHeader";
import { OpprettOppgaveModal } from "@/components/OpprettOppgaveModal";
import { DokumentHandlingsmeny } from "@/components/DokumentHandlingsmeny";
import { FlytIndikator } from "@/components/FlytIndikator";
import { utledMinRolle } from "@sitedoc/shared";
import type { FlytMedlemInfo } from "@sitedoc/shared";
import { LokasjonVelger } from "@/components/LokasjonVelger";
import type { RapportObjekt } from "@/components/rapportobjekter/typer";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { useOversettelse } from "@/hooks/useOversettelse";
import { DokumentTidslinje } from "@/components/DokumentTidslinje";
import { usePresence } from "@/hooks/usePresence";

/* ------------------------------------------------------------------ */
/*  LagreIndikator                                                     */
/* ------------------------------------------------------------------ */

function LagreIndikator({ status }: { status: "idle" | "lagrer" | "lagret" | "feil" }) {
  if (status === "idle") return null;
  if (status === "lagrer") {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Loader2 size={14} className="animate-spin" />
        Lagrer...
      </span>
    );
  }
  if (status === "lagret") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <Check size={14} />
        Lagret
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-500">
      <AlertCircle size={14} />
      Lagring feilet
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

  const { data: mineTillatelserRå } = trpc.gruppe.hentMineTillatelser.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const mineTillatelser = useMemo(
    () => new Set<string>(mineTillatelserRå ?? []),
    [mineTillatelserRå],
  );

  const { data: alleEntrepriserRå } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const { data: dokumentflyterRå } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const alleEntrepriser = (alleEntrepriserRå ?? []) as Array<{ id: string; name: string; color: string | null }>;
  const dokumentflyter = (dokumentflyterRå ?? []) as unknown as import("@/components/StatusHandlinger").DokumentflytData[];

  // Hent full sjekklistedata for tidslinje/recipient/creator
  const { data: fullSjekklisteRå } = trpc.sjekkliste.hentMedId.useQuery(
    { id: params.sjekklisteId },
    { enabled: !!params.sjekklisteId },
  );

  // harBallen
  const harBallen = useMemo(() => {
    if (!fullSjekklisteRå || !minFlytInfo) return false;
    const fs = fullSjekklisteRå as { status?: string; recipientUserId?: string | null; recipientGroupId?: string | null; bestillerUserId?: string };
    if (fs.status === "draft") return fs.bestillerUserId === (minFlytInfo as { userId?: string }).userId;
    if (fs.recipientUserId && fs.recipientUserId === (minFlytInfo as { userId?: string }).userId) return true;
    if (fs.recipientGroupId && minFlytInfo.gruppeIder.includes(fs.recipientGroupId)) return true;
    return false;
  }, [fullSjekklisteRå, minFlytInfo]);

  // Utled brukerens rolle i dokumentflyten
  const minRolle = useMemo(() => {
    if (!minFlytInfo || !fullSjekklisteRå) return undefined;
    const sj = fullSjekklisteRå as unknown as { dokumentflytId?: string | null; bestillerEnterprise?: { id: string }; utforerEnterprise?: { id: string } };
    if (!sj.dokumentflytId) return undefined;
    const flyt = dokumentflyter.find((df) => df.id === sj.dokumentflytId);
    if (!flyt) return null;
    const medlemmer = flyt.medlemmer.map((m): FlytMedlemInfo => ({
      rolle: m.rolle,
      enterpriseId: m.enterpriseId ?? null,
      projectMemberId: m.projectMemberId ?? null,
      groupId: m.groupId ?? null,
    }));
    return utledMinRolle(
      { ...minFlytInfo, userId: "", erAdmin: minFlytInfo.erAdmin },
      medlemmer,
      { bestillerEnterpriseId: sj.bestillerEnterprise?.id ?? "", utforerEnterpriseId: sj.utforerEnterprise?.id ?? "" },
    );
  }, [minFlytInfo, fullSjekklisteRå, dokumentflyter]);

  // Bygg rettighetInput for skjema-hook
  // Utled flytRettighet fra DokumentflytMedlem.kanRedigere
  const flytRettighet = useMemo((): "redigerer" | "leser" | undefined => {
    if (!minFlytInfo || !fullSjekklisteRå || !dokumentflyterRå) return undefined;
    const sj = fullSjekklisteRå as unknown as { dokumentflytId?: string | null };
    if (!sj.dokumentflytId) return undefined;
    const rå = dokumentflyterRå as unknown as Array<{
      id: string;
      medlemmer: Array<{
        kanRedigere: boolean;
        enterpriseId?: string | null;
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
  }, [minFlytInfo, fullSjekklisteRå, dokumentflyterRå]);

  const rettighetInput = useMemo(() => {
    if (!minFlytInfo) return undefined;
    return {
      erAdmin: minFlytInfo.erAdmin,
      minRolle,
      tillatelser: mineTillatelser,
      harBallen,
      flytRettighet,
    };
  }, [minFlytInfo, minRolle, mineTillatelser, harBallen, flytRettighet]);

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

  const endreStatusMutasjon = trpc.sjekkliste.endreStatus.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentForProsjekt.invalidate();
      utils.sjekkliste.hentMedId.invalidate({ id: params.sjekklisteId });
    },
  });

  // Flytmedlemmer for FlytIndikator og DokumentHandlingsmeny
  const flytMedlemmer = useMemo(() => {
    const sj = sjekkliste as unknown as { dokumentflytId?: string | null };
    if (!sj?.dokumentflytId || !dokumentflyterRå) return [];
    const rå = dokumentflyterRå as unknown as Array<{
      id: string;
      medlemmer: Array<{
        id: string;
        rolle: string;
        steg: number;
        enterprise: { id: string; name: string } | null;
        projectMember: { user: { id: string; name: string | null } } | null;
        group: { id: string; name: string } | null;
      }>;
    }>;
    const flyt = rå.find((df) => df.id === sj.dokumentflytId);
    if (!flyt) return [];
    return flyt.medlemmer;
  }, [sjekkliste, dokumentflyterRå]);

  // Hent prosjektdata for print-header
  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  // fullSjekklisteRå hentet ovenfor — cast for typesikkerhet
  const fullSjekkliste = fullSjekklisteRå as {
    number?: number | null;
    bestiller?: { name?: string | null };
    bestillerUserId?: string;
    recipientUserId?: string | null;
    recipientGroupId?: string | null;
    createdAt?: string;
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

  return (
    <div className="mx-auto max-w-3xl pb-12">
      {/* Print-header: skjult på skjerm, synlig ved print */}
      <PrintHeader
        prosjektnavn={prosjekt?.name ?? ""}
        prosjektnummer={prosjekt?.projectNumber ?? ""}
        eksterntNummer={prosjekt?.externalProjectNumber}
        sjekklisteTittel={sjekkliste.title}
        sjekklisteNummer={sjekklisteNummer}
        bestiller={sjekkliste.bestillerEnterprise?.name}
        bestillerBruker={oppretterBruker ?? null}
        utforer={sjekkliste.utforerEnterprise?.name}
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
          <h3 className="text-base sm:text-lg font-bold truncate max-w-[60vw] sm:max-w-none">{sjekkliste.title}</h3>
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
            <StatusBadge status={sjekkliste.status} />
          </div>
        </div>

        {/* Rad 2: FlytIndikator (full bredde på mobil) */}
        {flytMedlemmer.length > 0 && (
          <div className="mt-2">
            <div className="hidden sm:block">
              <FlytIndikator
                medlemmer={flytMedlemmer}
                recipientUserId={fullSjekkliste?.recipientUserId}
                recipientGroupId={fullSjekkliste?.recipientGroupId}
                status={sjekkliste.status}
                bestillerUserId={fullSjekkliste?.bestillerUserId}
              />
            </div>
            <div className="sm:hidden">
              <FlytIndikator
                medlemmer={flytMedlemmer}
                recipientUserId={fullSjekkliste?.recipientUserId}
                recipientGroupId={fullSjekkliste?.recipientGroupId}
                status={sjekkliste.status}
                bestillerUserId={fullSjekkliste?.bestillerUserId}
                kompakt
              />
            </div>
          </div>
        )}

        {/* Rad 3: Handlingsknapper (full bredde på mobil) */}
        <div className="mt-2 flex items-center gap-2">
          <DokumentHandlingsmeny
            status={sjekkliste.status}
            erLaster={endreStatusMutasjon.isPending || slettMutasjon.isPending}
            onEndreStatus={(nyStatus, kommentar, mottaker) => {
              endreStatusMutasjon.mutate({
                id: params.sjekklisteId,
                nyStatus: nyStatus as "draft" | "sent" | "received" | "in_progress" | "responded" | "approved" | "rejected" | "closed" | "cancelled",
                senderId: sjekkliste.id,
                kommentar,
                recipientUserId: mottaker?.userId,
                recipientGroupId: mottaker?.groupId,
                dokumentflytId: mottaker?.dokumentflytId,
              });
            }}
            onSlett={() => slettMutasjon.mutate({ id: params.sjekklisteId })}
            alleEntrepriser={alleEntrepriser}
            dokumentflyter={dokumentflyter}
            templateId={sjekkliste.template?.id ?? (sjekkliste as unknown as { templateId?: string }).templateId}
            standardEntrepriseId={sjekkliste.utforerEnterprise?.id}
            minRolle={minRolle}
            flytMedlemmer={flytMedlemmer}
            recipientUserId={fullSjekkliste?.recipientUserId}
            recipientGroupId={fullSjekkliste?.recipientGroupId}
            bestillerUserId={fullSjekkliste?.bestillerUserId}
          />
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
      <div className="flex flex-col gap-3">
        {objekter.map((objekt) => {
          // Skip barn av repeatere — de rendres inne i RepeaterObjekt
          if (repeaterBarnIder.has(objekt.id)) return null;
          if (!erSynlig(objekt)) return null;
          if (!leseModus && SKJULT_I_UTFYLLING.has(objekt.type)) return null;

          const erDisplay = DISPLAY_TYPER.has(objekt.type);
          const nestingNivå = hentNestingNivå(objekt, objekter);
          const feltVerdi = hentFeltVerdi(objekt.id);

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
                  leseModus={leseModus}
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
                  leseModus={leseModus}
                  prosjektId={params.prosjektId}
                  barneObjekter={barneObjekterMap.get(objekt.id)}
                />
              </FeltWrapper>
            </div>
          );
        })}
      </div>

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

