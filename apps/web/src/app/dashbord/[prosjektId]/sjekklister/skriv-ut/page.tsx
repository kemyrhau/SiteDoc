"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useMemo, useEffect, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { Printer, ArrowLeft } from "lucide-react";
import { PrintHeader } from "@/components/PrintHeader";
import { RapportObjektVisning } from "@/components/RapportObjektVisning";
import { byggObjektTre } from "@sitedoc/shared/types";
import type { RapportObjekt } from "@sitedoc/pdf";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";
import { useTranslation } from "react-i18next";

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
  bestillerFaggruppe?: { name: string } | null;
  utforerFaggruppe?: { name: string } | null;
  bestiller?: { name?: string | null } | null;
}

export default function SkrivUtFlereSide() {
  useToppbarFiltre({ byggeplass: false });
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const iderParam = searchParams.get("ider") ?? "";
  const ider = iderParam.split(",").filter(Boolean);

  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  // Hver sjekkliste hentes av sin egen <SjekklistePrintLaster> (ett fast hook-kall
  // per komponent) og rapporteres opp hit. Ingen øvre grense på antall — tidligere
  // hardkodede q0–q9 kappet stille ved >10.
  const [lastet, setLastet] = useState<Record<string, SjekklistePrintData | null>>({});
  const rapporterLastet = useCallback((id: string, data: SjekklistePrintData | null) => {
    setLastet((prev) => (id in prev && prev[id] === data ? prev : { ...prev, [id]: data }));
  }, []);

  if (ider.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-gray-500">{t("print.ingenValgt")}</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("handling.tilbake")}
        </button>
      </div>
    );
  }

  // Gate: vis print-innhold først når ALLE valgte er ferdig hentet (ingen print-før-klar)
  const erLaster = ider.some((id) => !(id in lastet));
  const sjekklister: SjekklistePrintData[] = ider
    .map((id) => lastet[id])
    .filter((d): d is SjekklistePrintData => d != null);

  return (
    <div>
      {/* Skjulte lastere — holdes montert også under lasting så hentingen faktisk kjører */}
      {ider.map((id) => (
        <SjekklistePrintLaster key={id} id={id} onLastet={rapporterLastet} />
      ))}

      {erLaster ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Verktøylinje: skjules ved print */}
          <div className="print-skjul mb-6 flex items-center gap-3 border-b border-gray-200 pb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("handling.tilbake")}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
            >
              <Printer className="h-4 w-4" />
              {t("print.skrivUtAntall", { antall: sjekklister.length })}
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
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Laster én sjekkliste og rapporterer resultatet opp                 */
/* ------------------------------------------------------------------ */

function SjekklistePrintLaster({
  id,
  onLastet,
}: {
  id: string;
  onLastet: (id: string, data: SjekklistePrintData | null) => void;
}) {
  const q = trpc.sjekkliste.hentMedId.useQuery({ id }, { enabled: !!id });
  const ferdig = !q.isLoading;
  const data = q.data as SjekklistePrintData | undefined;
  useEffect(() => {
    if (ferdig) onLastet(id, data ?? null);
  }, [ferdig, data, id, onLastet]);
  return null;
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
  const { t } = useTranslation();
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
          bestiller={sjekkliste.bestillerFaggruppe?.name}
          bestillerBruker={sjekkliste.bestiller?.name ?? null}
          utforer={sjekkliste.utforerFaggruppe?.name}
          vaerTekst={vaerTekst}
          logoUrl={prosjekt?.logoUrl}
          prosjektAdresse={prosjekt?.address}
          status={sjekkliste.status}
        />

        {/* Skjerm-header for denne sjekklisten (skjules ved print) */}
        <div className="print-skjul mb-4 border-b border-gray-200 pb-3">
          <h3 className="text-lg font-bold text-gray-900">{sjekkliste.title}</h3>
          <p className="text-sm text-gray-500">
            {t("print.mal")}: {sjekkliste.template.name}
            {sjekkliste.bestillerFaggruppe && (
              <> &middot; {t("tabell.bestiller")}: {sjekkliste.bestillerFaggruppe.name}</>
            )}
            {sjekkliste.utforerFaggruppe && (
              <> &middot; {t("tabell.utforer")}: {sjekkliste.utforerFaggruppe.name}</>
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
