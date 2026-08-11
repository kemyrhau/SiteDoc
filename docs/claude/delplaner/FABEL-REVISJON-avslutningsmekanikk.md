# Fabel — REVISJON: avslutningsmekanikk etter bransjemønsteret — 2026-08-11

Mønsteret adopteres. Det er bedre enn både trappemodellen min og «fakturer til
kunden sletter» — punkt 6 (penger og data som to spor) er nøkkelen, og coworks
observasjon om at systemet slipper å kjenne betalingsstatus for å avgjøre
dataskjebne er det som gjør modellen byggbar. Prismodellen deres tas ikke inn,
per Kenneths avgrensning.

## Revidert tilstandsmaskin — tre tilstander, ett flagg

```
aktiv ──(skrivestopp-dato / oppsigelse)──▶ stengt ──(formell oppsigelse + hale)──▶ opphørt
```

- **aktiv** — abonnement løper. Eksport selvbetjent og gratis (eksport-sporet).
- **stengt** — skriving av. Lesing + selvbetjent eksport åpen. Fakturering
  løper (arkivpris — innspillet mitt står, ⚖ Kenneth).
- **opphørt** — terminal for tilgang: all tilgang stengt, data står urørt i
  halen. Inngangen er **formell oppsigelse** (kundens handling, bekreftet i
  flaten — samme bekreftelsesmønster som før, men den avslutter fakturering
  uten å slette). Etter halen har SiteDoc **rett** til å slette — manuell
  handling Kenneth utfører fra fakturaflaten, aldri en jobb som kjører.
  Kunden kan innen halefristen skriftlig be om fortsatt lagring (→ tilbake
  til stengt med arkivpris).
- **mislighold er et FLAGG på faktureringen** (settes manuelt i
  fakturaflaten), ikke en datatilstand. Effekt: `stengt`-tilgang (begrenset)
  + merkelapp i registeret. Det rører aldri dataskjebnen — sletting krever
  fortsatt formell oppsigelse + hale. Rente/inkasso er avtale, ikke system.

Konsekvenser som bekreftes: **S2 faller bort som forutsetning** (data i
`stengt`/hale ligger der de ligger; kald lagring forblir ren driftssak).
Trinn 3 i trappemodellen utgår. `avsluttet`-tilstanden min erstattes av
`opphørt` + hale + manuell sletterett.

## Eksport etter opphør: selvbetjent i halen — bevisst avvik fra mønsteret

Anbefaling: **selvbetjent så lenge dataene finnes** (dvs. også i halen).
Begrunnelse: (a) manuelt uttrekk er dyrere for Kenneth enn å la eksisterende
funksjon stå — mønsterets «tjeneste» er en stor leverandørs valg, ikke en
énmannsdrifts; (b) jobbkø + signert URL er allerede tilgangsstyrt, så
kostnaden er null ekstra kode; (c) det ufarliggjør halefristen. Avviket er
trygt fordi punkt 4s FORMÅL (slippe å drifte eksport evig) ivaretas av at
halen er endelig. Eneste innstramming: i halen er eksport tilgjengelig kun
for firma-admin (ikke prosjektadmin) — kontoen er under avvikling.
⚖ Kenneth bekrefter avviket.

## Halelengde: anbefaler 3 måneder

Mønsterets 3 er riktig: 2 er kortere enn en normal ferieperiode + purreløp;
6 undergraver poenget med opphør (et halvt år gratis lagring). 3 måneder med
skriftlig forleng-frist på 1 måned (kortere enn halen, per mønsterets
punkt 3). Viktigst: dette er en AVTALESTØRRELSE — systemet lagrer
`opphortDato` og viser halefrist i registeret, men ingen automatikk utløses
av den. Endrer Kenneth 3 til noe annet i avtalen, endres en konstant.
⚖ Kenneth beslutter.

## Punkt 5 — kundens eget kopiansvar

Tas inn som tekst, ikke kode: setningen («Lisenstakeren er selv ansvarlig for
å lagre en lokal kopi …» — omformulert til SiteDocs avtale) hører hjemme i
avtalen OG som stillferdig linje på eksport-siden i appen. Den styrker
eksport-sporets prioritet: selvbetjent eksport er det som gjør setningen
rimelig å skrive.

## Endringer i pågående ordrer

- **Eksport-ordren (cowork skriver):** uendret omfang; legg til at
  eksport-tilgangen følger tilstandene over (aktiv/stengt: som spesifisert;
  hale: kun firma-admin). Slette-flate-avhengigheten omformuleres: det som
  krever eksport på plass er nå **oppsigelses**-flaten, ikke en slette-flate
  (kunden sletter ikke selv lenger — SiteDoc har sletteretten etter halen).
- **Abonnementsordren:** kan nå skrives ferdig når Kenneth har tatt de tre
  ⚖-ene over (arkivpris, selvbetjent hale-eksport, halelengde). Mislighold
  er avblokket — flagg, ikke tilstand.
- 60-dagersvinduet: bortfaller som egen størrelse — halen dekker funksjonen
  (Kenneths «60 dager» var svar på et spørsmål modellen ikke lenger stiller;
  bekreft gjerne eksplisitt at halen erstatter det).

— fabel (relayet av Kenneth)
