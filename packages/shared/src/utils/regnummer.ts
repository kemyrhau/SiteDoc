/**
 * Normalisering og validering av norske registreringsnumre.
 *
 * Brukes ETT sted (denne fila) i tre lag for å unngå falsk negativ
 * ved sammenligning mellom klient-input og Vegvesen-respons:
 *   - Klient-form (input-onChange + før mutate)
 *   - Server Zod-validering (transform før regex)
 *   - Server sammenligning (input vs vegvesenData.kjoretoyId.kjennemerke)
 */

const REGNUMMER_REGEX = /^[A-Z]{2}\d{4,5}$/;

export function normaliserRegnummer(input: string): string {
  return input.replace(/\s+/g, "").replace(/-/g, "").toUpperCase().trim();
}

export function erGyldigRegnummer(input: string): boolean {
  return REGNUMMER_REGEX.test(normaliserRegnummer(input));
}
