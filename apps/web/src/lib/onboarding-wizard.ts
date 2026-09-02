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
  /**
   * Valgfri i18n-nøkkel for hensikt-tekst (kan inneholde flere avsnitt skilt med
   * `\n\n`). Brukt av prosjekt-banneret som forklarer HVORFOR steget finnes.
   */
  beskrivelseKey?: string;
  /** Valgfri lenke steget peker til. */
  href?: string;
  /** Valgfri: steget vises kun når true (f.eks. betinget på aktiv modul). Default: alltid synlig. */
  synlig?: (status: TStatus) => boolean;
  /** Valgfri: dynamisk delstatus-tekst (i18n-nøkkel) når steget er delvis fullført, ellers null. */
  undertekstKey?: (status: TStatus) => string | null;
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

/** Prosjekt-onboarding-status, avledet fra `prosjekt.hentOnboardingStatus`. */
export type ProsjektOnboardingStatus = RouterOutputs["prosjekt"]["hentOnboardingStatus"];

/**
 * Prosjekt-onboarding-veiviser (masterplan punkt 1, andre halvdel).
 *
 * Migrerer prosjekt-dashbord-banneret fra et hardkodet JSX-array til den
 * datadrevne modellen. Det NYE er ikke avhukingen, men FORKLARINGEN: hvert steg
 * bærer `beskrivelseKey` som forteller HVORFOR steget finnes (Kenneth 2026-09-01).
 *
 * Målt (2026-09-01): for et normalt opprettet prosjekt seeder `prosjekt.opprett`
 * dokumentflyt, brukergruppe OG begge mal-halvdeler grønne fra start — **Tegninger
 * er det eneste ekte gatet**. Banneret er derfor i praksis en forklaringsflate med
 * ett åpent punkt, ikke en sjekkliste. «Brukergrupper» er droppet som eget steg
 * (alltid grønt = støy); deltakere foldes inn i dokumentflyt-forklaringen.
 *
 * Modul-stegene (timer/maskin/varelager) vises kun når modulen er aktiv (`synlig`),
 * gating urørt (modulhierarkiet lukket 2026-09-01).
 */
export const prosjektOnboardingWizard: OnboardingWizardConfig<ProsjektOnboardingStatus> = {
  modulSlug: "prosjekt",
  steg: [
    {
      id: "dokumentflyt",
      tittelKey: "onboarding.dokumentflyt",
      beskrivelseKey: "onboarding.dokumentflytBeskrivelse",
      href: "/dashbord/oppsett/produksjon/dokumentflyt",
      ferdig: (s) => s.harDokumentflyt,
    },
    {
      id: "tegninger",
      tittelKey: "onboarding.tegninger",
      beskrivelseKey: "onboarding.tegningerBeskrivelse",
      href: "/dashbord/oppsett/byggeplasser",
      // Krever BÅDE byggeplass OG tegning — én byggeplass uten tegning holder ikke.
      ferdig: (s) => s.harLokasjon && s.harTegning,
      undertekstKey: (s) => (s.harLokasjon && !s.harTegning ? "onboarding.tegningMangler" : null),
    },
    {
      id: "maler",
      tittelKey: "onboarding.malerTittel",
      beskrivelseKey: "onboarding.malerBeskrivelse",
      href: "/dashbord/oppsett/produksjon/dokumentflyt",
      // Minst én sjekklistemal OG én oppgavemal koblet til flyt (Kenneth 2026-09-01).
      ferdig: (s) => s.harSjekklisteMalKoblet && s.harOppgaveMalKoblet,
    },
    {
      id: "timer",
      tittelKey: "onboarding.timerOppsett",
      beskrivelseKey: "onboarding.timerBeskrivelse",
      href: "/dashbord/firma/timer",
      synlig: (s) => s.timerAktiv,
      ferdig: (s) => s.harTimerOppsett,
    },
    {
      id: "maskin",
      tittelKey: "onboarding.maskinregister",
      beskrivelseKey: "onboarding.maskinBeskrivelse",
      href: "/dashbord/maskin",
      synlig: (s) => s.maskinAktiv,
      ferdig: (s) => s.harMaskinregister,
    },
    {
      id: "varelager",
      tittelKey: "onboarding.varekatalog",
      beskrivelseKey: "onboarding.varelagerBeskrivelse",
      href: "/dashbord/firma/varelager",
      synlig: (s) => s.varelagerAktiv,
      ferdig: (s) => s.harVarekatalog,
    },
  ],
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
