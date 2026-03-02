"use client";

import { useParams } from "next/navigation";
import { useMemo, useCallback } from "react";
import { Spinner, StatusBadge, Card } from "@siteflow/ui";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSjekklisteSkjema } from "@/hooks/useSjekklisteSkjema";
import { useAutoVaer } from "@/hooks/useAutoVaer";
import { RapportObjektRenderer, DISPLAY_TYPER } from "@/components/rapportobjekter/RapportObjektRenderer";
import { FeltWrapper } from "@/components/rapportobjekter/FeltWrapper";
import type { RapportObjekt } from "@/components/rapportobjekter/typer";

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

export default function SjekklisteDetaljSide() {
  const params = useParams<{ prosjektId: string; sjekklisteId: string }>();

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

  const objekter = useMemo(
    () => (sjekkliste?.template?.objects ?? []) as RapportObjekt[],
    [sjekkliste],
  );

  // Automatisk værhenting basert på prosjektkoordinater og dato
  useAutoVaer({
    prosjektId: params.prosjektId,
    alleObjekter: objekter,
    hentFeltVerdi,
    settVerdi,
  });

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

  return (
    <div className="mx-auto max-w-3xl pb-12">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold">{sjekkliste.title}</h3>
          <StatusBadge status={sjekkliste.status} />
          <LagreIndikator status={lagreStatus} />
        </div>
        <p className="text-sm text-gray-500">
          Mal: {sjekkliste.template.name}
          {sjekkliste.responderEnterprise && (
            <> &middot; Svarer: {sjekkliste.responderEnterprise.name}</>
          )}
        </p>
      </div>

      {/* Rapportobjekter */}
      <div className="flex flex-col gap-3">
        {objekter.map((objekt) => {
          if (!erSynlig(objekt)) return null;

          const erDisplay = DISPLAY_TYPER.has(objekt.type);
          const nestingNivå = hentNestingNivå(objekt, objekter);
          const feltVerdi = hentFeltVerdi(objekt.id);

          // Display-typer rendres uten wrapper
          if (erDisplay) {
            const marginKlasse = nestingNivå > 0
              ? nestingNivå === 1 ? "ml-4" : nestingNivå === 2 ? "ml-8" : "ml-12"
              : "";
            const rammeKlasse = nestingNivå > 0 ? "border-l-2 border-l-blue-300 pl-4" : "";
            return (
              <div key={objekt.id} className={`${marginKlasse} ${rammeKlasse}`}>
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
            <FeltWrapper
              key={objekt.id}
              objekt={objekt}
              kommentar={feltVerdi.kommentar}
              vedlegg={feltVerdi.vedlegg}
              onEndreKommentar={(k) => settKommentar(objekt.id, k)}
              onLeggTilVedlegg={(v) => leggTilVedlegg(objekt.id, v)}
              onFjernVedlegg={(id) => fjernVedlegg(objekt.id, id)}
              leseModus={leseModus}
              nestingNivå={nestingNivå}
              valideringsfeil={valideringsfeil[objekt.id]}
            >
              <RapportObjektRenderer
                objekt={objekt}
                verdi={feltVerdi.verdi}
                onEndreVerdi={(v) => settVerdi(objekt.id, v)}
                leseModus={leseModus}
                prosjektId={params.prosjektId}
              />
            </FeltWrapper>
          );
        })}
      </div>

      {/* Historikk */}
      {sjekkliste && (
        <HistorikkSeksjon sjekklisteId={params.sjekklisteId} />
      )}
    </div>
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
          <div key={overgang.id} className="flex items-center gap-3 text-sm">
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
