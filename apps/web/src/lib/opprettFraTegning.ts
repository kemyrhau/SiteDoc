/**
 * «Opprett fra tegning» — modell-korreksjon (funn 2026-08-22).
 *
 * Regresjonen (5573ccd2, F1 flyt-binding, 2026-07-24): serveren krever `dokumentflytId`
 * for ikke-HMS, men dialogen sendte kun faggruppe → stille BAD_REQUEST i fire uker.
 *
 * Denne rene funksjonen bygger opprett-inputen fra den VALGTE dokumentflyten:
 * - **HMS-mal:** serveren auto-ruter til prosjektets HMS-flyt og FORBYR klient-sendt
 *   `dokumentflytId` (kontrakt `sjekkliste.ts:345` / `oppgave.ts`). Klienten sender derfor
 *   INGEN flyt/faggruppe. HMS HAR en flyt — den er bare ikke klientens sak.
 * - **Ikke-HMS:** send den valgte flytens `dokumentflytId` + faggruppe (utledet fra flyten).
 *   Flere flyter i samme faggruppe → den VALGTE flytens id sendes, ikke en faggruppe-utledning
 *   (det var nettopp tvetydigheten som avslørte modellfeilen).
 */
export interface OpprettFlyt {
  id: string;
  faggruppeId: string | null;
}

export interface OpprettInput {
  dokumentflytId?: string;
  bestillerFaggruppeId?: string;
  utforerFaggruppeId?: string;
}

export function byggOpprettInput(erHms: boolean, flyt: OpprettFlyt | null): OpprettInput {
  // HMS: ingen flyt/faggruppe — server auto-ruter (kontrakt-grenen som fail-loud på id).
  if (erHms) return {};
  // Ikke-HMS uten valgt flyt: tom (submit skal være blokkert av UI; server ville uansett avvist).
  if (!flyt) return {};
  const faggruppeId = flyt.faggruppeId ?? undefined;
  return {
    dokumentflytId: flyt.id,
    bestillerFaggruppeId: faggruppeId,
    utforerFaggruppeId: faggruppeId,
  };
}
