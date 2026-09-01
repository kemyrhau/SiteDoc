"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Spinner } from "@sitedoc/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import {
  timerOnboardingWizard,
  førsteUfullførteSteg,
} from "@/lib/onboarding-wizard";
import {
  OnboardingFremdrift,
  OnboardingStegListe,
  StegStatusMerke,
  FerdigKvittering,
  KatalogSteg,
} from "@/components/onboarding/veiviser-ui";

const config = timerOnboardingWizard;

/**
 * Dedikert onboarding-veiviser for Timer-modulen (TASK 2).
 *
 * Datadrevet: gjeldende steg ligger i URL-en (`?steg=<stegId>`) så det overlever
 * reload og nettleser-tilbake. Ferdig-tilstand beregnes fra status-queryen via
 * task-1-modellen — vi lagrer ALDRI hvilket steg brukeren «er på». Uten gyldig
 * `?steg` hopper vi til første ufullførte steg.
 *
 * Wizarden ORKESTRERER: den aktiverer Nivå 1 og lenker til de eksisterende
 * katalog-sidene. Den duplikerer ikke katalog-CRUD.
 *
 * `useSearchParams()` krever Suspense-boundary under `next build`-prerender
 * (regel 10) — derfor er default-eksporten en wrapper rundt selve veiviseren.
 */
export default function TimerOppsettSide() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      }
    >
      <OppsettVeiviser />
    </Suspense>
  );
}

function OppsettVeiviser() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const [feil, setFeil] = useState<string | null>(null);

  const { data: status, isLoading } = trpc.timer.onboarding.status.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );

  const aktivStegId = searchParams.get("steg");
  const aktivSteg = config.steg.find((s) => s.id === aktivStegId) ?? null;

  // Datadrevet gjenopptak: uten gyldig ?steg → replace til første ufullførte
  // (eller første steg om alt er ferdig). Replace, ikke push — ikke forurens
  // historikken ved auto-hopp.
  useEffect(() => {
    if (!status || aktivSteg) return;
    const mål = førsteUfullførteSteg(config, status) ?? config.steg[0];
    if (mål) router.replace(`${pathname}?steg=${mål.id}`);
  }, [status, aktivSteg, pathname, router]);

  const aktiverNivaa1 = trpc.timer.onboarding.aktiverNivaa1.useMutation({
    onSuccess: () => {
      utils.timer.onboarding.status.invalidate();
      utils.organisasjon.hentMin.invalidate();
    },
    onError: (e) => setFeil(e.message),
  });

  function gåTil(stegId: string) {
    setFeil(null);
    router.push(`${pathname}?steg=${stegId}`);
  }

  if (isLoading || !status || !aktivSteg) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const idx = config.steg.findIndex((s) => s.id === aktivSteg.id);
  const forrige = idx > 0 ? config.steg[idx - 1] : null;
  const neste = idx < config.steg.length - 1 ? config.steg[idx + 1] : null;
  const stegFerdig = aktivSteg.ferdig(status);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("firma.timer.oppsett.tittel")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {t("firma.timer.oppsett.beskrivelse")}
          </p>
        </div>
        <HjelpKnapp>
          <HjelpFane tittel={t("firma.timer.oppsett.hjelp.hvaTittel")}>
            <p>{t("firma.timer.oppsett.hjelp.hva")}</p>
          </HjelpFane>
        </HjelpKnapp>
      </div>

      {/* Fremdrift */}
      <OnboardingFremdrift
        config={config}
        status={status}
        aktivStegId={aktivSteg.id}
        onHopp={gåTil}
      />

      {/* Steg-liste */}
      <OnboardingStegListe
        config={config}
        status={status}
        aktivStegId={aktivSteg.id}
        onVelg={gåTil}
      />

      {/* Steg-innhold */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900">
            {t(aktivSteg.tittelKey)}
          </h3>
          <StegStatusMerke ferdig={stegFerdig} />
        </div>

        <div className="mt-4">
          {aktivSteg.id === "lonnsart-nivaa1" &&
            (stegFerdig ? (
              <FerdigKvittering antall={status.antallLonnsartTotalt} />
            ) : (
              <div>
                <p className="text-sm text-gray-600">
                  {t("firma.timer.oppsett.steg.lonnsartNivaa1.beskrivelse")}
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() =>
                      aktiverNivaa1.mutate({
                        inkluderNivaa2: false,
                        organizationId: orgId!,
                      })
                    }
                    disabled={aktiverNivaa1.isPending}
                  >
                    {aktiverNivaa1.isPending
                      ? t("handling.lagrer")
                      : t("firma.timer.onboarding.aktiverNivaa1")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      aktiverNivaa1.mutate({
                        inkluderNivaa2: true,
                        organizationId: orgId!,
                      })
                    }
                    disabled={aktiverNivaa1.isPending}
                  >
                    {t("firma.timer.onboarding.aktiverNivaa1Og2")}
                  </Button>
                </div>
                {feil && <p className="mt-3 text-sm text-red-600">{feil}</p>}
              </div>
            ))}

          {aktivSteg.id === "aktiviteter" && (
            <KatalogSteg
              beskrivelse={t("firma.timer.oppsett.steg.aktiviteter.beskrivelse")}
              href="/dashbord/firma/timer/aktiviteter"
              lenkeTekst={t("firma.timer.fane.aktiviteter")}
              ferdig={stegFerdig}
              antall={status.antallAktiviteter}
            />
          )}

          {aktivSteg.id === "tillegg" && (
            <KatalogSteg
              beskrivelse={t("firma.timer.oppsett.steg.tillegg.beskrivelse")}
              href="/dashbord/firma/timer/tillegg"
              lenkeTekst={t("firma.timer.fane.tillegg")}
              ferdig={stegFerdig}
              antall={status.antallTillegg}
            />
          )}

          {aktivSteg.id === "utlegg" && (
            <div>
              <p className="text-sm text-gray-600">
                {t("firma.timer.oppsett.steg.utlegg.beskrivelse")}
              </p>
              {stegFerdig ? (
                <div className="mt-4">
                  <FerdigKvittering antall={status.antallExpenseKategorier} />
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p>{t("firma.timer.oppsett.steg.utlegg.merknad")}</p>
                  <Button
                    variant="secondary"
                    className="mt-3"
                    onClick={() => gåTil("lonnsart-nivaa1")}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    {t("firma.timer.oppsett.steg.utlegg.gaaTilNivaa1")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Forrige / neste */}
      <div className="flex items-center justify-between">
        {forrige ? (
          <Button variant="secondary" onClick={() => gåTil(forrige.id)}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t("firma.timer.oppsett.forrige")}
          </Button>
        ) : (
          <span />
        )}
        {neste ? (
          <Button variant="secondary" onClick={() => gåTil(neste.id)}>
            {t("firma.timer.oppsett.neste")}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
