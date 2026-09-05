# Tillegg 2 til designnotat grense-resolver — eksplisitt kravtype + måling-først-kriteriet (fabel 2026-09-06)

Svar på coworks verifisering + Kenneth-spørsmålet «nytt malobjekt eller forbedring av
trafikklysene?». Supplement til 0230 + 1000.

## 1. Kravtypen lagres EKSPLISITT — coworks anbefaling tiltres

Ny config-nøkkel `kravType: "minst" | "hoyst" | "mellom" | "toleranse"` skrives av
MalBygger-nedtrekket. Begrunnelsen er coworks: utledning fra satte felter kan ikke skille
«Minst 30» fra «forfatteren glemte maks» — og en glemt maks skal kunne VARSLES
(kvitteringslinje: «Mellom-krav med bare én verdi — mangler maks?»). Resolveren bruker
`kravType` når den finnes, utleder for eldre config (alias-lesingen i `normaliserGrense`
uendret). Additivt, ingen migrering.

## 2. Kenneth-svaret, ført som designpremiss

Avviksfeltet er en **forbedring av integer/decimal** — ikke nytt objekt, ikke
trafikklys-endring. Grensene bor der allerede (FeltKonfigurasjon.tsx:156). I tråd med
05.09-vedtaket: funksjonsforbedring av eksisterende malobjekt.

## 3. Måling-først-kriteriet — coworks observasjon tas inn i MK B+D-gaten

Observasjonen tiltres og gjøres operativ. Konverteringsgjennomgangen av de 34 trafikklysene
(MK B+D, fabel-gatet liste) får et TRINN FØR list_single-spørsmålet:

1. **Kan utfallet MÅLES?** → `decimal`/`integer` med grense i klarspråk. Fargen beregnes;
   tallet følger med i dokumentet og kan etterprøves av byggherren. («Komprimeringsgrad:
   93 %, krav ≥ 95 %» slår «Er komprimeringen god nok?» — sannere dokumentasjon, og
   avviksfeltet utløses automatisk ved brudd.)
2. Ellers: **kan utfallet navngis?** → `list_single` med informative valg (som før).
3. Ellers: trafikklyset består (ren skjønnsvurdering).

Konsekvens for rekkefølgen: B+D-ordren bør IKKE låse konverteringslista før
resolver-familiens trinn 1–2 er bestilt — ellers konverteres målbare trafikklys til
list_single i september og re-konverteres til tall+grense i oktober. Fabel foreslår:
resolver-ordren (trinn 1+2 fra 0230-notatet) skrives FØRST eller sammen med B+D;
gjennomgangen av de 34 kjøres én gang mot alle tre utfall. Cowork sekvenserer.

## Estimat-konsekvens (til kostnadsbildet)

Kriteriet flytter trolig en andel av de 34 fra list_single til tall+grense — mer presis
dokumentasjon OG færre klikk i utfylling (måling tastes uansett; fargen kommer gratis).
Trafikklys-slankingen (28→22px) står uansett — de gjenværende skjønns-lysene beholdes.

— fabel
