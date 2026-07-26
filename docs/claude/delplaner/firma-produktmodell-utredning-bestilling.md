# Utrednings-bestilling til fabel: Firmaorientert produktmodell (modulkjøp + standalone-avvikling)

> Til fabel (tom kontekst — denne fila står alene). Fra Kenneth via cowork, 2026-07-26. Dette er en **utredning/design-bestilling**, ikke en byggeordre. Leveranse = beslutnings-/design-dokument, ikke kode.

## Bakgrunn (hele konteksten du trenger)

SiteDoc ble opprinnelig bygget **prosjektorientert** (frittstående prosjekter, prøveperiode per prosjekt). Produktet har siden dreid **firmaorientert**: et firma (Organization) er kjøps-/konto-enheten, kjøper prosjektmodul og/eller timemodul, og utvider med undermoduler.

Utløseren for denne utredningen: en ubetinget per-prosjekt-grense på **10 sjekklister / 10 oppgaver** (`sjekkliste.ts:333–346`, `oppgave.ts:460–473`) — en relikvie fra den prosjektorienterte æraen — blokkerte pilotkunden (50 ansatte). En **interim-fiks** er bestilt separat ([sjekklistegrense-provestatus-ordre-2026-07-26.md](sjekklistegrense-provestatus-ordre-2026-07-26.md)): grensen gates på firma-tilknytning (firma-prosjekt → grenseløst, standalone → 10). Det låser opp piloten. Denne utredningen tar det **strukturelle** spørsmålet interim-en bevisst utsatte.

## Cowork-måling (så du slipper å re-måle — verifiser gjerne)

- **Firma er alt de-facto konto-/faktura-enheten:** `Organization` har `invoiceAddress`, `invoiceEmail`, `ehfEnabled` (B2B faktura/EHF). Det finnes en `apps/web/.../firma/fakturering`-side. Ingen kort-betaling (ingen Stripe/Vipps i SiteDoc-koden) — betaling er faktura/EHF på firma-nivå. Den gamle betalingsløsningen er borte fra synlig UI.
- **Firma-nivå modulkjøp finnes — men bare for firmamodulene:** `OrganizationModule` (`moduleSlug`: "timer" | "maskin" | fremtidig kompetanse/varelager, status aktiv/arkivert). `erFirmamodulAktivert(orgId, slug)` gater timer-tilgang.
- **Prosjektmodulene henger igjen i prosjekt-æraen:** sjekklister/oppgaver/tegninger/hms osv. er **per-prosjekt av/på** via `ProjectModule` (feature-toggle), IKKE et «firmaet har kjøpt prosjekt-produktet»-signal. Det finnes ingen `OrganizationModule`-slug for prosjekt-produktet.
- **Firmainnstillinger griper alt inn i prosjekt-atferd:** `OrganizationSetting.autoProsjektAdmin` styrer hvem som auto-legges som admin ved nye prosjekter; tilgangs-defaults (timer/vareforbruk/maskinbruk) gjelder på tvers av firmaets prosjekter.
- **Standalone (orgløs) er en kant-tilstand, ikke en tier:** prosjekt-opprettelse (`prosjekt.ts:286`) faller tilbake til brukerens egen org; kun en bruker UTEN firma lager et standalone-prosjekt. `admin.ts` trial-deaktiverer standalone-prosjekter; firma-prosjekter aldri. Doc/kode-drift: CLAUDE.md sier «firma påkrevd, uten `.optional()`», men `prosjekt.ts:104` har `.optional()`.
- **Ingen plan-/abonnement-/tier-felt finnes** på Organization eller Project.

## Spørsmål å utrede (rangér svarene, anbefal ett per punkt)

1. **Standalone-prosjekter (orgløs): avvikles eller beholdes?** Er det et reelt bruksmønster (soloaktør uten firma), eller ren relikvie som bør fases ut (firma påkrevd, som CLAUDE.md alt påstår)? Konsekvens for eksisterende standalone-data hvis avvikling.
2. **Firma-modulkjøp for prosjekt-produktet: hvordan formaliseres det?** Skal prosjekt-produktet bli en `OrganizationModule`-slug (f.eks. "prosjekt") på linje med timer/maskin? Hva blir da forholdet mellom firma-nivå kjøp og de per-prosjekt `ProjectModule`-togglene (kjøp gir tilgang, toggle styrer synlighet)?
3. **Fri/prøve-grense i den nye modellen:** skal 10-grensen finnes i det hele tatt fremover, og i så fall hengt på hva (prøvestatus på firma? modul-ikke-kjøpt?)? Eller erstattes hele fri-tier-tanken av «firma må ha kjøpt modulen for å bruke den»?
4. **Faktura ↔ moduleierskap:** hvordan henger `firma/fakturering` + EHF-feltene på modulkjøp? (Nivå: konsept/retning, ikke betalingsintegrasjon.)
5. **Interim → proper overgang:** når prosjektmodul-eierskapet lander, strammes sjekkliste-/oppgave-guarden fra «har firma» til «firma har prosjektmodul». Noter migrasjonsstien.

## Ikke i scope
Betalingsintegrasjon (kort/Stripe/Vipps). Selve interim-guarden (egen ordre, under bygging). Implementasjon — dette er utredning/design først, byggeordre kommer etterpå.

## Leveranse
Beslutnings-/design-dokument med rangerte anbefalinger per spørsmål over, klart til å bli en byggeordre. Legg det i `docs/claude/delplaner/`.
