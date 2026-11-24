/**
 * Undertype → dokumentform (category). Én kilde for serveren
 * (`valideerSubdomainKombinasjon`, `mal.ts`) og malbyggeren på web
 * (`lagretMalKategori` og «Ny HMS-mal», HM2 Kenneth 2026-11-24).
 *
 * Avvik, RUH og Kontraktssak bruker oppgave-formen (én hendelse som meldes,
 * behandles og lukkes); SJA bruker sjekkliste-formen (punkter som gås gjennom).
 */
export type MalForm = "oppgave" | "sjekkliste";
export type FormSubdomain = "avvik" | "ruh" | "sja" | "kontrakt";

export const SUBDOMAIN_FORM: Readonly<Record<FormSubdomain, MalForm>> = {
  avvik: "oppgave",
  ruh: "oppgave",
  sja: "sjekkliste",
  kontrakt: "oppgave",
};

/** Formen for en undertype, eller undefined når undertypen ikke har fast form. */
export function formForSubdomain(subdomain: string): MalForm | undefined {
  return (SUBDOMAIN_FORM as Readonly<Record<string, MalForm>>)[subdomain];
}
