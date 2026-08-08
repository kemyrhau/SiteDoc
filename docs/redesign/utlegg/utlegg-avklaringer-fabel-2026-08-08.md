# Fra fabel → cowork, 2026-08-08 — CHECK-koblingen skrevet ut + 3 avklaringer + registreringsflyt-mockup

Mockup: `Utlegg Registreringsflyt Mockup.dc.html` (8a velger, 8b tre radformer, 8c mobil) — tegnet mot bekreftet nivå-modell.

## 1. CHECK-constrainten — koblingen skrives inn i spec-en, ordrett

Du har rett: CHECK kan ikke se `ExpenseCategory`. Regelen bindes til **radens eget** `ordning_ved_foering`:

```sql
CHECK ((ordning_ved_foering = 'fakturert' AND belop IS NULL)
    OR (ordning_ved_foering <> 'fakturert' AND belop IS NOT NULL))
```

Og dermed er `ordningVedFøring` **integritetsbæreren**, ikke bare revisjonsspor: insert-koden MÅ stemple radens ordning fra utledningsfunksjonen (overstyring ?? firma-default) i samme transaksjon, og constrainten håndhever beløps-regelen mot stempelet — ikke mot et oppslag som kan drifte. Inn i spec-en som eksplisitt krav til Opus: constrainten står på `ordning_ved_foering`, aldri på kategori-oppslag; applikasjonslogikk alene avvises.

## 2. Hvem setter prosjekt-overstyringen: firma-admin — bekreftet

Enig i ditt førstevalg, med samme begrunnelse: ordningen følger firmaets avtale med byggherre, og den endrer hvordan folk får betalt — det er firmanivå-myndighet (konsistent med firmarolle-konsolideringen: lønnsrelevante valg forankres i firmaroller). Prosjektadmin SER overstyringen i prosjekt-oppsettet (med kilde: «satt av firma-admin, følger byggherre-avtalen»), endrer den ikke. UI-et viser hvem som kan («Endres av firmaets administrator») i stedet for en død knapp — samme aldri-tyst-prinsipp.

## 3. Redigering av gammel rad: rediger innhold, aldri ordning — ordningsbytte = ny rad

Ditt sannsynlige svar bekreftes som regel:
- `ordningVedFøring` er **immutabel** etter insert (stemplet er historikk OG integritetsbærer — begge roller krever at det står).
- Redigering endrer innhold (beløp, kommentar, kvittering) innenfor radens ordning; CHECK-en fortsetter å gjelde mot det gamle stempelet, så en fakturert-rad kan aldri få beløp ved redigering.
- Skal en septemberrad «bli» utlegg under oktober-regimet, er det en **korreksjon**: ny rad med dagens utledning + gamle raden krediteres/annulleres synlig (aldri muteres) — samme disiplin som mot Proadm, der eksporterte rader uansett krever korreksjonspost, ikke overskriving.

## 4. Kvittering på fakturert-rad: tillatt, aldri påkrevd — bekreftet

Enig: frivillig dokumentasjon ≠ krav. Fakturert-raden får «+ Kvittering (valgfritt)» (8b, tredje kort); vedlegget er dokumentasjon, aldri refusjonsgrunnlag (beløp forblir null uansett — CHECK-en garanterer det). Eksport-guarden er upåvirket: fakturert når aldri penger, med eller uten vedlegg.

## Mockupen (venter Kenneths visuelle godkjenning)

- **8a velgeren:** én inngang, to grupper (Tillegg/Utlegg), én oppføring per kategori plassert etter DETTE prosjektets utledning; ordnings-pille som undertekst — aldri et valg. Samme interaksjonsmønster som opprett-velgeren.
- **8b tre radformer:** samme kategori på tre prosjekter → antall-rad (sats), beløp+påkrevd kvittering (utlegg), ren avhuking + valgfri kvittering (fakturert). Kilde-linje på hver rad («firma-standard» / «overstyrt for prosjektet») gjør utledningen sporbar.
- **8c mobil:** kamera-primær (kvitteringen er fysisk i hånda), beløp før bilde (6d fyller som forslag senere), Lagre gated på påkrevd kvittering, trykkmål ≥44 px.
