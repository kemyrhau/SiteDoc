"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo, useCallback } from "react";
import { Spinner, StatusBadge, Card, Badge } from "@sitedoc/ui";
import { Check, AlertCircle, Loader2, Send, FileText, Printer } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOppgaveSkjema } from "@/hooks/useOppgaveSkjema";
import { StatusHandlinger } from "@/components/StatusHandlinger";
import { LokasjonVelger } from "@/components/LokasjonVelger";
import { RapportObjektRenderer, DISPLAY_TYPER, SKJULT_I_UTFYLLING } from "@/components/rapportobjekter/RapportObjektRenderer";
import { FeltWrapper } from "@/components/rapportobjekter/FeltWrapper";
import type { RapportObjekt } from "@/components/rapportobjekter/typer";
import { useOversettelse } from "@/hooks/useOversettelse";
import { DokumentTidslinje } from "@/components/DokumentTidslinje";

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
/*  Prioritet-badge                                                    */
/* ------------------------------------------------------------------ */

const PRIORITETS_TEKST: Record<string, string> = {
  low: "Lav",
  medium: "Medium",
  high: "Høy",
  critical: "Kritisk",
};

const PRIORITETS_VARIANT: Record<string, "default" | "primary" | "warning" | "danger"> = {
  low: "default",
  medium: "primary",
  high: "warning",
  critical: "danger",
};

/* ------------------------------------------------------------------ */
/*  Dialog-seksjon                                                     */
/* ------------------------------------------------------------------ */

interface Kommentar {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

function DialogSeksjon({ oppgaveId }: { oppgaveId: string }) {
  const [nyTekst, setNyTekst] = useState("");
  const utils = trpc.useUtils();

  const { data: kommentarer } = trpc.oppgave.hentKommentarer.useQuery(
    { taskId: oppgaveId },
    { enabled: !!oppgaveId },
  );

  const leggTilMutasjon = trpc.oppgave.leggTilKommentar.useMutation({
    onSuccess: () => {
      utils.oppgave.hentKommentarer.invalidate({ taskId: oppgaveId });
      utils.oppgave.hentMedId.invalidate({ id: oppgaveId });
      setNyTekst("");
    },
  });

  const håndterSend = () => {
    if (!nyTekst.trim()) return;
    leggTilMutasjon.mutate({ taskId: oppgaveId, content: nyTekst.trim() });
  };

  const liste = (kommentarer ?? []) as Kommentar[];

  return (
    <Card className="mt-6">
      <h4 className="mb-3 text-sm font-medium text-gray-500">Dialog</h4>

      {liste.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {liste.map((k) => (
            <div key={k.id} className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">
                  {k.user.name ?? k.user.email}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(k.createdAt).toLocaleString("nb-NO", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{k.content}</p>
            </div>
          ))}
        </div>
      )}

      {liste.length === 0 && (
        <p className="mb-3 text-xs text-gray-400">Ingen kommentarer ennå</p>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={nyTekst}
          onChange={(e) => setNyTekst(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              håndterSend();
            }
          }}
          placeholder="Skriv en kommentar..."
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={håndterSend}
          disabled={!nyTekst.trim() || leggTilMutasjon.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </div>
    </Card>
  );
}


/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function OppgaveDetaljSide() {
  const params = useParams<{ prosjektId: string; oppgaveId: string }>();
  const router = useRouter();

  const {
    oppgave,
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
  } = useOppgaveSkjema(params.oppgaveId);

  // Oversettelse (Lag 2): on-demand felt-oversettelse for bruker med annet språk
  const oppgaveKildesprak = (oppgave as unknown as { template?: { project?: { sourceLanguage?: string } } })?.template?.project?.sourceLanguage;
  const {
    oversettelser,
    laster: oversettelseLaster,
    visOversettKnapp,
    oversettFelt,
  } = useOversettelse(
    params.prosjektId,
    oppgaveKildesprak,
    (oppgave?.template?.objects ?? []) as { id: string; label: string; config: Record<string, unknown> }[],
  );

  // Hent full oppgavedata for tidslinje/creator (cast for TS2589)
  const { data: fullOppgaveRå } = trpc.oppgave.hentMedId.useQuery(
    { id: params.oppgaveId },
    { enabled: !!params.oppgaveId },
  );

  const utils = trpc.useUtils();

  const endreStatusMutasjon = trpc.oppgave.endreStatus.useMutation({
    onSuccess: () => {
      utils.oppgave.hentMedId.invalidate({ id: params.oppgaveId });
      utils.oppgave.hentForProsjekt.invalidate();
    },
  });

  // Mottaker-valg: medlemmer og grupper for «Send»
  const { data: _prosjektMedlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const { data: _prosjektGrupper } = trpc.gruppe.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  const mottakerValg = (() => {
    const medlemGruppeMap = new Map<string, string[]>();
    const grupperRå = (_prosjektGrupper ?? []) as Array<{ id: string; name: string; members: Array<{ projectMember: { id: string } }> }>;
    for (const g of grupperRå) {
      for (const m of g.members ?? []) {
        const pmId = m.projectMember?.id;
        if (!pmId) continue;
        const eks = medlemGruppeMap.get(pmId) ?? [];
        eks.push(g.name);
        medlemGruppeMap.set(pmId, eks);
      }
    }
    const personer = ((_prosjektMedlemmer ?? []) as Array<{ id: string; user: { id: string; name: string | null; email: string } }>).map((m) => ({
      id: m.user.id,
      navn: m.user.name ?? m.user.email,
      grupper: medlemGruppeMap.get(m.id)?.join(", "),
    }));
    const grupper = grupperRå.map((g) => ({ id: g.id, navn: g.name }));
    return { personer, grupper };
  })();

  const oppdaterLokasjonMutasjon = trpc.oppgave.oppdater.useMutation({
    onSuccess: () => {
      utils.oppgave.hentMedId.invalidate({ id: params.oppgaveId });
    },
  });

  const slettMutasjon = trpc.oppgave.slett.useMutation({
    onSuccess: () => {
      utils.oppgave.hentForProsjekt.invalidate();
      router.push(`/dashbord/${params.prosjektId}/oppgaver`);
    },
  });

  // Bygg trestruktur og flat ut i DFS-rekkefølge
  const objekter = useMemo(() => {
    const rå = (oppgave?.template?.objects ?? []) as RapportObjekt[];
    const sortert = [...rå].sort((a, b) => {
      const zoneA = (a.config as Record<string, unknown>)?.zone === "topptekst" ? 0 : 1;
      const zoneB = (b.config as Record<string, unknown>)?.zone === "topptekst" ? 0 : 1;
      if (zoneA !== zoneB) return zoneA - zoneB;
      return a.sortOrder - b.sortOrder;
    });

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
  }, [oppgave]);

  // Finn barn av repeatere
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

  // Oppgavenummer med prefiks
  const oppgaveNummer = useMemo(() => {
    if (oppgave?.number == null) return null;
    const nummerPad = String(oppgave.number).padStart(3, "0");
    return oppgave.template?.prefix ? `${oppgave.template.prefix}-${nummerPad}` : nummerPad;
  }, [oppgave?.number, oppgave?.template?.prefix]);

  const leseModus = !erRedigerbar;

  if (erLaster) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!oppgave) {
    return <p className="py-12 text-center text-gray-500">Oppgaven ble ikke funnet.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl pb-12">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          {oppgaveNummer && (
            <span className="text-sm font-mono text-gray-400">{oppgaveNummer}</span>
          )}
          <h3 className="text-xl font-bold">{oppgave.title}</h3>
          <StatusBadge status={oppgave.status} />
          <Badge variant={PRIORITETS_VARIANT[oppgave.priority] ?? "default"}>
            {PRIORITETS_TEKST[oppgave.priority] ?? oppgave.priority}
          </Badge>
          <LagreIndikator status={lagreStatus} />
          <div className="ml-auto flex items-center gap-2 print-skjul">
            <button
              onClick={() => window.open(`/utskrift/oppgave/${params.oppgaveId}`, "_blank")}
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
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          {oppgave.template && <span>Mal: {oppgave.template.name}</span>}
          {oppgave.creatorEnterprise && (
            <span>&middot; Oppretter: {oppgave.creatorEnterprise.name}</span>
          )}
          {oppgave.responderEnterprise && (
            <span>&middot; Svarer: {oppgave.responderEnterprise.name}</span>
          )}
        </div>
        {oppgave.description && (
          <p className="mt-2 text-sm text-gray-600">{oppgave.description}</p>
        )}

        {/* Lokasjon */}
        <div className="mt-3 max-w-md print-skjul">
          <LokasjonVelger
            prosjektId={params.prosjektId}
            tegningId={(oppgave as unknown as { drawingId?: string | null }).drawingId}
            tegningNavn={(oppgave as unknown as { drawing?: { name?: string } | null }).drawing?.name}
            bygningNavn={(oppgave as unknown as { drawing?: { building?: { name?: string } | null } | null }).drawing?.building?.name}
            positionX={(oppgave as unknown as { positionX?: number | null }).positionX}
            positionY={(oppgave as unknown as { positionY?: number | null }).positionY}
            visPosisjon
            onLagre={(data) => {
              oppdaterLokasjonMutasjon.mutate({
                id: params.oppgaveId,
                drawingId: data.drawingId,
                positionX: data.positionX ?? null,
                positionY: data.positionY ?? null,
              });
            }}
            leseModus={!erRedigerbar}
          />
        </div>

        {/* Statushandlinger */}
        <div className="mt-3">
          <StatusHandlinger
            status={oppgave.status}
            erLaster={endreStatusMutasjon.isPending || slettMutasjon.isPending}
            onEndreStatus={(nyStatus, kommentar, mottaker) => {
              endreStatusMutasjon.mutate({
                id: params.oppgaveId,
                nyStatus: nyStatus as "draft" | "sent" | "received" | "in_progress" | "responded" | "approved" | "rejected" | "closed" | "cancelled",
                senderId: oppgave.id,
                kommentar,
                recipientUserId: mottaker?.userId,
                recipientGroupId: mottaker?.groupId,
              });
            }}
            onSlett={() => slettMutasjon.mutate({ id: params.oppgaveId })}
            mottakerValg={mottakerValg}
          />
        </div>
      </div>

      {/* Rapportobjekter */}
      {objekter.length > 0 && (
        <div className="flex flex-col gap-3">
          {objekter.map((objekt) => {
            if (repeaterBarnIder.has(objekt.id)) return null;
            if (!erSynlig(objekt)) return null;
            if (!leseModus && SKJULT_I_UTFYLLING.has(objekt.type)) return null;

            const erDisplay = DISPLAY_TYPER.has(objekt.type);
            const nestingNivå = hentNestingNivå(objekt, objekter);
            const feltVerdi = hentFeltVerdi(objekt.id);

            if (erDisplay) {
              const marginKlasse = nestingNivå > 0
                ? nestingNivå === 1 ? "ml-4" : nestingNivå === 2 ? "ml-8" : "ml-12"
                : "";
              return (
                <div key={objekt.id} className={marginKlasse}>
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

            return (
              <div key={objekt.id}>
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
      )}

      {/* Dialog */}
      <DialogSeksjon oppgaveId={params.oppgaveId} />

      {/* Tidslinje */}
      {fullOppgaveRå && (
        <DokumentTidslinje
          overforinger={((fullOppgaveRå as { transfers?: unknown[] }).transfers ?? []) as Array<{
            id: string; fromStatus: string; toStatus: string; comment: string | null; createdAt: string;
            sender?: { id: string; name: string | null } | null;
            recipientUser?: { id: string; name: string | null } | null;
            recipientGroup?: { id: string; name: string | null } | null;
          }>}
          opprettetAv={(fullOppgaveRå as { creator?: { name?: string | null } }).creator?.name ?? null}
          opprettetDato={(fullOppgaveRå as { createdAt?: string }).createdAt ?? null}
        />
      )}
    </div>
  );
}
