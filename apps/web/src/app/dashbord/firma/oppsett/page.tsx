"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Spinner } from "@sitedoc/ui";
import {
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Building2,
  FolderKanban,
  Users,
  Network,
  MapPin,
  Boxes,
} from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { firmaOnboardingWizard, førsteUfullførteSteg } from "@/lib/onboarding-wizard";
import {
  OnboardingFremdrift,
  OnboardingStegListe,
  StegStatusMerke,
} from "@/components/onboarding/veiviser-ui";

const config = firmaOnboardingWizard;

/**
 * Firmanivå-onboarding-veiviser (masterplanens punkt 1).
 *
 * Datadrevet, samme mønster som timer-veiviseren: aktivt steg i URL (`?steg=<id>`),
 * aldri lagret; auto-hopp til første ufullførte. To GATING-steg (firmaprofil +
 * første prosjekt); resten er valgfrie anbefalinger som ikke gater fullført.
 *
 * `useSearchParams()` krever Suspense-boundary under `next build`-prerender (regel 10).
 */
export default function FirmaOppsettSide() {
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
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const { data: status, isLoading } = trpc.organisasjon.hentOnboardingStatus.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );

  const aktivStegId = searchParams.get("steg");
  const aktivSteg = config.steg.find((s) => s.id === aktivStegId) ?? null;

  // Datadrevet gjenopptak: uten gyldig ?steg → replace til første ufullførte.
  useEffect(() => {
    if (!status || aktivSteg) return;
    const mål = førsteUfullførteSteg(config, status) ?? config.steg[0];
    if (mål) router.replace(`${pathname}?steg=${mål.id}`);
  }, [status, aktivSteg, pathname, router]);

  function gåTil(stegId: string) {
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
            {t("firma.onboarding.tittel")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{t("firma.onboarding.beskrivelse")}</p>
        </div>
        <HjelpKnapp>
          <HjelpFane tittel={t("firma.onboarding.hjelp.hvaTittel")}>
            <p>{t("firma.onboarding.hjelp.hva")}</p>
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

      {/* Steg-liste (2 gating-steg) */}
      <OnboardingStegListe
        config={config}
        status={status}
        aktivStegId={aktivSteg.id}
        onVelg={gåTil}
      />

      {/* Steg-innhold */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900">{t(aktivSteg.tittelKey)}</h3>
          <StegStatusMerke ferdig={stegFerdig} />
        </div>

        <div className="mt-4">
          {aktivSteg.id === "firmaprofil" && (
            <div>
              <p className="text-sm text-gray-600">
                {t("firma.onboarding.steg.firmaprofil.beskrivelse")}
              </p>
              {stegFerdig ? (
                <GrønnKvittering tekst={t("firma.onboarding.steg.firmaprofil.ferdig")} />
              ) : (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <ul className="ml-4 list-disc space-y-1">
                    {!status.harFirmaprofil && (
                      <li>{t("firma.onboarding.steg.firmaprofil.mangler")}</li>
                    )}
                  </ul>
                </div>
              )}
              <LenkeKnapp
                href="/dashbord/firma/innstillinger"
                tekst={t("firma.onboarding.steg.firmaprofil.lenke")}
              />
            </div>
          )}

          {aktivSteg.id === "prosjekt" && (
            <div>
              <p className="text-sm text-gray-600">
                {t("firma.onboarding.steg.prosjekt.beskrivelse")}
              </p>
              {stegFerdig ? (
                <GrønnKvittering tekst={t("firma.onboarding.steg.prosjekt.ferdig")} />
              ) : (
                <div className="mt-4">
                  <Link href="/dashbord/nytt-prosjekt">
                    <Button>
                      <FolderKanban className="mr-1.5 h-4 w-4" />
                      {t("firma.onboarding.steg.prosjekt.opprett")}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Anbefalte neste steg (valgfritt — gater aldri fullført) */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">
          {t("firma.onboarding.anbefalt.tittel")}
        </h3>
        <p className="mt-1 text-sm text-gray-500">{t("firma.onboarding.anbefalt.beskrivelse")}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <AnbefaltSteg
            ikon={Users}
            tittel={t("firma.onboarding.anbefalt.ansatte")}
            href="/dashbord/firma/ansatte"
            ferdig={status.harAnsatte}
          />
          <AnbefaltSteg
            ikon={Network}
            tittel={t("firma.onboarding.anbefalt.avdelinger")}
            href="/dashbord/firma/avdelinger"
            ferdig={status.harAvdelinger}
          />
          <AnbefaltSteg
            ikon={MapPin}
            tittel={t("firma.onboarding.anbefalt.oppmotesteder")}
            href="/dashbord/firma/oppmotesteder"
            ferdig={status.harOppmotesteder}
          />
          <AnbefaltSteg
            ikon={Boxes}
            tittel={t("firma.onboarding.anbefalt.moduler")}
            href="/dashbord/firma/moduler"
            ferdig={status.harModuler}
          />
        </div>
      </div>

      {/* Forrige / neste */}
      <div className="flex items-center justify-between">
        {forrige ? (
          <Button variant="secondary" onClick={() => gåTil(forrige.id)}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t("onboarding.forrige")}
          </Button>
        ) : (
          <span />
        )}
        {neste ? (
          <Button variant="secondary" onClick={() => gåTil(neste.id)}>
            {t("onboarding.neste")}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Firma-spesifikke presentasjons-komponenter                         */
/* ------------------------------------------------------------------ */

function GrønnKvittering({ tekst }: { tekst: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
      <CheckCircle2 className="h-5 w-5 text-green-600" />
      <span>{tekst}</span>
    </div>
  );
}

function LenkeKnapp({ href, tekst }: { href: string; tekst: string }) {
  return (
    <div className="mt-4">
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-sitedoc-primary transition-colors hover:bg-gray-50"
      >
        <Building2 className="h-4 w-4" />
        {tekst}
        <ExternalLink className="h-4 w-4" />
      </Link>
    </div>
  );
}

function AnbefaltSteg({
  ikon: Ikon,
  tittel,
  href,
  ferdig,
}: {
  ikon: typeof Users;
  tittel: string;
  href: string;
  ferdig: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm transition-colors hover:border-gray-300"
    >
      {ferdig ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-gray-300" />
      )}
      <Ikon className="h-4 w-4 shrink-0 text-gray-400" />
      <span className="min-w-0 flex-1 truncate font-medium text-gray-700">{tittel}</span>
      <ExternalLink className="h-4 w-4 shrink-0 text-gray-300" />
    </Link>
  );
}
