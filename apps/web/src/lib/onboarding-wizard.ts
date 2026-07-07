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
