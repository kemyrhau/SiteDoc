"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo, useCallback } from "react";
import { Spinner, StatusBadge, Card } from "@sitedoc/ui";
import { Check, AlertCircle, Loader2, Printer, FileText, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSjekklisteSkjema } from "@/hooks/useSjekklisteSkjema";
import { useAutoVaer } from "@/hooks/useAutoVaer";
import { RapportObjektRenderer, DISPLAY_TYPER, SKJULT_I_UTFYLLING } from "@/components/rapportobjekter/RapportObjektRenderer";
import { FeltWrapper } from "@/components/rapportobjekter/FeltWrapper";
import { PrintHeader } from "@/components/PrintHeader";
import { OpprettOppgaveModal } from "@/components/OpprettOppgaveModal";
import { StatusHandlinger } from "@/components/StatusHandlinger";
import type { RapportObjekt } from "@/components/rapportobjekter/typer";
import { useBygning } from "@/kontekst/bygning-kontekst";

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
  } = useSjekklisteSkjema(params.sjekklisteId);

  const { standardTegning } = useBygning();

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
      utils.sjekkliste.hentMedId.invalidate({ id: params.sjekklisteId });
      utils.sjekkliste.hentForProsjekt.invalidate();
    },
  });

  // Hent entrepriser for redigering
  const { data: mineEntrepriser } = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const { data: alleEntrepriser } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  // Hent prosjektdata for print-header
  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  // Hent full sjekklistedata for nummer/oppretter-bruker (cast for TS2589)
  const { data: fullSjekklisteRå } = trpc.sjekkliste.hentMedId.useQuery(
    { id: params.sjekklisteId },
    { enabled: !!params.sjekklisteId },
  );
  const fullSjekkliste = fullSjekklisteRå as {
    number?: number | null;
    creator?: { name?: string | null };
    building?: { id: string; name: string } | null;
    drawing?: { id: string; name: string; drawingNumber: string | null } | null;
  } | undefined;

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

  const oppretterBruker = fullSjekkliste?.creator?.name;

  return (
    <div className="mx-auto max-w-3xl pb-12">
      {/* Print-header: skjult på skjerm, synlig ved print */}
      <PrintHeader
        prosjektnavn={prosjekt?.name ?? ""}
        prosjektnummer={prosjekt?.projectNumber ?? ""}
        eksterntNummer={prosjekt?.externalProjectNumber}
        sjekklisteTittel={sjekkliste.title}
        sjekklisteNummer={sjekklisteNummer}
        oppretter={sjekkliste.creatorEnterprise?.name}
        oppretterBruker={oppretterBruker ?? null}
        svarer={sjekkliste.responderEnterprise?.name}
        vaerTekst={vaerTekst}
        logoUrl={prosjekt?.logoUrl}
        prosjektAdresse={prosjekt?.address}
        status={sjekkliste.status}
        bygningNavn={fullSjekkliste?.building?.name}
        tegningNavn={fullSjekkliste?.drawing?.drawingNumber
          ? `${fullSjekkliste.drawing.drawingNumber} ${fullSjekkliste.drawing.name}`
          : fullSjekkliste?.drawing?.name}
        visInterntNummer={(prosjekt as { showInternalProjectNumber?: boolean } | undefined)?.showInternalProjectNumber !== false}
      />

      {/* Skjerm-header: synlig på skjerm, skjult ved print */}
      <div className="print-skjul mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold">{sjekkliste.title}</h3>
          <StatusBadge status={sjekkliste.status} />
          <LagreIndikator status={lagreStatus} />
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => window.open(`/utskrift/sjekkliste/${params.sjekklisteId}`, "_blank")}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <FileText className="h-4 w-4" />
              Vis PDF
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Printer className="h-4 w-4" />
              Skriv ut
            </button>
            {sjekkliste.status === "draft" && (
              <button
                onClick={() => {
                  if (confirm("Er du sikker på at du vil slette denne sjekklisten? Dette kan ikke angres.")) {
                    slettMutasjon.mutate({ id: params.sjekklisteId });
                  }
                }}
                disabled={slettMutasjon.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {slettMutasjon.isPending ? "Sletter..." : "Slett"}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <span>Mal: {sjekkliste.template.name}</span>
          {sjekkliste.status === "draft" ? (
            <>
              <span>&middot; Oppretter:</span>
              <select
                value={sjekkliste.creatorEnterprise?.id ?? ""}
                onChange={(e) => oppdaterMutasjon.mutate({ id: params.sjekklisteId, creatorEnterpriseId: e.target.value })}
                className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-sm text-gray-700"
              >
                {(mineEntrepriser ?? []).map((ent: { id: string; name: string }) => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
              <span>&middot; Svarer:</span>
              <select
                value={sjekkliste.responderEnterprise?.id ?? ""}
                onChange={(e) => oppdaterMutasjon.mutate({ id: params.sjekklisteId, responderEnterpriseId: e.target.value })}
                className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-sm text-gray-700"
              >
                {(alleEntrepriser ?? []).map((ent: { id: string; name: string }) => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              {sjekkliste.creatorEnterprise && (
                <span>&middot; Oppretter: {sjekkliste.creatorEnterprise.name}</span>
              )}
              {sjekkliste.responderEnterprise && (
                <span>&middot; Svarer: {sjekkliste.responderEnterprise.name}</span>
              )}
            </>
          )}
        </div>
        {sjekklisteNummer && (
          <p className="mt-1 text-xs text-gray-400">Nr: {sjekklisteNummer}</p>
        )}

        {/* Statushandlinger */}
        <div className="mt-3 print-skjul">
          <StatusHandlinger
            status={sjekkliste.status}
            erLaster={endreStatusMutasjon.isPending}
            onEndreStatus={(nyStatus, kommentar) => {
              endreStatusMutasjon.mutate({
                id: params.sjekklisteId,
                nyStatus: nyStatus as "draft" | "sent" | "received" | "in_progress" | "responded" | "approved" | "rejected" | "closed" | "cancelled",
                senderId: sjekkliste.id,
                kommentar,
              });
            }}
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
                bygningId={fullSjekkliste?.building?.id}
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

      {/* Historikk */}
      {sjekkliste && (
        <HistorikkSeksjon sjekklisteId={params.sjekklisteId} />
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

function HistorikkSeksjon({ sjekklisteId }: { sjekklisteId: string }) {
  const { data: sjekkliste } = trpc.sjekkliste.hentMedId.useQuery({ id: sjekklisteId });

  const overgangshistorikk = (sjekkliste?.transfers ?? []) as Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    comment: string | null;
    createdAt: string;
  }>;

  if (overgangshistorikk.length === 0) return null;

  return (
    <Card className="mt-8">
      <h4 className="mb-3 text-sm font-medium text-gray-500">Historikk</h4>
      <div className="flex flex-col gap-2">
        {overgangshistorikk.map((overgang) => (
          <div key={overgang.id} className="flex items-center gap-3 text-sm print-no-break">
            <span className="text-xs text-gray-400">
              {new Date(overgang.createdAt).toLocaleString("nb-NO")}
            </span>
            <StatusBadge status={overgang.fromStatus} />
            <span className="text-gray-400">&rarr;</span>
            <StatusBadge status={overgang.toStatus} />
            {overgang.comment && (
              <span className="text-gray-500">&mdash; {overgang.comment}</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
