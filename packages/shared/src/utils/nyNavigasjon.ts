// Delt presedens-resolver for `nyNavigasjon`-flagget (redesign/navigasjon).
//
// ÉN sannhet for hele systemet — både web-hooken (`apps/web/src/hooks/useNyNavigasjon.ts`)
// og mobil-hooken (`apps/mobile/src/hooks/useNyNavigasjon.ts`) beregner sluttverdien HER.
// Ingen call-site skal ha egen presedens-logikk (unngår drift mellom plattformene).
//
// Presedens (vedtatt Kenneth 2026-07-07, valg B):
//   aktiv ?nyNav-URL (flyktig) > konto > persistert lokal > env-default > av
//
// - `query` = aktiv `?nyNav`-URL denne innlastingen. **Flyktig demo/dev-override** —
//   skal ALDRI persisteres til lokal cache eller konto. Fjern param → tilbake til
//   konto-styrt. Øverst så en presenter kan vise gammel-vs-ny for enhver bruker i
//   kunderunden. `null` = ingen param.
// - `konto`  = `User.nyNavigasjon` (bruker-lagret, autoritativt). `null` = IKKE tildelt
//   → fall gjennom. Nøkkelen til delt-enhet-korrekthet: en ny bruker på samme enhet
//   følger sin egen konto, ikke forrige brukers lokale cache.
// - `lokal` = persistert lokal toggle (localStorage/SecureStore). `null` = usatt.
// - `envDefault` = build-tids default (`NEXT_PUBLIC_NY_NAV_DEFAULT`). Kun redesign-stacken
//   setter denne til `true`; prod/test = `false`. Encoder samtidig det endelige «av».

export type NyNavigasjonKilde = {
  /** Aktiv ?nyNav-URL — flyktig, persisteres ALDRI. null = ingen param. */
  query: boolean | null;
  /** User.nyNavigasjon — null = ikke tildelt (fall gjennom). */
  konto: boolean | null;
  /** Persistert lokal toggle (localStorage/SecureStore). null = usatt. */
  lokal: boolean | null;
  /** Build-tids env-default (NEXT_PUBLIC_NY_NAV_DEFAULT). false i prod/test. */
  envDefault: boolean;
};

/**
 * Beregner om ny navigasjon skal vises, etter presedensen
 * aktiv ?nyNav-URL > konto > persistert lokal > env-default > av.
 *
 * Ren funksjon — ingen sideeffekter, ingen plattform-API. Testes i
 * `nyNavigasjon.test.ts` (beviser hele kjeden inkl. delt-enhet-dominansen +
 * flyktig query-override + at query fjernet → konto-styrt).
 */
export function resolverNyNavigasjon({
  query,
  konto,
  lokal,
  envDefault,
}: NyNavigasjonKilde): boolean {
  if (query !== null) return query; // flyktig demo/dev-override (aldri persistert)
  if (konto !== null) return konto; // autoritativ per bruker (delt-enhet-sikker)
  if (lokal !== null) return lokal; // persistert lokal toggle
  return envDefault; // env-default (redesign-stack) — ellers false = «av»
}
