# Ordre: verifisering av SJA-signaturrunder mot mockup (grunnlag for skjermbilde-gaten)

**Til:** verifiseringsagent (web + iOS-simulator) · **Fra:** design-rollen (har overtatt etter Fabel) · **Skrevet:** 2026-09-17
**Spor:** plan-sporet (masterplan 0a SJA, P0)
**Worktree/branch:** cowork velger og fører tavle-raden. Forslag: `~/Documents/Programmering/SiteDoc-simulator`, detached `origin/develop`.
**Status:** FERDIGSKREVET, ikke gitt (cowork gater før relay)

---

## ⚠️ Kontekst cowork må se før relay

**SJA-signaturrunder er allerede i prod** (`ad18df93`, 06.09, migreringene `20260906000000_sja_signaturrunder` m.fl. + OTA `333359a6`).
Underlaget sa «ingenting til prod før denne gaten». Det holdt ikke. Risikoen ble vurdert lav fordi
`signature_list` er inert til en mal bruker objektet (STATUS-AKTUELT, prod-runden 06.09).
**Gaten er derfor en etterkontroll, ikke en port.** Avvik den finner blir ordrer, ikke rollback,
med mindre de er 🔴 blokkerende for lovpålagt dokumentasjon.

**Underlaget er eldre enn koden.** Etter `skjermbilde-underlag-sja-signaturrunder-2026-09-06.md` ble dette levert:
serverlås mot skriving på avsluttet runde (`5e13c43e`) · innholdsversjon per signatur · «bekreftet av» på
gjestesignatur · splittet teller «X signert + Y bekreftet» · kollapset signaturflate · PSI-signaturfikser
(`890d17e2`, `7a5afe7c`). **Rapporter det som VISES, ikke det underlaget forventer.** Avvik mellom
underlag og skjerm er data til gaten, ikke feil fra deg.

---

## Les først

- `docs/redesign/til-fabel/skjermbilde-underlag-sja-signaturrunder-2026-09-06.md` (scenariet, seed, åtte flater)
- `docs/redesign/mockups/SJA Signaturer Mockup.dc.html` (fasit å sammenligne mot, åpnes i nettleser)
- Web: `docs/claude/mcp-playwright-simulator-oppsett.md` (attach til Kenneths innloggede Chrome, **ikke** OAuth i agent-Chrome)
- Mobil: `docs/claude/simulator-opus-oppkobling.md` + `simulator-runbook.md` + `dev-login-agent.md`

## Steg 0: bekreft at du måler riktig kode og data

1. `curl -s https://api-test.sitedoc.no/version` skal gi `70c1e556` eller nyere. Oppgi SHA-en i rapporten.
2. Bekreft at prosjekt `SD-DEMO-SJA-0001` og SJA «Løft mobilkran — Akse 4» finnes på test, med runde 1 avsluttet og runde 2 åpen (1 av 4).
   **Lesing mot `sitedoc_test`, aldri `sitedoc`.** Er dataen endret siden seeding (f.eks. noen har signert),
   **stopp og meld**. Re-seeding er Kenneths kommando, ikke din.
3. **Mobil-innlogging:** seeden gjør `kemyrhau@gmail.com` til deltaker. Dev-login-brukere er ikke deltakere, så
   «Signer» vises ikke for dem på mobil. **Det er riktig gating, ikke en feil.** Verifiser mobil lesende
   (leder, manko, rekkefølge) og meld at «Signer» på mobil er umålt, med mindre Kenneth har seedet en
   dev-login-bruker som deltaker før du starter.

## Bevisform (SAMARBEIDSREGLER § 10c)

**Tekst først.** For hver flate: tekstinnhold i rekkefølge (DOM-tekst på web, `idb ui describe-all` på mobil),
tellertekst, knappetekster, antall klikk. **Skjermbilde bare der spørsmålet er visuelt**, og da merket i
tabellen under. **Maks 8 skjermbilder totalt**, skalert ned. Legg dem i `relay/sja-gate-bevis/` med flatenummer i filnavnet.

## Flatene: kjør i DENNE rekkefølgen (flate 7 må tas før flate 3 endrer data)

| # | Flate | Hva du måler (tekst) | Skjermbilde? |
|---|---|---|---|
| 1 | Web: HMS-lista → SJA-fane | Chip-tekst på SJA-kortet og fargefamilie (les klassen: amber/green) | ✅ 1 bilde |
| 2 | Web: SJA åpnet | Objekt-leder (eksakt tekst) · rekkefølgen på seksjonene (manko → signert → tidligere runder) · hvilke rader står i manko · gjest-radens tekst · handlingsknapper · om «Tidligere runder» teller med i X | ✅ 1 bilde |
| 7 | Web: arkiv-PDF (Skriv ut) **før signering** | Topplinjen · rader merket «IKKE SIGNERT» · om forrige-runde-raden (Nina) er med · «Med logg»-seksjonen: begge runder med dato/årsak | ✅ 1 bilde av side 1 |
| 3 | Web: «Signer» på egen rad | Antall klikk fra åpnet dokument til signert · hva som skjer med raden · teller før/etter | ❌ tekst holder |
| 4 | Web: «Legg til deltaker» | Modalens felter (prosjektmedlem-nedtrekk, gjesteskjema) · Avbryt finnes · klikk til lagt til. **Avbryt, ikke legg til.** | ❌ |
| 5 | Web: «Avslutt runde» → låst → «Start ny runde» | Låsetekst (eksakt) · om felt faktisk er låst (prøv å redigere ett felt, meld hva som skjer) · modal for ny runde: felter + Avbryt. **Avbryt ny runde; avslutt runde 2 bare hvis Kenneth har sagt ja i relay-meldingen.** | ✅ 1 bilde av låst tilstand |
| 6 | Web: MalBygger-guard | Dra et andre `signature_list` inn i SJA-malen → modaltekst (eksakt). **Ikke lagre malen.** | ❌ |
| 8 | Mobil (simulator): samme SJA i sjekkliste-detalj | Leder · rekkefølge manko/signert · gjest-rad · om «Signer» vises (se steg 0.3) | ✅ maks 2 bilder |

**Klikk-budsjett å rapportere faktisk tall for:** signer egen rad (≤ 2) · finne manko fra lista (0 nye) ·
åpne → Start ny runde → bekreft (≤ 3) · legg til deltaker (≤ 3 web / ≤ 2 mobil).

## Utenfor scope

- Ingen kodeendringer, ingen commits, ingen docs-endringer utover bevismappa og rapporten.
- Ikke konkluder om **årsak** til avvik. Rapporter observasjon + fil:linje hvis du ser den uten å lete.
- Ikke svar på designspørsmålene i underlaget (1-klikks attest, medlemsfirma). De avgjøres i gaten.
- Ikke prod. Ikke re-seed.

## Rapport

Append til `/Users/kennethmyrhaug/Documents/Programmering/SiteDoc/relay/inbox-cowork.md` som
`## [YYYY-MM-DD tt:mm] fra verifisering → SJA-gate-bevis`:

1. SHA målt mot + innlogging brukt (web/mobil)
2. Tabell per flate: **observert tekst** · klikk · avvik mot underlag/mockup (✅ / ⚠️ / umålt)
3. Liste over skjermbilder med sti
4. Alt du ikke fikk målt, med grunn

Cowork flytter rapporten til `docs/redesign/til-fabel/` så design-rollen kan kjøre gaten.

## DoD

- Alle åtte flater har en rad: målt eller eksplisitt «umålt + grunn». **Ingen tomme rader.**
- Flate 7 er målt før flate 3.
- Maks 8 skjermbilder.
- Testdata er urørt bortsett fra flate 3 (én signatur på Kenneths rad), og det står i rapporten.
