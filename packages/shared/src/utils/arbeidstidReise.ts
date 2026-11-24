/** En reise ført som arbeidstid: arbeidsrad med reisemerke (vedtak Reisevinduet pkt 16). */
export function erArbeidstidReise(r: { erReise?: boolean | null; arbeidReiseRetning?: string | null }): boolean {
  return r.erReise !== true && r.arbeidReiseRetning != null;
}
