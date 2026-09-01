"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@sitedoc/ui";
import { CheckCircle2, Circle, ArrowRight, ExternalLink } from "lucide-react";
import {
  type OnboardingWizardConfig,
  førsteUfullførteSteg,
  antallGjenstår,
  erOnboardingFullført,
} from "@/lib/onboarding-wizard";

/**
 * Delte presentasjonskomponenter for onboarding-veivisere (timer, firma, senere
 * maskin/varelager). Rent generisk «krom» — fremdriftsbanner, steg-liste og
 * leaf-merker — over den datadrevne modellen i @/lib/onboarding-wizard.
 *
 * Steg-INNHOLDET forblir per side: hver modul har egne mutasjoner/lenker, så det
 * er bevisst IKKE en felles steg-switch (ærlig delvis-ekstraksjon, ikke én tvungen
 * abstraksjon). i18n: generiske `onboarding.*`-nøkler.
 */

/** Fremdriftsbanner: grønn «fullført» eller amber «N gjenstår» + hopp-knapp. */
export function OnboardingFremdrift<TStatus>({
  config,
  status,
  aktivStegId,
  onHopp,
}: {
  config: OnboardingWizardConfig<TStatus>;
  status: TStatus;
  aktivStegId: string;
  onHopp: (stegId: string) => void;
}) {
  const { t } = useTranslation();
  const gjenstår = antallGjenstår(config, status);
  const fullført = erOnboardingFullført(config, status);
  const nesteUfullført = førsteUfullførteSteg(config, status);

  if (fullført) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <span className="text-sm font-medium text-green-900">{t("onboarding.fullfort")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <span className="text-sm font-medium text-amber-900">
        {t("onboarding.gjenstaar", { antall: gjenstår, totalt: config.steg.length })}
      </span>
      {nesteUfullført && nesteUfullført.id !== aktivStegId && (
        <Button variant="secondary" onClick={() => onHopp(nesteUfullført.id)}>
          {t("onboarding.hoppTilUfullfort")}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/** Steg-liste: grid av knapper med ferdig-hake, aktivt steg markert. */
export function OnboardingStegListe<TStatus>({
  config,
  status,
  aktivStegId,
  onVelg,
}: {
  config: OnboardingWizardConfig<TStatus>;
  status: TStatus;
  aktivStegId: string;
  onVelg: (stegId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {config.steg.map((steg, i) => {
        const ferdig = steg.ferdig(status);
        const aktiv = steg.id === aktivStegId;
        return (
          <li key={steg.id}>
            <button
              onClick={() => onVelg(steg.id)}
              className={`flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                aktiv
                  ? "border-sitedoc-primary bg-blue-50 text-sitedoc-primary"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              {ferdig ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-gray-300" />
              )}
              <span className="min-w-0">
                <span className="block text-xs text-gray-400">
                  {t("onboarding.stegNr", { nr: i + 1 })}
                </span>
                <span className="block truncate font-medium">{t(steg.tittelKey)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Liten pille som viser om aktivt steg er fullført. */
export function StegStatusMerke({ ferdig }: { ferdig: boolean }) {
  const { t } = useTranslation();
  return ferdig ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {t("onboarding.ferdig")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
      <Circle className="h-3.5 w-3.5" />
      {t("onboarding.ikkeFerdig")}
    </span>
  );
}

/** Grønn kvittering med antall registrerte elementer for et fullført steg. */
export function FerdigKvittering({ antall }: { antall: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
      <CheckCircle2 className="h-5 w-5 text-green-600" />
      <span>{t("onboarding.antallRegistrert", { antall })}</span>
    </div>
  );
}

/** Steg-innhold som lenker til en eksisterende katalog-/CRUD-side. */
export function KatalogSteg({
  beskrivelse,
  href,
  lenkeTekst,
  ferdig,
  antall,
}: {
  beskrivelse: string;
  href: string;
  lenkeTekst: string;
  ferdig: boolean;
  antall: number;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="text-sm text-gray-600">{beskrivelse}</p>
      {ferdig && (
        <div className="mt-4">
          <FerdigKvittering antall={antall} />
        </div>
      )}
      <div className="mt-4">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-sitedoc-primary transition-colors hover:bg-gray-50"
        >
          {t("onboarding.aapneSide", { side: lenkeTekst })}
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
