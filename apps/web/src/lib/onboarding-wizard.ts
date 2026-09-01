import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@sitedoc/api/src/trpc/router";

/**
 * Generisk modul-onboarding-wizard-modell (TASK 1 — ren modell, ingen UI).
 *
 * Prinsipp: DATADREVET. Vi lagrer ALDRI «bruker er på steg N». Hvert steg har
 * et `ferdig`-predikat som avledes fra modulens status-tellinger. Gjenopptak =
 * hopp til første UFULLFØRTE steg. Da blir tilstanden aldri stale — seeder noen
 * en verdi utenfor wizarden, er steget ferdig uansett.
 *
 * Generisk over status-typen så maskin/varelager kan plugges inn senere med
 * egne config-er uten å endre resolverne.
 */

/** Ett wizard-steg. `ferdig` avgjør datadrevet om steget er fullført. */
export interface OnboardingSteg<TStatus> {
  /** Stabil id (brukes til URL-adresserbare steg i task 2). */
  id: string;
  /** i18n-nøkkel for steg-tittel. */
  tittelKey: string;
  /** Datadrevet ferdig-predikat basert på modulens status. */
  ferdig: (status: TStatus) => boolean;
}

/** Konfigurasjon for én moduls onboarding-wizard. */
export interface OnboardingWizardConfig<TStatus> {
  /** Firmamodul-slug (f.eks. "timer"). */
  modulSlug: string;
  /** Steg i visnings-/utførelses-rekkefølge. */
  steg: OnboardingSteg<TStatus>[];
}

/**
 * Første steg som ennå ikke er fullført, eller `null` når alt er ferdig.
 * Dette er gjenopptaks-punktet — ingen lagret posisjon.
 */
export function førsteUfullførteSteg<TStatus>(
  config: OnboardingWizardConfig<TStatus>,
  status: TStatus,
): OnboardingSteg<TStatus> | null {
  return config.steg.find((steg) => !steg.ferdig(status)) ?? null;
}

/** Antall gjenstående (ufullførte) steg. */
export function antallGjenstår<TStatus>(
  config: OnboardingWizardConfig<TStatus>,
  status: TStatus,
): number {
  return config.steg.filter((steg) => !steg.ferdig(status)).length;
}

/** Hele oppsettet er fullført (ingen gjenstående steg). */
export function erOnboardingFullført<TStatus>(
  config: OnboardingWizardConfig<TStatus>,
  status: TStatus,
): boolean {
  return antallGjenstår(config, status) === 0;
}

type RouterOutputs = inferRouterOutputs<AppRouter>;

/**
 * Status-typen avledes direkte fra tRPC-query-outputen slik at config-predikatene
 * aldri drifter fra `timer.onboarding.status`.
 */
export type TimerOnboardingStatus = RouterOutputs["timer"]["onboarding"]["status"];

/**
 * Timer-modulens onboarding-wizard.
 *
 * Stegene avledes av katalog-tellingene i status-queryen; `ferdig = count > 0`.
 *
 * Merk «interne prosjekter»: seedes som del av `aktiverNivaa1`
 * (`seedTimerForOrganization` → `seedInterneProsjekter`) og eksponeres IKKE som
 * egen telling i status-queryen. Det er infrastruktur, ikke katalog, og er derfor
 * bevisst IKKE et eget wizard-steg (kan ikke gis et datadrevet ferdig-predikat).
 */
/**
 * Firmamoduler som har en onboarding-wizard, med URL til wizard-siden.
 *
 * Brukes av modul-aktiveringen (firma/moduler) til å avgjøre om det skal dukke
 * opp en «sett opp nå?»-inngang. Moduler UTEN oppføring her får ingen modal.
 * Maskin/varelager legges til her når de får egne wizard-sider.
 */
export const MODUL_WIZARD_URL: Partial<Record<string, string>> = {
  timer: "/dashbord/firma/timer/oppsett",
};

/** Firmanivå-onboarding-status, avledet fra `organisasjon.hentOnboardingStatus`. */
export type FirmaOnboardingStatus = RouterOutputs["organisasjon"]["hentOnboardingStatus"];

/**
 * Firmanivå-onboarding-veiviser (masterplanens punkt 1).
 *
 * KUN to gating-steg (M1, Kenneth-vedtak 2026-09-01): firmaprofil og første
 * prosjekt. Er begge på plass, ER firmaet onboardet, og prosjekt-veiviseren tar
 * over — en ren skjøt mellom firma- og prosjektnivået.
 *
 * Ansatte, avdelinger, oppmøtesteder og moduler er bevisst IKKE steg her: de er
 * valgfrie anbefalinger (rendres som haker i firma-oppsett-siden) og gater aldri
 * fullført-tilstanden. Et enmanns-firma uten avdelinger skal ikke stå ufullført
 * for alltid (fabel-fence 1). `modulSlug: "firma"` er en etikett, ikke en
 * firmamodul-slug — firma-onboarding er ikke selv en modul.
 */
export const firmaOnboardingWizard: OnboardingWizardConfig<FirmaOnboardingStatus> = {
  modulSlug: "firma",
  steg: [
    {
      id: "firmaprofil",
      tittelKey: "firma.onboarding.steg.firmaprofil.tittel",
      ferdig: (status) => status.harFirmaprofil,
    },
    {
      id: "prosjekt",
      tittelKey: "firma.onboarding.steg.prosjekt.tittel",
      ferdig: (status) => status.harProsjekt,
    },
  ],
};

export const timerOnboardingWizard: OnboardingWizardConfig<TimerOnboardingStatus> = {
  modulSlug: "timer",
  steg: [
    {
      id: "lonnsart-nivaa1",
      tittelKey: "firma.timer.onboarding.wizard.steg.lonnsartNivaa1",
      ferdig: (status) => status.antallLonnsartNivaa1 > 0,
    },
    {
      id: "aktiviteter",
      tittelKey: "firma.timer.onboarding.wizard.steg.aktiviteter",
      ferdig: (status) => status.antallAktiviteter > 0,
    },
    {
      id: "tillegg",
      tittelKey: "firma.timer.onboarding.wizard.steg.tillegg",
      ferdig: (status) => status.antallTillegg > 0,
    },
    {
      id: "utlegg",
      tittelKey: "firma.timer.onboarding.wizard.steg.utlegg",
      ferdig: (status) => status.antallExpenseKategorier > 0,
    },
  ],
};
