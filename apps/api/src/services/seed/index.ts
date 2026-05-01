/**
 * Seed-mekanisme for Timer-modul + andre firma-relaterte kataloger.
 *
 * Brukes når et nytt firma (Organization) opprettes: relevante kataloger
 * seedes automatisk basert på Timer-modul-aktivering. Per Fase 0 § C.10 +
 * timer.md § Onboarding skal kunder kunne velge mellom:
 *   - Standard onboarding: Nivå 1 + Nivå 2 seedes automatisk
 *   - Manuell onboarding: Kun Nivå 1 (lovpålagt) seedes; resten legges til av admin
 *
 * Fase 3 Infrastruktur (2026-05-01): kun stub-funksjoner. Implementasjon i
 * Runde 1A (katalog-admin) — selve katalog-innholdet (16 lønnsarter Nivå 1,
 * 25 Nivå 2, aktivitettyper, tilleggstyper, expense-kategorier) skrives da.
 *
 * Event-hook `onOrganizationCreated`: ikke etablert ennå. Forutsetter en
 * sentralisert hook i organisasjon-opprett-flyten — registreres senere.
 */

// TODO Runde 1A — implementer 16 lovpålagte lønnsarter per timer.md § Nivå 1
export async function seedLonnsartNivaa1(_organizationId: string): Promise<void> {
  throw new Error("seedLonnsartNivaa1 ikke implementert ennå (Runde 1A)");
}

// TODO Runde 1A — implementer 25 bransje-relevante lønnsarter per timer.md § Nivå 2
export async function seedLonnsartNivaa2(_organizationId: string): Promise<void> {
  throw new Error("seedLonnsartNivaa2 ikke implementert ennå (Runde 1A)");
}

// TODO Runde 1A — implementer aktivitet-Nivå 1 + Nivå 2 per timer.md § Aktivitet-katalog
export async function seedAktiviteter(_organizationId: string): Promise<void> {
  throw new Error("seedAktiviteter ikke implementert ennå (Runde 1A)");
}

// TODO Runde 1A — implementer tillegg-Nivå 1 + Nivå 2 per timer.md § Tillegg
export async function seedTillegg(_organizationId: string): Promise<void> {
  throw new Error("seedTillegg ikke implementert ennå (Runde 1A)");
}

// TODO Runde 1A — implementer standardkategorier (Drivstoff, Parkering, Diett, Verktøy, Annet)
export async function seedExpenseCategories(_organizationId: string): Promise<void> {
  throw new Error("seedExpenseCategories ikke implementert ennå (Runde 1A)");
}

/**
 * Samlet entry-point — kalles av onOrganizationCreated-event-hook.
 * Hvilke seed-funksjoner som kjører avhenger av om Timer-modulen er aktivert
 * og hvilken onboarding-modus kunden valgte.
 */
export interface SeedTimerOptions {
  /** Hvis false: kun Nivå 1 seedes (manuell onboarding) */
  inkluderNivaa2?: boolean;
}

export async function seedTimerForOrganization(
  organizationId: string,
  options: SeedTimerOptions = { inkluderNivaa2: true },
): Promise<void> {
  await seedLonnsartNivaa1(organizationId);
  await seedAktiviteter(organizationId);
  await seedTillegg(organizationId);
  await seedExpenseCategories(organizationId);

  if (options.inkluderNivaa2) {
    await seedLonnsartNivaa2(organizationId);
  }
}
