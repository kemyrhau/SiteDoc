---
status: 🟡 FORSLAG — til cowork. Merge-mekanikk er coworks domene, ikke designs
opprettet: 2026-09-24
forfatter: design
utløst_av: Kenneth 2026-09-24 — «ja, foreslå teknisk sperre i merge-agenten»
bakgrunn: `0ab36a84` (runde E merget ugatet) og `a7e9b63e` (uploads-signaturgate merget ugatet)
---

# Forslag: teknisk sperre mot ugatet merge

## § 1 Problemet, og hvorfor en instruks ikke løser det

**To hendelser, samme feilklasse:**

| Hash | Hva |
|---|---|
| `0ab36a84` | Runde E merget fordi branchen fantes. La feil ordlyd i develop. Ingen skade — **flaks, ikke system** |
| `a7e9b63e` | Uploads-signaturgaten merget uten designgate. Fanget etterpå av cowork |

**Regelen finnes og er tydelig** (SAMARBEIDSREGLER § MALØYPE pkt 3):

> «En pushet branch er IKKE et klarsignal — gate-MELDINGEN utløser merge.»

🔴 **Den har nå sviktet to ganger, og begge ganger ble det fanget i ettertid av et menneske som leste en
innboks.**

### 🔴 Coworks rotårsak er skarpere enn «regelen ble glemt» — og den endrer designet

> **Cowork 2026-09-24:** *«cowork ba merge verifisere en betingelse han ikke kan måle — han leser ikke
> `inbox-cowork.md`.»*

🔴 **Det var ikke en hukommelsessvikt. Sjekken var tildelt en agent som ikke kan OBSERVERE betingelsen.**

**Målt belegg:** SAMARBEIDSREGLER sier «`relay/` finnes kun i hovedtreet», og merge-agenten jobber fra
`SiteDoc-merge`. **Gate-meldingen lå i en fil som ikke fantes i agentens arbeidstre.** Instruksen var
strukturelt uoppfyllbar — den kunne bare etterleves ved å gjette.

⚠️ **Det er en viktigere lærdom enn den jeg først skrev, og den generaliserer:** *en betingelse skal
verifiseres av den som kan måle den.* **Hver gang vi ber en agent bekrefte noe utenfor dens rekkevidde, har vi
bygget et hull som ser ut som en regel.**

🟢 **Konsekvens for § 5: scriptet må lese innboksen via ABSOLUTT sti til hovedtreet, ikke en relativ sti.**
Fra et worktree finnes `relay/` ikke. **Det er nettopp det som gikk galt, og skissen under gjør det
eksplisitt.**

*(Beslektet, men ikke det samme: opt-in-signeringen som sviktet på tre dager — Fase 1b 12.08, hull funnet
15.08. Den var en huskeregel. Denne var en umulig instruks. **Begge løses av å flytte håndhevelsen til et
sted som kan måle.**)*

## § 2 Formen: ikke en sjekk som kjøres, men den eneste veien inn

🔴 **En sperre som er «kjør dette scriptet før merge» er en ny instruks — samme svakhet som den gamle.**

**Forslag: merge-agenten merger KUN via ett script**, og sperren ligger inne i det.

```
scripts/merge-til-develop.sh <branch>
```

**Da er det ikke noe å huske. Det er én kommando, og den nekter selv.**

## § 3 Det maskinlesbare gate-ordet

🔴 **Sperren skal ikke tolke prosa.** Innboksen er en 2800-linjers logg der hasher, gate-ord og «DØDE hasher»
ligger om hverandre. **Et grep på «klar for merge» + hash ville gitt falske treff, og en sperre med falske
treff er verre enn ingen.**

**Design skriver i stedet én kanonisk linje, i tillegg til prosaen:**

```
GATE-OK <branch> <full 40-tegns hash>
```

**Prosaen er fortsatt for mennesker. Linja er for maskinen.** ⚠️ **Å parse prosa er presis feilklassen som ga
oss `dwgread` og «7 rutefiler» — begge var rimelige lesninger av tekst som ikke var ment som data.**

## § 4 🟢 Og samme mekanisme håndhever en REGEL TIL, gratis

**Scriptet slår opp branchens tipp på origin FØRST, og krever `GATE-OK` for NØYAKTIG den hashen.**

🟢 **Da håndheves også frysregelen** (CLAUDE.md § Commit + push):

> «Etter at «klar for merge» er gitt, er branchen FROSSET: ingen ny push uten å melde ny hash først.»

**Gatet design `X`, og noen pusher `Y` etterpå, finnes ingen `GATE-OK … Y`. Mergen nektes.** ⚠️ **I dag er
frysregelen ren tillit. Med dette er den håndhevet — uten at noen skrev en regel til.**

## § 5 Skisse

```sh
#!/usr/bin/env bash
set -euo pipefail
BRANCH="$1"
# ABSOLUTT sti — `relay/` finnes IKKE i et worktree. Rotårsaken i § 1.
INBOX="$HOME/Documents/Programmering/SiteDoc/relay/inbox-cowork.md"

# 1. FAIL CLOSED: ingen innboks = ingen merge
[ -r "$INBOX" ] || { echo "🔴 Finner ikke $INBOX — merge nektet."; exit 1; }

# 2. Hashen hentes fra ORIGIN, ikke fra lokalt tre
git fetch -q origin "$BRANCH"
HASH=$(git rev-parse "origin/$BRANCH")

# 3. Eksakt linje, ikke prosa
if ! grep -qxF "GATE-OK $BRANCH $HASH" "$INBOX"; then
  echo "🔴 Ingen GATE-OK for $BRANCH @ $HASH."
  echo "   Enten er den ikke gatet, eller så er den pushet på nytt etter gaten."
  exit 1
fi

# 4. Herfra: coworks eksisterende merge-koreografi
```

**Fire egenskaper som er bevisste:**

| # | Egenskap | Hvorfor |
|---|---|---|
| 1 | **Fail closed** | Manglende/uleselig innboks nekter merge. Samme retning som `signerHvisPrivat`: feiler den, blir fila utilgjengelig — ikke lekket |
| 2 | **Hash fra `origin`** | Håndhever frysregelen (§ 4) |
| 3 | **`grep -qxF`** | Eksakt hel linje, fast streng. Ingen regex, ingen delvise treff |
| 4 | **Scriptet ligger i repoet** | Versjonert og gjennomgåbart. Sperren er selv under gate |
| 5 | **Absolutt sti til innboksen** | 🔴 **Rotårsaken.** Fra et worktree finnes `relay/` ikke — agenten kunne ikke måle det den ble bedt om |

## § 6 🔴 Unntaket skal LOGGES, ikke skjules

**Ikke alt trenger designgate** — coworks egne tekniske merger, hastefikser.

```sh
scripts/merge-til-develop.sh <branch> --ingen-designgate "<begrunnelse>"
```

🔴 **Begrunnelsen skrives til en logg i repoet.** ⚠️ **Et unntak som ikke etterlater spor er en bakdør.** Et
som gjør det, er en beslutning — **og blir unntaket vanlig, ser vi det i loggen framfor å oppdage det ved en
hendelse.**

## § 7 🔴 Sperren må selv bevises — ellers er den en påstand

**Én test som FEILER hvis sperren fjernes:** kall scriptet på en branch uten `GATE-OK` og krev exit ≠ 0.

⚠️ **Uten den er sperren i samme kategori som regelen den erstatter: noe vi tror virker.** **Samme krav som
«default-på bevist» i uploads-ordren.**

## § 8 ⚠️ Ærlighet om hva dette IKKE er

🔴 **Dette er en sterk standardvei, ikke en vegg.** En agent kan fortsatt skrive `git merge` for hånd. **Sperren
virker fordi den er den eneste veien agenten BRUKER — ikke fordi den er umulig å omgå.**

**Den virkelige veggen er GitHub branch protection på `develop` med en påkrevd status-sjekk.** Den kan ikke
omgås lokalt.

| | Denne sperren | Branch protection |
|---|---|---|
| Styrke | Sterk standard | **Vegg** |
| Kostnad | Ett script | CI-oppsett + PR-flyt på alt |
| Bivirkning | Ingen | 🔴 Blokkerer også Kenneths egne pusher |

🟢 **Design anbefaler scriptet nå** — det løser begge hendelsene, koster lite, og bryter ingen arbeidsflyt.
**Branch protection er riktig når prosjektet har eksterne kunder i produksjon, ikke før.**

## § 9 Hva design endrer på sin side

**Design legger til `GATE-OK <branch> <hash>` i hver gate-melding**, ved siden av prosaen og de eksisterende
gate-ordene. **Én linje. Ingen annen endring i designs arbeidsmåte.**

⚠️ **Og linja skal skrives av den samme `ls-remote`-verifiseringen som alt kreves før en hash meldes** — ikke
av hukommelsen. **Ellers har vi flyttet feilen ett hakk.**

---

## § 10 🟢 Forholdet til coworks egen retting

Cowork har alt innført: **«cowork STADFESTER gaten med sitat og linjenummer, eller gir ingen merge-kommando.»**

🟢 **Den er riktig og løser rotårsaken på agent-laget** — verifiseringen flyttes til den som faktisk leser
innboksen. **Den bør stå uansett hva som skjer med dette forslaget.**

**De to er komplementære, ikke overlappende:**

| Lag | Hva det fanger |
|---|---|
| **Coworks regel** | At gaten finnes og sier det den skal — **et menneske/agent som leser og siterer** |
| **Denne sperren** | At hashen er NØYAKTIG den gatede, og at ingen har pushet etterpå — **noe et sitat ikke kan fange** |

⚠️ **Et sitat med linjenummer beviser at en gate fantes da cowork leste. Det beviser ikke at branchen er
uendret siden.** **Frysregelen håndheves kun av § 4.**

---

🔴 **Merge-mekanikk er coworks domene.** Dette er et forslag, ikke en ordre. **Cowork avgjør form og
implementasjon; design forplikter seg til § 9 uansett hvilken form som velges.**
