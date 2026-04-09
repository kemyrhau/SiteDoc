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
  // /uploads/uuid.png → /api/uploads/uuid.png (Next.js rewrite til API)
  if (url.startsWith("/uploads/")) return `/api${url}`;
  return url;
}

function vedleggSrc(url: string): string {
  if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/uploads/")) return `/api${url}`;
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
    createdAt?: string;
  } | undefined;

  const { data: prosjekt, isLoading: prosjektLaster } = trpc.prosjekt.hentMedId.useQuery(
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

  const dato = sjekkliste?.createdAt
    ? new Date(sjekkliste.createdAt).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" })
    : new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const klokkeslett = sjekkliste?.createdAt
    ? new Date(sjekkliste.createdAt).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
    : "";

  if (isLoading || prosjektLaster) {
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
        {/* Header — styrt av utskriftsinnstillinger */}
        {(() => {
          const ui = (prosjekt as unknown as { utskriftsinnstillinger?: Record<string, boolean> | null })?.utskriftsinnstillinger;
          const vis = (felt: string) => ui?.[felt] ?? true;
          const prosjektnummer = vis("eksternProsjektnummer") && prosjekt?.externalProjectNumber
            ? prosjekt.externalProjectNumber
            : (prosjekt as { showInternalProjectNumber?: boolean } | undefined)?.showInternalProjectNumber !== false
              ? prosjekt?.projectNumber
              : null;
          const lokTegn: string[] = [];
          if (vis("lokasjon") && sjekkliste.byggeplass?.name) lokTegn.push(sjekkliste.byggeplass.name);
          if (vis("tegningsnummer") && sjekkliste.drawing) {
            lokTegn.push(sjekkliste.drawing.drawingNumber
              ? `${sjekkliste.drawing.drawingNumber} ${sjekkliste.drawing.name}`
              : sjekkliste.drawing.name);
          }
          const logoUrl = vis("logo") && prosjekt?.logoUrl ? logoSrc(prosjekt.logoUrl) : null;
          // eslint-disable-next-line no-console
          console.log("[Utskrift] prosjekt.logoUrl:", prosjekt?.logoUrl, "→ logoUrl:", logoUrl);
          return (
            <div className="mb-6 border border-gray-300 print-no-break">
              {/* Rad 1: Logo + prosjektnummer + lokasjon + dato */}
              <div className="flex items-start justify-between border-b border-gray-300 px-4 py-2">
                <div className="flex items-start gap-4">
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt="Firmalogo"
                      className="h-[50px] w-auto shrink-0 object-contain"
                    />
                  )}
                  <div>
                    {(prosjektnummer || vis("prosjektnavn")) && (
                      <p className="text-base font-bold text-gray-900">
                        {prosjektnummer}{prosjektnummer && vis("prosjektnavn") && " · "}{vis("prosjektnavn") && (prosjekt?.name ?? "")}
                      </p>
                    )}
                    {lokTegn.length > 0 && (
                      <p className="text-xs text-gray-500">{lokTegn.join(" · ")}</p>
                    )}
                  </div>
                </div>
                <p className="whitespace-nowrap text-xs text-gray-600">{dato}{klokkeslett && ` ${klokkeslett}`}</p>
              </div>

              {/* Rad 2: Dokumenttittel + Fra→Til + nummer */}
              <div className="flex items-center justify-between border-b border-gray-300 px-4 py-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{sjekkliste.title}</p>
                  {vis("fraTil") && sjekkliste.bestillerEnterprise && (
                    <p className="text-xs text-gray-600">
                      {sjekkliste.bestiller?.name
                        ? `${sjekkliste.bestiller.name} (${sjekkliste.bestillerEnterprise.name})`
                        : sjekkliste.bestillerEnterprise.name}
                      {sjekkliste.utforerEnterprise && ` → ${sjekkliste.utforerEnterprise.name}`}
                    </p>
                  )}
                </div>
                {sjekklisteNummer && (
                  <p className="text-sm font-medium text-gray-700">{sjekklisteNummer}</p>
                )}
              </div>

              {/* Rad 3: Vær */}
              {vis("vaer") && vaerTekst && (
                <div className="px-4 py-1.5">
                  <p className="text-xs text-gray-600">{vaerTekst}</p>
                </div>
              )}
            </div>
          );
        })()}

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
        <div className="bilde-grid mt-1">
          {bilder.map((bilde) => (
            <div key={bilde.id} className="bilde-celle">
              <img
                src={vedleggSrc(bilde.url)}
                alt={bilde.filnavn}
                className="rounded border border-gray-200"
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
