# Firmaorientert produktmodell — beslutnings-/designdokument (fabel, 2026-07-26)

> Svar på [firma-produktmodell-utredning-bestilling.md](firma-produktmodell-utredning-bestilling.md). Utredning, ikke byggeordre — men skrevet så den kan bli én. Rangerte anbefalinger per spørsmål; anbefalt alternativ først.

## Fabels kodeverifisering av cowork-målingen (2026-07-26)

Målt selv mot koden (fakta-først). Bekreftet: `OrganizationModule` + `erFirmamodulAktivert` (firmamodul.ts:26) er etablert mønster med moduleGate per modul; `ProjectModule` er per-prosjekt toggle uten firma-kjøpssignal for prosjektmodulene; sjekkliste-guarden (sjekkliste.ts:333–346) er rolle-gated og teller med `IKKE_SLETTET` (soft-delete-punktet er løst); `prosjekt.ts:104` har `.optional()` på organizationId (kode↔CLAUDE.md-drift bekreftet); `firma/fakturering`-siden finnes; trial-deaktiveringen (admin.ts:352) er scopet `projectOrganizations: { none: {} }` — treffer kun orgløse prosjekter.

**Korreksjoner/tillegg til målingen:**
1. `varelager` er ALT en live firmamodul-slug (`FirmamodulSlug = "timer" | "maskin" | "varelager"`, egen moduleGate) — ikke «fremtidig». Mønsteret for å legge til en ny slug er altså brukt tre ganger og modent.
2. `trialExpiresAt` settes ALDRI ved prosjektopprettelse — kun av backfill-migrasjonen (20260405120000, orgløse prosjekter) og admin.forlengProsjekt. Nye standalone-prosjekter får null; admin-jobben fallbacker da til createdAt+30d. Prøvemodellen er altså implisitt, ikke eksplisitt.
3. `Organization.erKunde` skiller reelt kundefirma fra **skall-firma** (kun part i prosjekt/dokumentflyt). Relevant kant for interim-guarden, se § 5.

**Enkeltmålt** (cowork-måling ikke re-målt av fabel): «ingen Stripe/Vipps i koden» og «gammel betalingsløsning borte fra synlig UI». Ligger ikke på kritisk sti for anbefalingene.

## 1. Standalone-prosjekter: avvikles eller beholdes?

**Anbefalt (1): Avvikle standalone som tilstand — firma påkrevd, enmannsfirma er også et firma.**
Standalone er allerede en kant-tilstand, ikke en tier: den oppstår kun når en bruker uten org oppretter prosjekt, den kan ikke ha firmamoduler (hentOnboardingStatus dokumenterer det eksplisitt), og admin-jobben behandler den som prøve-søppel (30d deaktiver / 90d slett). Produktdreiningen (firma = konto-enhet) gjør den meningsløs som salgsobjekt. Grep: onboarding oppretter/knytter alltid et firma ved registrering (soloaktør → enmannsfirma med `erKunde=false` inntil kjøp); `createProjectSchema` mister ikke `.optional()` (sitedoc_admin-flyten trenger det), men opprettelses-koden nekter `valgtOrgId === null`. Da blir CLAUDE.md-påstanden («firma påkrevd») sann i stedet for å rettes ned.
**Eksisterende standalone-data:** ingen migrering nødvendig — trial-livssyklusen i admin.ts fases dem ut av seg selv. Tilby «knytt prosjektet til firma»-handling for de få reelle (sitedoc_admin kan gjøre det manuelt i dag via ProjectOrganization; en liten selvbetjent variant kan bestilles ved behov).

**(2): Behold standalone som formalisert gratis prøve-tier.** Krever at prøvemodellen gjøres eksplisitt (sette trialExpiresAt ved opprettelse) og at grensene henger på den. Mer kode for å bevare noe produktet dreier bort fra.

**(3): Behold som i dag (implisitt).** Frarådes — det er nettopp denne implisittheten som produserte pilot-blokkeren.

## 2. Firma-modulkjøp for prosjekt-produktet

**Anbefalt (1): Ny `OrganizationModule`-slug `"prosjekt"` — ett kjøp for hele prosjekt-suiten; `ProjectModule` består som synlighets-/konfigurasjonslag.**
To lag med klar arbeidsdeling: `OrganizationModule("prosjekt")` = firmaet HAR produktet (kjøpssignal, fakturagrunnlag); `ProjectModule` = hvilke deler som VISES i det enkelte prosjekt (feature-toggle, som i dag). Gjenbruker etablert maskineri: `FirmamodulSlug` utvides, `erFirmamodulAktivert(orgId, "prosjekt")` blir gaten, moduleGate-mønsteret er brukt tre ganger allerede. Én slug for hele suiten (sjekklister/oppgaver/tegninger/hms/dokumentflyt) matcher salgsmodellen «prosjektmodul + timemodul, utvid med undermoduler» — undermoduler som skal selges separat (kompetanse, varelager) er allerede egne slugs.
**Merk:** `syncProjektModulerPaaAktiver` synker i dag ProjectModule-rader per firmamodul-slug; `"prosjekt"`-slugen skal IKKE synke en `ProjectModule("prosjekt")`-rad — den er et rent eierskapssignal. Det bør stå eksplisitt i byggeordren.

**(2): Plan-/tier-felt på Organization** (`plan: "trial" | "kunde"`). Enklere å lese, men parallelt system ved siden av modul-maskineriet, og svarer ikke på «hvilke produkter har firmaet» — det trengs uansett for timer/maskin/varelager.

**(3): Per-undermodul org-slugs for alt** (sjekkliste, oppgave, tegning …). Mest granulært, mest admin-friksjon; kan innføres senere per undermodul som faktisk selges separat, uten å endre arkitekturen.

## 3. Fri/prøve-grense i den nye modellen

**Anbefalt (1): 10-grensen består, men hengt på modul-eierskap, ikke rolle:** firma har `OrganizationModule("prosjekt", aktiv)` → ingen antallsgrense; ikke kjøpt (prøve/skall/enmannsfirma) → 10 sjekklister / 10 oppgaver per prosjekt. `sitedoc_admin`-unntaket består. Grensen gjør da jobben feilmeldingen alltid har lovet («Kontakt SiteDoc for å oppgradere») uten å treffe betalende kunder. Prøve-tid (trialExpiresAt) og prøve-volum (10-grensen) blir to uttrykk for samme akse: modul ikke kjøpt.
**Tilleggsfunn:** skal prøve-TID gjelde firma-prosjekter uten kjøpt modul, må trialExpiresAt settes eksplisitt ved prøvestart — i dag settes den aldri, og admin-jobben er scopet til orgløse. Det er en egen liten beslutning (anbefales: ja, ved første prosjekt i firma uten «prosjekt»-modul), ikke del av guard-fiksen.

**(2): Grense kun for standalone** (= interim-tilstanden gjort permanent). Holder til pilot, men gir gratis grenseløshet til ethvert firma-prosjekt for alltid — ingen oppgraderingsmekanisme.

**(3): Fjerne grensen helt.** Frarådes — uten den finnes ingen friksjon mellom «prøver gratis» og «kjøpt».

## 4. Faktura ↔ moduleierskap (konsept)

`OrganizationModule` ER fakturagrunnlaget: raden bærer allerede periode (aktivertVed/deaktivertVed), hvem (aktivertAvUserId) og status — en fakturalinje per aktiv modul per periode. `Organization` bærer allerede mottaket (invoiceAddress, invoiceEmail, ehfEnabled). Anbefalt retning: `firma/fakturering`-siden viser aktive moduler med aktiveringsdato som grunnlag; sitedoc_admin-aktivering av en modul = registrert salg. Ingen betalingsintegrasjon (utenfor scope); manuell faktura/EHF som i dag. Ingen nye felter nødvendig for konseptet — et evt. `pris`-/avtalefelt kan legges på OrganizationModule den dagen fakturering automatiseres.

## 5. Interim → proper migrasjonssti

1. **Nå (interim, egen ordre under bygging):** guard-hjelper gates på firma-tilknytning. Kjent svakhet: også skall-firma-prosjekter (`erKunde=false`) blir grenseløse. Akseptabel interim-risiko — noteres, lukkes av steg 3.
2. **Backfill ved utrulling av proper:** alle firmaer som skal beholde tilgang får `OrganizationModule("prosjekt", "aktiv")` seedet — kandidatmengde: `erKunde=true` ELLER firma med aktive kunde-prosjekter (cowork måler eksakt mengde mot produksjonsdata før kjøring). Kjøres FØR guard-endringen — ingen kunde skal treffe grensen i mellomrommet.
3. **Stram guarden:** samme delte guard-hjelper bytter predikat fra «har firma» til `erFirmamodulAktivert(orgId, "prosjekt")` — én linje i én fil (interim-ordren krever allerede delt hjelper i begge guards). Samme deploy som backfill.
4. **E2e/agent-prosjektet** får `OrganizationModule("prosjekt")` på sitt firma — tester dermed vanlige rollebaner uten sitedoc_admin-krykke, og uten opprydding-avhengig kvote.
5. **Deretter (separat):** standalone-avvikling (§ 1) og eksplisitt trialExpiresAt-setting (§ 3) som egne små ordrer.

## Beslutninger (Kenneth via fabel, 2026-07-27 — BEKREFTET)

- § 1: **Ja** — firma påkrevd ved onboarding; soloaktør får auto-enmannsfirma (`erKunde=false` inntil kjøp).
- § 2: **Én `"prosjekt"`-slug** for hele suiten — rent eierskapssignal, **INGEN `ProjectModule("prosjekt")`-sync** (jf. § 2 «Merk»).
- § 3: **Kombinasjon** — 10-grensen gjelder mens `"prosjekt"`-modul ikke er kjøpt; i tillegg settes `trialExpiresAt` ved prøvestart (**30 dager**), og eksisterende `admin.forlengProsjekt`-mekanisme gjenbrukes for forlengelse.

**Byggeordre (§ 2+3+5) — PARKERT.** Skrives av fabel på Kenneths klarsignal, ETTER at interim-guarden (`feat/sjekklistegrense-firma`) og admin-redesignen (`feat/admin-firmaorientert`) har landet. Innhold: ny `"prosjekt"`-slug (uten ProjectModule-sync) + eksplisitt `trialExpiresAt`-setting (30d) + backfill-script + predikatbytte i delt guard. **Cowork måler eksakt backfill-kandidatmengde mot produksjonsdata** (`erKunde=true` ELLER firma med aktive kunde-prosjekter) FØR § 5-kjøring — ingen kunde skal treffe grensen i mellomrommet.
