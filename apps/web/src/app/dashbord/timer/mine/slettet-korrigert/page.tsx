"use client";

// SL2 (plan web-timeføring § 4.18 del B punkt 7; vedtak-timer-web § Slettet og korrigert punkt 3,
// B78 ja, L1): arbeiderens side «Slettet og korrigert», åpnet fra Mine timer. Samme side som
// attestantens, med bare egne dager: linjer andre har slettet eller korrigert, og linjer
// arbeideren selv slettet på en returnert dag. Uten ansatt-filter. Bare lesing.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Spinner } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import { useFirma } from "@/kontekst/firma-kontekst";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { lokalIsoDato, mandagI } from "@/lib/tilbake-adresse";
import { SlettetKorrigertVisning, type SkDag } from "@/components/timer/SlettetKorrigertVisning";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Serveren tar høyst 93 dager; lengre perioder kortes fra start. */
const MAKS_DAGER = 93;

// `useSearchParams()` krever en Suspense-grense ved bygging (som `attestering/layout.tsx`); grensen
// står her og ikke i en layout, så Mine timer og dagssidene under `timer/` er urørt.
export default function SlettetKorrigertMine() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      }
    >
      <SlettetKorrigertMineInnhold />
    </Suspense>
  );
}

function SlettetKorrigertMineInnhold() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id ?? undefined;
  const [fra, setFra] = useState<string>(() => {
    const f = searchParams.get("fra");
    return f && ISO.test(f) ? f : lokalIsoDato(mandagI(new Date()));
  });
  const [til, setTil] = useState<string>(() => {
    const v = searchParams.get("til");
    return v && ISO.test(v) ? v : lokalIsoDato(new Date());
  });
  const [dag, setDag] = useState<string | null>(() => {
    const d = searchParams.get("dag");
    return d && ISO.test(d) ? d : null;
  });

  const gyldig = ISO.test(fra) && ISO.test(til) && fra <= til;
  const fraForSpørring = (() => {
    if (!gyldig) return fra;
    const tilDato = new Date(`${til}T00:00:00Z`);
    const tidligst = new Date(tilDato.getTime() - MAKS_DAGER * 86_400_000).toISOString().slice(0, 10);
    return fra < tidligst ? tidligst : fra;
  })();
  const { data, isLoading } = trpc.timer.dagsseddel.slettetOgKorrigert.useQuery(
    { organizationId: orgId, fraOgMed: fraForSpørring, tilOgMed: til, egne: true },
    { enabled: gyldig },
  );

  const felt = "rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900";
  const periode = (
    <div className="flex items-center gap-1 text-sm text-gray-700">
      <label className="flex items-center gap-1">
        {t("timer.slettetKorrigert.filter.fra")}
        <input type="date" value={fra} max={til} onChange={(e) => { setFra(e.target.value); setDag(null); }} className={felt} />
      </label>
      <label className="flex items-center gap-1">
        {t("timer.slettetKorrigert.filter.til")}
        <input type="date" value={til} min={fra} onChange={(e) => { setTil(e.target.value); setDag(null); }} className={felt} />
      </label>
      {gyldig && fraForSpørring !== fra && (
        <span className="text-xs text-amber-700">{t("timer.slettetKorrigert.periodeKortet", { antall: MAKS_DAGER })}</span>
      )}
    </div>
  );

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/dashbord/timer/mine" className="text-sm text-blue-600 hover:underline">
            ‹ {t("timer.mine.tittel")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">{t("timer.slettetKorrigert.tittel")}</h1>
          <p className="mt-1 text-sm text-gray-600">{t("timer.slettetKorrigert.beskrivelseEgne")}</p>
        </div>
        <HjelpKnapp>
          <HjelpFane tittel={t("timer.slettetKorrigert.tittel")}>
            <p>{t("timer.slettetKorrigert.hjelp.egne")}</p>
            <p className="mt-2">{t("timer.slettetKorrigert.hjelp.ikkeMedEgne")}</p>
            <p className="mt-2">{t("timer.slettetKorrigert.hjelp.filterEgne")}</p>
          </HjelpFane>
        </HjelpKnapp>
      </div>
      <SlettetKorrigertVisning
        dager={data as unknown as SkDag[] | undefined}
        laster={gyldig && isLoading}
        periode={periode}
        medAnsatt={false}
        dag={dag}
        onFjernDag={() => setDag(null)}
      />
    </div>
  );
}
