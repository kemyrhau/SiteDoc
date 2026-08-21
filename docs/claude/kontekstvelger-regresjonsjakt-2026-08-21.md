---
name: kontekstvelger-regresjonsjakt-2026-08-21
description: Hva prosjekt-/byggeplassvelgeren mistet i k3-runden, hvorfor det ikke ble oppdaget, og fire dokumenter som påstår noe koden ikke gjør.
sist_verifisert_mot_kode: 2026-08-21
sist_endret: 2026-08-21
---

# Kontekstvelgeren — hva forsvant, og hvorfor ingen så det

**Bestilt av Kenneth 2026-08-21:** *«jeg opplever stadig at fikser forsvinner på mystisk vis.»*
Hans to hypoteser: agenter reverserer til eldre varianter, eller sletter kode de tror er død.

**Svaret er en tredje forklaring** — og den er verre enn begge, fordi den ikke etterlater spor
i git.

## Kortversjonen

`ad7cadc1` (2026-07-22, «kontekstvelger som trakt») skrev en **helt ny** velger i stedet for å
gjenbruke `ProsjektVelgerPanel`/`FirmaVelgerPanel`. Vedtaksdokumentet spesifiserte hva trakten
**skulle** ha. Det spesifiserte aldri hva den gamle **hadde**.

Favoritter er ikke nevnt med ett ord i `k3-kontekstvelger-vedtak.md`, `k3-ordre.md` eller
`kontekstvelger-funn-2026-07-21.md`. Ingen tok en beslutning om å droppe dem. De sto bare ikke
på lista.

**Ingen revert finnes.** Ingen A→B→A. Ingen gjeninnføring av slettet kode. Hypotese (a) er
ikke bekreftet i sin sterke form — men se § Hvorfor det føles som mystikk.

## De syv tapene

| # | Hva | Forsvant i | Gjenopprettet |
|---|---|---|---|
| 1 | **Favoritter** (stjernemerking) i velgeren | `ad7cadc1` | Nei — erstattet av «Sist brukt» (recency ≠ brukervalg) |
| 2 | **«Alle/Mine prosjekter» som faktisk valg** | `ad7cadc1` | Nei — pillen filtrerer nå bare lista lokalt |
| 3 | **Autofokusert søkefelt**, og søk under 7 elementer | `ad7cadc1` | Nei |
| 4 | **Autovalg av første byggeplass** | `4d52114e` | Nei — se under, dette er datakvalitet |
| 5 | **Ett klikk ekstra** for å bytte prosjekt | `ad7cadc1` | Nei |
| 6 | `/dashbord/maskin`-fiksen anvendt ett av tre steder | — | Aldri hel |
| 7 | Fire dokumenter beskriver kode som ikke finnes | — | Rettet 2026-08-21 |

### Funn 4 er datakvalitet, ikke UX

`4d52114e` fjernet `ByggeplassVelger` fra toppbaren med begrunnelsen «overflødig i ny nav».
UI-et **var** overflødig. Men komponenten bar en sideeffekt (`ByggeplassVelger.tsx:41-45`):
autovalg av første byggeplass når ingen var valgt.

`sjekklister/page.tsx:407` setter `byggeplassId: aktivByggeplass?.id` ved opprettelse. Uten
autovalget er default nå `undefined` — **nye sjekklister opprettes uten byggeplass** med mindre
brukeren aktivt har åpnet trakten.

Dette er Kenneths hypotese (b), bekreftet: kode som så død ut, men var i bruk.

### Funn 6 — en fiks som aldri ble hel

`a859b4f0` rettet `/dashbord/maskin` til å vise FIRMA-kontekst i `KontekstChip.tsx:55-62`.
Samme predikat finnes i to kopier som **ikke** ble rettet: `Toppbar.tsx:49` og
`NavSidebar.tsx:144`. På `/dashbord/maskin` sier chippen FIRMA (amber) mens sidebaren markerer
PROSJEKT-sonen.

## Web mot mobil — motsatt utvikling

Ingen delt kode. Mobilens velger (`ByggeplassChip.tsx` + `ByggeplassVelgerModal`) har en rent
**additiv** historikk: F2 delt chip → F3 GPS auto-set → F6 favoritt-byggeplasser → tri-tilstand
→ «Ingen byggeplass».

**Mobil har i dag alt web mistet, pluss mer.** Favoritter med sortering favoritt → GPS-forslag →
resten, søk, «Ingen»-valg, GPS-forslag.

🔴 **Og mobil filtrerer faktisk lista.** `app/sjekkliste/index.tsx:64-67` sender `byggeplassId`
til `sjekkliste.hentForProsjekt`. **Web sender det aldri** (`sjekklister/page.tsx:298`), selv om
serveren støtter det (`sjekkliste.ts:133,150`). Filteret ble fjernet i `efdbccc3` (2026-04-06)
og erstattet av en kolonnefilter i tabellen.

**Konsekvens for Kenneths spørsmål om å sortere sjekklister på byggeplass:** sortering løser
ikke problemet. Web filtrerer ikke på byggeplass i det hele tatt — på mobil er byttet 2 trykk
med reell effekt, på web finnes handlingen ikke.

## Klikktelling

| | Før (`4d52114e^`) | Nå |
|---|---|---|
| Kort liste (≤6 byggeplasser) | 2 | 2 |
| Lang liste (>6) | 2 (favoritter øverst) | **3 + tasting** (autofokus borte) |
| Bytte prosjekt **og** byggeplass | 4 | **5** (popover lukkes mellom nivåene) |

Det tyngste er ikke tallet: **klikkmålet mistet navnet sitt.** Før sto «Bygg B12 ▾» som egen
knapp i baren. Nå er byggeplassen ren tekst (`KontekstChip.tsx:414-416`) og knappen heter
«PROSJEKT».

## De to mistenkte — begge frikjent

**`8bc313c7`** (−102/+12) er ren flytting. De fire primitivene ble løftet til
`kontekst-chip/trakt-primitiver.tsx` og importeres tilbake. Linje-for-linje sammenlignet: alt
dekket, og `TraktRad` ble bedre (fikk `undertekst` + `min-h-11` for 44px trykkflate).

**`34563da6`** — «PROVISORISK fjernet» gjaldt en **markør-kommentar**, ikke funksjonalitet.
Eneste tap er en overflødig border-variabel.

## Hvorfor det føles som mystikk

Kontrollmekanismen sviktet i samme runde som tapet skjedde:

- `redesign-paritetssjekkliste.md:399` sto med ✅ og «scope/favoritter/søk bevart» — med
  `sist_verifisert_mot_kode: 2026-07-21`, altså **dagen før** `ad7cadc1`.
- `k3-verifiseringslogg.md:17-18` førte «Autovalg byggeplass — fungerer» og «Alle/Mine —
  fungerer» under ✅ Bestod. Begge motsagt av koden.
- `p1-nivasignal-ordre.md:87` sier en PROVISORISK-markør står i koden. Den ble fjernet i
  `34563da6`.
- `ProsjektVelger.tsx:14` og `FirmaVelger.tsx:17` sier «Gjenbrukes av KontekstChip». Den
  importerer dem ikke lenger.

**Der biter hypotese (a) — ikke som årsak til reverseringer, men som årsak til at tapene ikke
ble oppdaget.** En agent som leser dokumentasjonen får bekreftet at alt er på plass.

## Samme klasse — fire funn på én dag (2026-08-21)

Regresjonsjakten var det første. Tre til dukket opp samme dag, alle med samme signatur:
**noe forsvinner uten feilmelding, uten spor i git, og dokumentasjonen sier at alt er i
orden.**

| # | Funn | Hvorfor det var usynlig |
|---|---|---|
| 1 | Denne rapporten — sju tap i `ad7cadc1` | Ny komponent inventarierte aldri den gamle |
| 2 | Falske ✅ i paritetssjekkliste + k3-logg | Kontrollen ble ikke re-verifisert ved berøring |
| 3 | `useFavoritter` mount-race | Toggle før load-effekten nullet hele lista — stille |
| 4 | [Deploy sendte gammel kode](deploy-detaljer.md) | `deploy-test.sh` leste fra et tre som lå bak; Docker cachet «riktig» |

**Ingen av dem var mystiske.** Alle fire hadde en målbar årsak, og i tre av fire fantes det
allerede en mekanisme som *skulle* fanget det — den var bare ikke anvendt konsekvent:
paritetssjekklista fantes, `deploy-prod.sh` hadde ajour-vakten, og Caveat A om Chrome sto
skrevet.

**Fellesnevneren er ikke slurv, men asymmetri:** en regel innført ett sted og glemt det
andre. `ruteErFirmaKontekst` i tre kopier med én rettet er samme form.

## Lærdom — inn i arbeidsmåten

**Når en komponent skrives om fremfor å gjenbrukes, skal ordren inventariere hva den gamle
kunne.** Vedtak som lister ønsket funksjonalitet fanger ikke tap; bare en før-liste gjør det.

**Sideeffekter i UI-komponenter dør stille.** `ByggeplassVelger` bar autovalget. Fjernes et
UI-element som «overflødig», må effektene det utløste kartlegges — ikke bare det synlige.

**En paritetssjekkliste som ikke re-verifiseres ved berøring er verre enn ingen.** Den ga falsk
trygghet i en måned.

## Åpne saker som følger

1. **Autovalg byggeplass** — gjenopprett, eller vedta bevisst at nye dokumenter kan mangle
   byggeplass. Datakvalitet.
2. **Web filtrerer ikke sjekklister på byggeplass** — vedtatt fjernet 2026-04-06, men mobil
   gjør det motsatte. Paritetssak.
3. **Favoritter** — gjenopprett i trakten, eller vedta at «Sist brukt» erstatter dem.
4. **Autofokus i søkefeltet** — falt bort uten vedtak.
5. **Funn 6** — `ruteErFirmaKontekst` i tre kopier, én rettet.
