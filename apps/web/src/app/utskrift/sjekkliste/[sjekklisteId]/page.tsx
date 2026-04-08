"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { Printer, ExternalLink } from "lucide-react";
import { RapportObjektVisning, TegningPosisjonPrint } from "@/components/RapportObjektVisning";
import { byggObjektTre } from "@sitedoc/shared/types";
import type { Vedlegg } from "@/components/rapportobjekter/typer";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface SjekklisteData {
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
/*  Logo-URL-hjelper                                                   */
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

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function UtskriftSjekklisteSide() {
  const params = useParams<{ sjekklisteId: string }>();

  const { data: sjekklisteRå, isLoading } = trpc.sjekkliste.hentMedId.useQuery(
    { id: params.sjekklisteId },
    { enabled: !!params.sjekklisteId },
  );

  const sjekkliste = sjekklisteRå as {
    id: string;
    title: string;
    status: string;
    number?: number | null;
    data?: unknown;
    projectId: string;
    template: {
      name: string;
      prefix?: string | null;
      objects: RapportObjektRå[];
    };
    bestillerEnterprise?: { name: string } | null;
    utforerEnterprise?: { name: string } | null;
    bestiller?: { name?: string | null } | null;
    byggeplass?: { id: string; name: string } | null;
    drawingId?: string | null;
    positionX?: number | null;
    positionY?: number | null;
    drawing?: { id: string; name: string; drawingNumber: string | null } | null;
  } | undefined;

  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: sjekkliste?.projectId ?? "" },
    { enabled: !!sjekkliste?.projectId },
  );

  const data = (sjekkliste?.data ?? {}) as SjekklisteData;

  const treObjekter = useMemo(() => {
    const objekter = sjekkliste?.template?.objects ?? [];
    return byggObjektTre(objekter) as TreNode[];
  }, [sjekkliste?.template?.objects]);

  // Sjekkliste-nummer med prefiks
  const sjekklisteNummer = useMemo(() => {
    const nummer = sjekkliste?.number;
    const prefix = sjekkliste?.template?.prefix;
    if (nummer == null) return null;
    const nummerPad = String(nummer).padStart(3, "0");
    return prefix ? `${prefix}-${nummerPad}` : nummerPad;
  }, [sjekkliste?.number, sjekkliste?.template?.prefix]);

  // Vær-tekst
  const vaerTekst = useMemo(() => {
    const vaerObjekt = sjekkliste?.template?.objects?.find((o) => o.type === "weather");
    if (!vaerObjekt) return null;
    const vaerData = data[vaerObjekt.id]?.verdi as {
      temp?: string;
      conditions?: string;
      wind?: string;
      precipitation?: string;
    } | null;
    if (!vaerData) return null;
    const deler: string[] = [];
    if (vaerData.temp) deler.push(vaerData.temp);
    if (vaerData.conditions) deler.push(vaerData.conditions);
    if (vaerData.wind) deler.push(`Vind ${vaerData.wind}`);
    if (vaerData.precipitation) deler.push(`Nedbør ${vaerData.precipitation}`);
    return deler.length > 0 ? deler.join(", ") : null;
  }, [sjekkliste?.template?.objects, data]);

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

  if (!sjekkliste) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Sjekklisten ble ikke funnet.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-16">
      {/* Flytende verktøylinje */}
      <div className="print-skjul sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <h1 className="mr-auto text-sm font-medium text-gray-700">
            Forhåndsvisning — {sjekkliste.title}
          </h1>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <Printer className="h-4 w-4" />
            Skriv ut / Lagre PDF
          </button>
          {sjekkliste.projectId && (
            <a
              href={`/dashbord/${sjekkliste.projectId}/sjekklister/${sjekkliste.id}`}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" />
              Åpne sjekkliste
            </a>
          )}
        </div>
      </div>

      {/* A4-ark — 210mm bredde, 15mm padding matcher @page margin */}
      <div className="a4-ark mx-auto mt-8 min-h-[297mm] w-[794px] rounded bg-white px-[15mm] py-[15mm] shadow-lg print:mt-0 print:min-h-0 print:w-auto print:max-w-none print:rounded-none print:px-0 print:py-0 print:shadow-none">
        {/* Header (alltid synlig — ikke .print-header) */}
        <div className="mb-6 border border-gray-300 print-no-break">
          {/* Rad 1: Prosjekt med logo */}
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
                {(sjekkliste.byggeplass || sjekkliste.drawing) && (
                  <p className="text-xs text-gray-500">
                    {sjekkliste.byggeplass && <>Lokasjon: {sjekkliste.byggeplass.name}</>}
                    {sjekkliste.byggeplass && sjekkliste.drawing && <> &middot; </>}
                    {sjekkliste.drawing && (
                      <>Tegning: {sjekkliste.drawing.drawingNumber ? `${sjekkliste.drawing.drawingNumber} ` : ""}{sjekkliste.drawing.name}</>
                    )}
                  </p>
                )}
              </div>
            </div>
            <p className="whitespace-nowrap text-xs text-gray-600">Dato: {dato}</p>
          </div>

          {/* Rad 2: Sjekkliste */}
          <div className="flex items-center justify-between border-b border-gray-300 px-4 py-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Sjekkliste: {sjekkliste.title}
              </p>
              <p className="text-xs text-gray-600">
                {sjekkliste.bestillerEnterprise && (
                  <>
                    Oppretter: {sjekkliste.bestillerEnterprise.name}
                    {sjekkliste.bestiller?.name && ` (${sjekkliste.bestiller.name})`}
                  </>
                )}
                {sjekkliste.bestillerEnterprise && sjekkliste.utforerEnterprise && <> &middot; </>}
                {sjekkliste.utforerEnterprise && (
                  <>Svarer: {sjekkliste.utforerEnterprise.name}</>
                )}
              </p>
            </div>
            {sjekklisteNummer && (
              <p className="text-sm font-medium text-gray-700">Nr: {sjekklisteNummer}</p>
            )}
          </div>

          {/* Rad 3: Vær */}
          {vaerTekst && (
            <div className="px-4 py-2">
              <p className="text-xs text-gray-600">Vær: {vaerTekst}</p>
            </div>
          )}
        </div>

        {/* Lokasjonstegning med posisjon */}
        {sjekkliste.drawingId && sjekkliste.positionX != null && sjekkliste.positionY != null && (
          <div className="mb-3 print-no-break">
            <TegningPosisjonPrint pos={{
              drawingId: sjekkliste.drawingId,
              positionX: sjekkliste.positionX,
              positionY: sjekkliste.positionY,
              drawingName: sjekkliste.drawing?.name,
            }} />
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
                  prosjektAdresse={prosjekt?.address}
                />
                {/* Vedlegg under hvert felt */}
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
    <div className="ml-0 mt-1 border-t border-gray-100 pt-1 print-no-break">
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
