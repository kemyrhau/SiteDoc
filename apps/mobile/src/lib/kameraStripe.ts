// Miniatyrstripa i kameraet (telefontest 2026-10-29, funn 4): før kom miniatyren først når hele
// behandlingen var ferdig — komprimering, GPS (opptil 5 s på High innendørs før Balanced), lokal
// lagring og innlegging i køen. Nå legges den inn STRAKS med det tatte bildet, og bekreftes når
// vedlegget er registrert. Annotering åpnes først da: vedlegget og køraden for originalen må finnes,
// ellers kan originalen havne i køen ETTER annoteringen og vinne kappløpet (koDedup).
import type { AnnoteringsLag } from "@sitedoc/shared";

/** Et bilde tatt i denne kameraøkta. */
export interface OktBilde {
  /** Stabil nøkkel fra opptaket (vedleggId finnes ikke før registreringen). */
  nokkel: string;
  /** Null til vedlegget er registrert. */
  vedleggId: string | null;
  /** Det som vises i miniatyren: det tatte bildet, så den komprimerte kopien, så den annoterte. */
  uri: string;
  /** Originalen (komprimert). Med lag åpnes den, og laget legges på — som i skjemaet. */
  originalUri: string;
  annotert: boolean;
  /** Laget fra forrige annotering i økta: åpnes redigerbart (funn 1c). */
  lag?: AnnoteringsLag;
}

/** Nytt opptak: miniatyren vises straks, nyeste først. */
export function leggTilVentende(prev: OktBilde[], nokkel: string, fotoUri: string): OktBilde[] {
  return [{ nokkel, vedleggId: null, uri: fotoUri, originalUri: fotoUri, annotert: false }, ...prev];
}

/** Registreringen er ferdig: koble til vedlegget, eller fjern miniatyren hvis den feilet. */
export function bekreftOpptak(
  prev: OktBilde[],
  nokkel: string,
  res: { vedleggId: string; uri: string } | null,
): OktBilde[] {
  if (!res) return prev.filter((b) => b.nokkel !== nokkel);
  return prev.map((b) =>
    b.nokkel === nokkel ? { ...b, vedleggId: res.vedleggId, uri: res.uri, originalUri: res.uri } : b,
  );
}

/** Kan bildet annoteres? Først når vedlegget (og originalens kørad) er registrert. */
export function kanAnnoteres(b: OktBilde): b is OktBilde & { vedleggId: string } {
  return b.vedleggId !== null;
}
