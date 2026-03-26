"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { Printer, ExternalLink } from "lucide-react";
import { RapportObjektVisning } from "@/components/RapportObjektVisning";
import { byggObjektTre } from "@sitedoc/shared/types";
import type { Vedlegg } from "@/components/rapportobjekter/typer";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface OppgaveData {
  [objektId: string]: {
    verdi?: unknown;
    kommentar?: string;
    vedlegg?: Vedlegg[];
  };
}

interface RapportObjektRå {
  id: string;
  type: string;
  label: string;
  required: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
  parentId: string | null;
}

interface TreNode extends RapportObjektRå {
  children: TreNode[];
}

/* ------------------------------------------------------------------ */
/*  Hjelpefunksjoner                                                   */
/* ------------------------------------------------------------------ */

function logoSrc(url: string): string {
  if (url.startsWith("/uploads/")) return `/api/uploads${url.replace("/uploads", "")}`;
  return url;
}

function vedleggSrc(url: string): string {
  if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/uploads/")) return `/api/uploads${url.replace("/uploads", "")}`;
  return url;
}

const PRIORITETS_TEKST: Record<string, string> = {
  low: "Lav",
  medium: "Medium",
  high: "Høy",
  critical: "Kritisk",
};

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function UtskriftOppgaveSide() {
  const params = useParams<{ oppgaveId: string }>();

  const { data: oppgaveRå, isLoading } = trpc.oppgave.hentMedId.useQuery(
    { id: params.oppgaveId },
    { enabled: !!params.oppgaveId },
  );

  const oppgave = oppgaveRå as {
    id: string;
    title: string;
    status: string;
    priority: string;
    description?: string | null;
    number?: number | null;
    data?: unknown;
    projectId: string;
    template: {
      name: string;
      prefix?: string | null;
      objects: RapportObjektRå[];
      showPriority?: boolean;
    };
    creatorEnterprise?: { name: string } | null;
    responderEnterprise?: { name: string } | null;
    creator?: { name?: string | null } | null;
    drawing?: { id: string; name: string; drawingNumber: string | null; fileUrl?: string | null; building?: { id: string; name: string } | null } | null;
    positionX?: number | null;
    positionY?: number | null;
  } | undefined;

  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: oppgave?.projectId ?? "" },
    { enabled: !!oppgave?.projectId },
  );

  const data = (oppgave?.data ?? {}) as OppgaveData;

  const treObjekter = useMemo(() => {
    const objekter = oppgave?.template?.objects ?? [];
    return byggObjektTre(objekter) as TreNode[];
  }, [oppgave?.template?.objects]);

  const oppgaveNummer = useMemo(() => {
    const nummer = oppgave?.number;
    const prefix = oppgave?.template?.prefix;
    if (nummer == null) return null;
    const nummerPad = String(nummer).padStart(3, "0");
    return prefix ? `${prefix}-${nummerPad}` : nummerPad;
  }, [oppgave?.number, oppgave?.template?.prefix]);

  const dato = new Date().toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!oppgave) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Oppgaven ble ikke funnet.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-16">
      {/* Flytende verktøylinje */}
      <div className="print-skjul sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <h1 className="mr-auto text-sm font-medium text-gray-700">
            Forhåndsvisning — {oppgave.title}
          </h1>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <Printer className="h-4 w-4" />
            Skriv ut / Lagre PDF
          </button>
          {oppgave.projectId && (
            <a
              href={`/dashbord/${oppgave.projectId}/oppgaver/${oppgave.id}`}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" />
              Åpne oppgave
            </a>
          )}
        </div>
      </div>

      {/* A4-ark */}
      <div className="mx-auto mt-8 min-h-[297mm] w-[210mm] rounded bg-white px-[15mm] py-[15mm] shadow-lg print:mt-0 print:min-h-0 print:w-auto print:max-w-none print:rounded-none print:px-0 print:py-0 print:shadow-none">
        {/* Header */}
        <div className="mb-6 border border-gray-300">
          {/* Rad 1: Prosjekt */}
          <div className="flex items-start justify-between border-b border-gray-300 px-4 py-2">
            <div className="flex items-start gap-4">
              {prosjekt?.logoUrl && (
                <img
                  src={logoSrc(prosjekt.logoUrl)}
                  alt="Firmalogo"
                  className="max-h-[60px] max-w-[120px] object-contain"
                />
              )}
              <div>
                <p className="text-base font-bold text-gray-900">{prosjekt?.name ?? ""}</p>
                <p className="text-xs text-gray-600">
                  {(prosjekt as { showInternalProjectNumber?: boolean } | undefined)?.showInternalProjectNumber !== false && (
                    <>Prosjektnr: {prosjekt?.projectNumber ?? ""}</>
                  )}
                  {(prosjekt as { showInternalProjectNumber?: boolean } | undefined)?.showInternalProjectNumber !== false &&
                    prosjekt?.externalProjectNumber && <> &middot; </>}
                  {prosjekt?.externalProjectNumber && (
                    <>Ekst: {prosjekt.externalProjectNumber}</>
                  )}
                </p>
                {prosjekt?.address && (
                  <p className="text-xs text-gray-500">Adresse: {prosjekt.address}</p>
                )}
                {oppgave.drawing && (
                  <p className="text-xs text-gray-500">
                    {oppgave.drawing.building && <>Lokasjon: {oppgave.drawing.building.name} &middot; </>}
                    Tegning: {oppgave.drawing.drawingNumber ? `${oppgave.drawing.drawingNumber} ` : ""}{oppgave.drawing.name}
                  </p>
                )}
              </div>
            </div>
            <p className="whitespace-nowrap text-xs text-gray-600">Dato: {dato}</p>
          </div>

          {/* Rad 2: Oppgave */}
          <div className="flex items-center justify-between border-b border-gray-300 px-4 py-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Oppgave: {oppgave.title}
              </p>
              <p className="text-xs text-gray-600">
                {oppgave.creatorEnterprise && (
                  <>
                    Oppretter: {oppgave.creatorEnterprise.name}
                    {oppgave.creator?.name && ` (${oppgave.creator.name})`}
                  </>
                )}
                {oppgave.creatorEnterprise && oppgave.responderEnterprise && <> &middot; </>}
                {oppgave.responderEnterprise && (
                  <>Svarer: {oppgave.responderEnterprise.name}</>
                )}
              </p>
            </div>
            <div className="text-right">
              {oppgaveNummer && (
                <p className="text-sm font-medium text-gray-700">Nr: {oppgaveNummer}</p>
              )}
              {oppgave.template?.showPriority !== false && oppgave.priority && (
                <p className="text-xs text-gray-500">Prioritet: {PRIORITETS_TEKST[oppgave.priority] ?? oppgave.priority}</p>
              )}
            </div>
          </div>

          {/* Rad 3: Beskrivelse */}
          {oppgave.description && (
            <div className="px-4 py-2">
              <p className="text-xs text-gray-600">Beskrivelse: {oppgave.description}</p>
            </div>
          )}
        </div>

        {/* Tegningsutsnitt */}
        {oppgave.drawing?.fileUrl && (
          <div className="mb-3 flex gap-3 rounded border border-gray-200 p-2">
            {/* Oversiktsbilde */}
            <div className="relative w-1/2 overflow-hidden rounded border border-gray-100 bg-gray-50">
              <img
                src={`/api${oppgave.drawing.fileUrl}`}
                alt="Tegning oversikt"
                className="h-auto w-full object-contain"
                style={{ maxHeight: 250 }}
              />
              {oppgave.positionX != null && oppgave.positionY != null && (
                <div
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500"
                  style={{ left: `${oppgave.positionX}%`, top: `${oppgave.positionY}%` }}
                />
              )}
              <div className="absolute bottom-1 left-1 rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-medium text-gray-500">
                Oversikt
              </div>
            </div>
            {/* Utsnitt zoomet inn */}
            {oppgave.positionX != null && oppgave.positionY != null && (
              <div className="relative w-1/2 overflow-hidden rounded border border-gray-100 bg-gray-50">
                <div
                  className="relative"
                  style={{
                    width: "300%",
                    height: "300%",
                    transform: `translate(${50 - oppgave.positionX * 3}%, ${50 - oppgave.positionY * 3}%)`,
                    maxHeight: 250,
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={`/api${oppgave.drawing.fileUrl}`}
                    alt="Tegning utsnitt"
                    className="h-auto w-full object-contain"
                  />
                  <div
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
                    style={{ left: `${oppgave.positionX}%`, top: `${oppgave.positionY}%` }}
                  />
                </div>
                <div className="absolute bottom-1 left-1 rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-medium text-gray-500">
                  Utsnitt
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rapportobjekter */}
        <div className="flex flex-col gap-1">
          {treObjekter.map((objekt) => {
            const feltData = data[objekt.id];
            return (
              <div key={objekt.id} className="print-no-break">
                <RapportObjektVisning
                  objekt={objekt}
                  verdi={feltData?.verdi ?? null}
                  nestingNivå={0}
                  data={data}
                />
                <FeltVedlegg vedlegg={feltData?.vedlegg} kommentar={feltData?.kommentar} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Vedlegg + kommentar under hvert felt                               */
/* ------------------------------------------------------------------ */

function FeltVedlegg({
  vedlegg,
  kommentar,
}: {
  vedlegg?: Vedlegg[];
  kommentar?: string;
}) {
  const harVedlegg = vedlegg && vedlegg.length > 0;
  const harKommentar = kommentar && kommentar.length > 0;
  if (!harVedlegg && !harKommentar) return null;

  const bilder = vedlegg?.filter((v) => v.type === "bilde" || /\.(png|jpg|jpeg|gif|webp)$/i.test(v.filnavn)) ?? [];
  const filer = vedlegg?.filter((v) => !bilder.includes(v)) ?? [];

  return (
    <div className="ml-0 mt-1 border-t border-gray-100 pt-1">
      {harKommentar && (
        <p className="text-xs italic text-gray-500">{kommentar}</p>
      )}
      {bilder.length > 0 && (
        <div className="mt-1 grid grid-cols-2 gap-3">
          {bilder.map((bilde) => (
            <div key={bilde.id}>
              <img
                src={vedleggSrc(bilde.url)}
                alt={bilde.filnavn}
                className="w-full rounded border border-gray-200 object-cover"
                style={{ aspectRatio: "5/4" }}
              />
              {bilde.opprettet && (
                <p className="mt-0.5 text-[10px] text-gray-400">
                  {new Date(bilde.opprettet).toLocaleString("nb-NO")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {filer.length > 0 && (
        <p className="mt-1 text-xs text-gray-600">
          Filer: {filer.map((f) => f.filnavn).join(", ")}
        </p>
      )}
    </div>
  );
}
