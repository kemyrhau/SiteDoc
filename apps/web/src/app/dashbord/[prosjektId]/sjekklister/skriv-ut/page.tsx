"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { Printer, ArrowLeft } from "lucide-react";
import { PrintHeader } from "@/components/PrintHeader";
import { RapportObjektVisning } from "@/components/RapportObjektVisning";
import { byggObjektTre } from "@sitedoc/shared/types";
import type { RapportObjekt } from "@sitedoc/pdf";

interface SjekklisteData {
  [objektId: string]: {
    verdi?: unknown;
    kommentar?: string;
    vedlegg?: unknown[];
  };
}

interface TreNode extends RapportObjekt {
  children: TreNode[];
}

interface SjekklistePrintData {
  id: string;
  title: string;
  status: string;
  number?: number | null;
  data?: unknown;
  template: {
    name: string;
    prefix?: string | null;
    objects: RapportObjekt[];
  };
  bestillerEnterprise?: { name: string } | null;
  utforerEnterprise?: { name: string } | null;
  bestiller?: { name?: string | null } | null;
}

export default function SkrivUtFlereSide() {
  const params = useParams<{ prosjektId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const iderParam = searchParams.get("ider") ?? "";
  const ider = iderParam.split(",").filter(Boolean);

  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  // Hent alle sjekklister parallelt (cast for TS2589)
  const q0 = trpc.sjekkliste.hentMedId.useQuery({ id: ider[0] ?? "" }, { enabled: ider.length > 0 });
  const q1 = trpc.sjekkliste.hentMedId.useQuery({ id: ider[1] ?? "" }, { enabled: ider.length > 1 });
  const q2 = trpc.sjekkliste.hentMedId.useQuery({ id: ider[2] ?? "" }, { enabled: ider.length > 2 });
  const q3 = trpc.sjekkliste.hentMedId.useQuery({ id: ider[3] ?? "" }, { enabled: ider.length > 3 });
  const q4 = trpc.sjekkliste.hentMedId.useQuery({ id: ider[4] ?? "" }, { enabled: ider.length > 4 });
  const q5 = trpc.sjekkliste.hentMedId.useQuery({ id: ider[5] ?? "" }, { enabled: ider.length > 5 });
  const q6 = trpc.sjekkliste.hentMedId.useQuery({ id: ider[6] ?? "" }, { enabled: ider.length > 6 });
  const q7 = trpc.sjekkliste.hentMedId.useQuery({ id: ider[7] ?? "" }, { enabled: ider.length > 7 });
  const q8 = trpc.sjekkliste.hentMedId.useQuery({ id: ider[8] ?? "" }, { enabled: ider.length > 8 });
  const q9 = trpc.sjekkliste.hentMedId.useQuery({ id: ider[9] ?? "" }, { enabled: ider.length > 9 });

  const alleQueries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9].slice(0, ider.length) as Array<{ isLoading: boolean; data: unknown }>;
  const erLaster = alleQueries.some((q) => q.isLoading);
  const sjekklister: SjekklistePrintData[] = alleQueries
    .map((q) => q.data as SjekklistePrintData | undefined)
    .filter((d): d is SjekklistePrintData => d != null);

  if (ider.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-gray-500">Ingen sjekklister valgt for utskrift.</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake
        </button>
      </div>
    );
  }

  if (erLaster) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Verktøylinje: skjules ved print */}
      <div className="print-skjul mb-6 flex items-center gap-3 border-b border-gray-200 pb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
        >
          <Printer className="h-4 w-4" />
          Skriv ut ({sjekklister.length} sjekklister)
        </button>
      </div>

      {/* Sjekklister */}
      {sjekklister.map((sjekkliste, indeks) => (
        <SjekklistePrint
          key={sjekkliste.id}
          sjekkliste={sjekkliste}
          prosjekt={prosjekt}
          erSiste={indeks === sjekklister.length - 1}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Enkelt sjekkliste i print-visning                                  */
/* ------------------------------------------------------------------ */

function SjekklistePrint({
  sjekkliste,
  prosjekt,
  erSiste,
}: {
  sjekkliste: SjekklistePrintData;
  prosjekt?: {
    name: string;
    projectNumber: string;
    externalProjectNumber?: string | null;
    logoUrl?: string | null;
    address?: string | null;
  } | null;
  erSiste: boolean;
}) {
  const data = (sjekkliste.data ?? {}) as SjekklisteData;

  // Bygg objekttre
  const treObjekter = useMemo(() => {
    const objekter = sjekkliste.template.objects ?? [];
    return byggObjektTre(objekter) as TreNode[];
  }, [sjekkliste.template.objects]);

  // Sjekkliste-nummer med prefiks
  const sjekklisteNummer = useMemo(() => {
    const nummer = sjekkliste.number;
    const prefix = sjekkliste.template.prefix;
    if (nummer == null) return null;
    const nummerPad = String(nummer).padStart(3, "0");
    return prefix ? `${prefix}-${nummerPad}` : nummerPad;
  }, [sjekkliste.number, sjekkliste.template.prefix]);

  // Finn vær-tekst
  const vaerTekst = useMemo(() => {
    const vaerObjekt = sjekkliste.template.objects.find((o) => o.type === "weather");
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
  }, [sjekkliste.template.objects, data]);

  return (
    <div className={erSiste ? "" : "print-sideskift"}>
      <div className="mx-auto max-w-3xl pb-8">
        <PrintHeader
          prosjektnavn={prosjekt?.name ?? ""}
          prosjektnummer={prosjekt?.projectNumber ?? ""}
          eksterntNummer={prosjekt?.externalProjectNumber}
          sjekklisteTittel={sjekkliste.title}
          sjekklisteNummer={sjekklisteNummer}
          bestiller={sjekkliste.bestillerEnterprise?.name}
          bestillerBruker={sjekkliste.bestiller?.name ?? null}
          utforer={sjekkliste.utforerEnterprise?.name}
          vaerTekst={vaerTekst}
          logoUrl={prosjekt?.logoUrl}
          prosjektAdresse={prosjekt?.address}
          status={sjekkliste.status}
        />

        {/* Skjerm-header for denne sjekklisten (skjules ved print) */}
        <div className="print-skjul mb-4 border-b border-gray-200 pb-3">
          <h3 className="text-lg font-bold text-gray-900">{sjekkliste.title}</h3>
          <p className="text-sm text-gray-500">
            Mal: {sjekkliste.template.name}
            {sjekkliste.bestillerEnterprise && (
              <> &middot; Bestiller: {sjekkliste.bestillerEnterprise.name}</>
            )}
            {sjekkliste.utforerEnterprise && (
              <> &middot; Utfører: {sjekkliste.utforerEnterprise.name}</>
            )}
          </p>
        </div>

        {/* Rapportobjekter i lesemodus */}
        <div className="flex flex-col gap-1">
          {treObjekter.map((objekt) => (
            <div key={objekt.id} className="print-no-break">
              <RapportObjektVisning
                objekt={objekt}
                verdi={data[objekt.id]?.verdi ?? null}
                nestingNivå={0}
                data={data}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
