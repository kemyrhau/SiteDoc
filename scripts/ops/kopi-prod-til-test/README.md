# KOPI-PROD-TIL-TEST

Engangsskript (Kenneth 2026-11-26). Det kopierer A.Markussen AS og SITEDOC MYRHAUG fra prod (`sitedoc`) til test (`sitedoc_test`), slik at de to firmaene oppfører seg likt i begge miljøene. Ordre og avgjørelser: `relay/inbox-web-timer-w5.md` § «ORDRE KOPI-PROD-TIL-TEST» og § «[2. SKRIPT]». Målingen bak: `relay/kopi-prod-til-test/ut-alle.txt`.

**Kenneth kjører alt. Agenter kjører ingenting mot noen database.**

## Filer

| Fil | Innhold |
|-----|---------|
| `generer.py` | Lager de to SQL-filene. Konstanter (firma- og bruker-id-er) er målt 2026-11-26 og sjekkes på nytt av SQL-en. Kjør `python3 scripts/ops/kopi-prod-til-test/generer.py` fra repo-rot etter en endring. |
| `1-eksport-prod.sql` | Steg 1. Kjører mot `sitedoc` i én `READ ONLY`-transaksjon (REPEATABLE READ). Skriver CSV til `/tmp/kopi-prod-til-test/` i postgres-containeren. Anonymiseringen skjer i SELECT. |
| `2-import-test.sql` | Steg 2 og 3. Kjører mot `sitedoc_test` i én transaksjon med `ON_ERROR_STOP`. `-v commit=0` (standard) er tørrkjøring som ender med ROLLBACK. `-v commit=1` lagrer, men bare når alle kontroller holder. |

## Hva som kopieres

- **Begge firma:** organisasjonen, firmainnstillinger, reisegrenser, partnere (kontaktfelt = NULL), firmamoduler, seed-policy, avdelinger, arbeidstidskalender, kompetansetyper, medlemskap, oppmøtesteder og avstander, oppmøteperioder, reisetidsmatrise, ECO, lønnsarter, aktiviteter, tillegg, utleggskategorier, prosjekt-overstyring av utleggsordning, eksportoppsett, maskiner (`maskin.equipment`, bilder = NULL), varekategorier og varer.
- **Prosjektene som tomme prosjekter:** prosjekt (logo = NULL), firmakobling, byggeplasser, prosjektmoduler, faggrupper (`kontrakt_id` og `partner_id` = NULL), prosjektmedlemmer, dokumentflyt-koblinger, grupper, gruppemedlemmer, gruppe-faggrupper og gruppe-byggeplasser.
- **Bare SITEDOC MYRHAUG:** dagssedler med timerader, forslag, tillegg, utlegg, maskinlinjer, radhistorikk og vareforbruk på sedlene.
- **Brukere:** alle som radene over peker på, unntatt Kenneth. E-posten blir `<8 første tegn av id>@test.sitedoc.invalid`. Telefon, bilde, fødselsdato, nasjonalitet, HMS-kort, arbeidstillatelse og `email_verified` settes til NULL. Brukere som ikke er medlem i noen av de to firmaene (tredjepersoner med via prosjektmedlemskap) får `can_login = false` og navnet `Ekstern <8 første tegn av id>`. Prosjektmedlemskapet deres beholdes. Firmaets faktura-e-post blir fiktiv.
- **Kopieres ikke:** innlogging (`accounts`, `sessions`, tokens, push-tokens), API-nøkler (`organization_integrations`), revisjonslogg, impersonering, 3D, tegninger, sjekklister, oppgaver, HMS/PSI, dokumenter, mapper, økonomi, dokumentsøk, filer på disk, vedleggsrader på tillegg og utlegg, `ansatt_kompetanser`, `bruker_innstilling`, sjekkliste-maler (`organization_templates`), maskinservice, feilmeldinger, vegvesen-kø, maskinansvarlige og utlevering, og A.Markussens dagssedler.

## Id-omskriving (på test, i TEMP-tabellene)

- SITEDOC MYRHAUG beholder test-id-en `f1000001-…0002`. Prod-id-en `0bca7497-…` skrives om overalt: i tekstkolonner, tekst-lister og json.
- Kenneths prod-id `74730685-…` skrives om til test-id-en `40153a94-…`.
- Organisasjonsraden til SM **oppdateres** fra prod og slettes ikke. Test-SMs 5 prosjekter med sjekklister og tegninger blir stående urørt.
- A.Markussen får prod-id-en sin. Finnes et A.Markussen på test fra før (id, navn eller orgnr), stopper skriptet.

## Hva som slettes på test først (bare test-SM)

Dette slettes: dagssedler med alle rader og vedlegg, radhistorikk, vareforbruk på sedlene og på SMs varer, lønnsarter, aktiviteter, tillegg, utleggskategorier og overstyringer, eksportoppsett, varer og kategorier, maskiner med service, feil, kø, ansvarlige og utlevering, oppmøteperioder, reisetidsmatrise, avstander, oppmøtesteder, medlemskap, kompetansetyper (med `ansatt_kompetanser` som peker på dem), avdelinger, arbeidstidskalender, firmamoduler, firmainnstillinger, reisegrenser, seed-policy og partnere.

Dette blir stående: organisasjonsraden, test-SMs prosjekter med innhold, firmakoblingen deres, ECO, sjekkliste-maler og brukerradene.

## Kontroller (stopper og ruller tilbake ved feil)

- **E0/I0:** firma-id, navn og Kenneths id stemmer i begge databaser. Det finnes ingen A.Markussen på test. Manifestet har 44 tabeller, og kolonnerekkefølge og typer er like i prod og test.
- **I1b (før sletting):** ingen rad som blir stående på test, peker på en rad som skal slettes. Det fanger Restrict, Cascade og SetNull (f.eks. `Faggruppe.partner`, `OrganizationMember.avdeling`, `Oppmotested.avdeling`), slik at test-SMs prosjekter står urørt. Treff = STOPP.
- **I2 (etter sletting):** ingen slettede rader er igjen. Ingen rad som står igjen på test peker på en slettet rad. Logg-tabellene `activity_log` og `impersonation_audit` er unntatt.
- **I4:** ingen prod-id for SM eller Kenneth er igjen etter omskrivingen.
- **K1:** antall per tabell er det samme i prod-eksporten, i det som er lest inn og på test. Det er 2 organisasjoner, og det er minst én seddel og én bruker.
- **K2:** importerte rader har 0 hengende `*_id`-referanser. Unntatt er `kort_id`, `original_rad_id`, `proadm_id` og `kilde_id`, som ikke peker på en rad.
- **K3 (negativkontroll):** ingen importert bruker har en e-post som ikke slutter på `@test.sitedoc.invalid`. Ingen har persondata igjen, og ingen ikke-medlem har ekte navn. Kontrollen stopper hvis den er tom. Ingen avledning av ekte e-post (heller ikke md5) skrives til fil.
- **K4:** viser prosjektnavn som finnes to ganger i samme firma. Begge beholdes.
- **K5:** oversikt per firma (medlemmer, prosjekter, lønnsarter, sedler, maskiner og reise-lønnsart).

## Kommandoer (Kenneth)

`f724508b` er commiten med SQL-filene som skal gates (RETUR 2026-11-26). Denne README-commiten endrer ikke SQL-filene.

**A. Hent de gatede filene og legg dem på server-ny**
```bash
cd ~/Documents/Programmering/SiteDoc && git fetch -q origin && for f in 1-eksport-prod 2-import-test; do git show f724508b:scripts/ops/kopi-prod-til-test/$f.sql > /tmp/$f.sql; done && scp /tmp/1-eksport-prod.sql /tmp/2-import-test.sql server-ny:/tmp/
```

**B. Backup av test, eksport fra prod og tørrkjøring (ingenting lagres på test)**
```bash
ssh -t server-ny "set -e; df -h ~ | tail -1; sudo docker exec postgres pg_dump -U sitedoc -Fc sitedoc_test > ~/sitedoc_test-for-kopi-20261126.dump; ls -l ~/sitedoc_test-for-kopi-20261126.dump; echo -n 'tabeller med data i backup: '; sudo docker exec -i postgres pg_restore -l < ~/sitedoc_test-for-kopi-20261126.dump | grep -c 'TABLE DATA'; for f in 1-eksport-prod 2-import-test; do sudo docker cp /tmp/\$f.sql postgres:/tmp/\$f.sql; done; sudo docker exec postgres psql -U sitedoc -d sitedoc -f /tmp/1-eksport-prod.sql; sudo docker exec postgres psql -U sitedoc -d sitedoc_test -v commit=0 -f /tmp/2-import-test.sql" 2>&1 | tee ~/Documents/Programmering/SiteDoc/relay/kopi-prod-til-test/ut-torrkjoring.txt
```
Siste linje skal være «TØRRKJØRING: alt rullet tilbake». Står det «STOPP» et sted, er ingenting endret.

**C. Ekte import, bare etter at tørrkjøringen er lest og godkjent. Den bruker samme CSV-er som i B**
```bash
ssh -t server-ny "sudo docker exec postgres psql -U sitedoc -d sitedoc_test -v commit=1 -f /tmp/2-import-test.sql" 2>&1 | tee ~/Documents/Programmering/SiteDoc/relay/kopi-prod-til-test/ut-import.txt
```
Siste linje skal være «FERDIG: COMMIT».

**D. Rydding (steg 4). Fjerner CSV-ene (bruker-id-er og anonymiserte rader) og SQL-filene. Backupen blir liggende**
```bash
ssh -t server-ny "sudo docker exec postgres rm -rf /tmp/kopi-prod-til-test /tmp/1-eksport-prod.sql /tmp/2-import-test.sql; rm -f /tmp/1-eksport-prod.sql /tmp/2-import-test.sql"
```

**Tilbakestilling: legg backupen tilbake hvis test blir feil etter C**
```bash
ssh -t server-ny "sudo docker exec -i postgres pg_restore -U sitedoc -d sitedoc_test --clean --if-exists --no-owner --single-transaction < ~/sitedoc_test-for-kopi-20261126.dump"
```
Tilbakestillingen er ikke prøvd. Hvis den henger på låser fra api-test, må api-test-containeren stoppes mens den kjører.

**Slett backupen når test er verifisert**
```bash
ssh -t server-ny "rm -f ~/sitedoc_test-for-kopi-20261126.dump"
```
