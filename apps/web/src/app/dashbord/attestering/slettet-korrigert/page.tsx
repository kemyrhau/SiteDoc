"use client";

// SL2 (plan web-timeføring § 4.18 del B; vedtak-timer-web § Slettet og korrigert punkt 1–2): siden
// «Slettet og korrigert» for attestanten — bare lesing, utenfor attesteringskortet. Åpnes fra
// lenken øverst i Attestering (uka attestanten står i) og fra merket «N slettet» på dagsraden
// (dagen og den ansatte). Omfang og navneskjul er attesteringens (`slettetOgKorrigert`).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Spinner } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";
import { useAttesteringsFirma } from "@/components/attestering/useAttesteringsFirma";
import { isoUke } from "@/components/attestering/ukevalg";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { lokalIsoDato } from "@/lib/tilbake-adresse";
import { SlettetKorrigertVisning, type SkDag } from "@/components/timer/SlettetKorrigertVisning";

/** Mandagen i uka `offset` uker fra denne (samme regel som Attestering). */
function ukestart(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dag = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - dag + offset * 7);
  return d;
}

export default function SlettetKorrigertAttestering() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { orgId, firmaer, laster: firmaLaster } = useAttesteringsFirma();
  const [ukeOffset, setUkeOffset] = useState<number>(() => {
    const u = Number(searchParams.get("uke"));
    return Number.isInteger(u) ? u : 0;
  });
  const [dag, setDag] = useState<string | null>(() => {
    const d = searchParams.get("dag");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  });
  const startAnsatt = searchParams.get("ansatt");

  const fra = useMemo(() => ukestart(ukeOffset), [ukeOffset]);
  const til = useMemo(() => {
    const d = new Date(fra);
    d.setDate(d.getDate() + 6);
    return d;
  }, [fra]);

  const { data: tilgang, isLoading: tilgangLaster } = trpc.timer.dagsseddel.kanAttestereFirma.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  const kanAttestere = !!tilgang && tilgang.omfang !== "ingen";
  const { data, isLoading } = trpc.timer.dagsseddel.slettetOgKorrigert.useQuery(
    { organizationId: orgId!, fraOgMed: lokalIsoDato(fra), tilOgMed: lokalIsoDato(til) },
    { enabled: !!orgId && kanAttestere },
  );

  // Tilbake til Attestering på samme uke (og firma når det er flere).
  const tilbake = useMemo(() => {
    const p = new URLSearchParams({ uke: String(ukeOffset) });
    if (firmaer.length > 1 && orgId) p.set("firma", orgId);
    return `/dashbord/attestering?${p.toString()}`;
  }, [ukeOffset, firmaer.length, orgId]);

  if (firmaLaster || tilgangLaster) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (!orgId || !kanAttestere) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mr-1 inline-block h-4 w-4" />
        {t("timer.attestering.ingenTilgangFirma")}
      </div>
    );
  }

  const byttUke = (delta: number) => {
    setUkeOffset((o) => o + delta);
    setDag(null);
  };
  const ukeNr = isoUke(fra).uke;
  const periode = (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => byttUke(-1)} className="rounded border border-gray-300 p-1 hover:bg-gray-50" aria-label={t("timer.attestering.uke.label", { nr: isoUke(new Date(fra.getTime() - 7 * 86_400_000)).uke })}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[80px] text-center text-sm font-medium text-gray-900">{t("timer.attestering.uke.label", { nr: ukeNr })}</span>
      <button type="button" onClick={() => byttUke(1)} className="rounded border border-gray-300 p-1 hover:bg-gray-50" aria-label={t("timer.attestering.uke.label", { nr: isoUke(new Date(fra.getTime() + 7 * 86_400_000)).uke })}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <SonetonetSidehode sone="firma" className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href={tilbake} className="text-sm text-blue-600 hover:underline">
              ‹ {t("timer.attestering.tittel")}
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">{t("timer.slettetKorrigert.tittel")}</h1>
            <p className="mt-1 text-sm text-gray-600">{t("timer.slettetKorrigert.beskrivelse")}</p>
          </div>
          <HjelpKnapp>
            <HjelpFane tittel={t("timer.slettetKorrigert.tittel")}>
              <p>{t("timer.slettetKorrigert.hjelp.hva")}</p>
              <p className="mt-2">{t("timer.slettetKorrigert.hjelp.ikkeMed")}</p>
              <p className="mt-2">{t("timer.slettetKorrigert.hjelp.hvem")}</p>
              <p className="mt-2">{t("timer.slettetKorrigert.hjelp.merke")}</p>
              <p className="mt-2">{t("timer.slettetKorrigert.hjelp.filter")}</p>
            </HjelpFane>
          </HjelpKnapp>
        </div>
      </SonetonetSidehode>
      <SlettetKorrigertVisning
        dager={data as unknown as SkDag[] | undefined}
        laster={isLoading}
        periode={periode}
        medAnsatt
        dag={dag}
        onFjernDag={() => setDag(null)}
        startAnsatt={startAnsatt}
      />
    </div>
  );
}
