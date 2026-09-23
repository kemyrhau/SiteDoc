# Ordre: sperrede knapper skal si hva som mangler — web og mobil

**Til:** agent cowork velger (kontrollplan eller redesign er ledige) · **Fra:** design · **Dato:** 2026-09-19
**Spor:** cowork avgjør. **Worktree/branch:** cowork klargjør. Forslag: `fix/forklar-sperrede-knapper` fra `origin/develop`.
**Grunnlag:** `docs/claude/retningslinjer/ui-standarder.md` § «Deaktivert knapp skal si hva som mangler» (2026-09-01) ·
mikrotekst-standarden (`tooltip-hjelpetekst-veileder.md` § 3) · `STATUS-AKTUELT` 2026-09-17: «20+ andre
disabled-knapper mangler forklaring».

---

## Bakgrunn

En grå knapp uten begrunnelse leses som en feil, ikke som en betingelse. Kenneth trodde en funksjon var ødelagt
01.09 av nettopp denne grunnen. Standarden sier: en sperret knapp skal si **hva som mangler** — i knappen, rett under
den, eller som hjelpetekst — på web og mobil. `KnappMedForklaring.tsx` (web) ble bygget 17.09 og løser det for én
knapp. Resten er ikke tatt.

**Denne runden forklarer knappene. Den endrer ikke når de er sperret.** Betingelsene røres ikke.

## Arbeidet går i to steg — steg 2 starter først når design har godkjent teksten

### Steg 1 — kartlegging (ingen kode)

Finn **alle** knapper i web og mobil som kan være sperret uten å si hvorfor. Søk minst etter `disabled=` på `Button`,
`<button`, `Pressable`, `TouchableOpacity` og tilsvarende. **Ta ikke med:**
- knapper som bare er sperret mens en mutasjon kjører (spinner/`loading` er signalet)
- knapper der betingelsen er åpenbar av sammenhengen («Neste» på siste steg)
- knapper som allerede forklarer seg

Lever **én tabell**, rangert (se under):

| # | Flate | Fil:linje | Knapp (tekst) | Sperret når (kodeuttrykk) | Hvem ser den | Forslag til forklaring |
|---|---|---|---|---|---|---|

**Rangering:**
1. Flytene piloten bruker på **mobil**: timer/dagsseddel, utfylling av sjekkliste og oppgave, HMS.
2. De samme flytene på **web**.
3. Oppsett, innstillinger og admin.

**Tekstregler for forslagene** (design godkjenner dem):
- Si **hva som mangler**, ikke hva knappen gjør. ✅ «Skriv inn et navn først» · ❌ «Oppretter dokumentflyten».
- Kort: helst under 60 tegn.
- Relasjonelle ord, aldri faste rollenavn som kan mangle i en flyt («den som sendte det», ikke «byggherren»).
- Mangler flere ting, si det viktigste først, eller list dem kort.
- Samme betingelse på flere knapper → samme tekst og samme i18n-nøkkel.

**Lever tabellen** nederst i `/Users/kennethmyrhaug/Documents/Programmering/SiteDoc/relay/inbox-design.md` som
`## [ÅÅÅÅ-MM-DD tt:mm] fra <agent> → kartlegging sperrede knapper`, og si «design har post» til Kenneth. **Vent** på
design sitt svar: godkjent tabell, eventuelt med rettede tekster. Design svarer i din innboks.

### Steg 2 — bygging (etter designs godkjenning)

**Web:** pakk hver godkjent knapp i den eksisterende `KnappMedForklaring`
(`apps/web/src/components/KnappMedForklaring.tsx`). Følg kontrakten i komponentens kommentar: `sperret` er sann bare
når input mangler — **ikke** når mutasjonen kjører. Aldri `title=`.

**Mobil — nytt, lite mønster** (designvalg): en telefon har ingen hover, så en tooltip virker ikke. Forklaringen står
som **en kort tekstlinje rett under knappen**, bare mens knappen er sperret, og forsvinner når den blir aktiv.
- Lag `apps/mobile/src/components/KnappMedForklaring.tsx` med **samme API som web** (`sperret`, `forklaring`,
  `children`), så ordrene kan si det samme på begge flater.
- Utseende: liten, grå tekst (samme størrelse og farge som andre hjelpetekster på skjermen), rett under knappen, ikke
  i en boks, ingen ikon, ingen farge. Ikke amber — amber betyr «noen må ta stilling» (`ui-standarder § Feltstatus`).
- Tekstlinjen skal ikke flytte knappen. Står flere sperrede knapper på rad, én linje under raden.

**i18n:** hver tekst får en nøkkel i `nb.json` og `en.json`, deretter
`pnpm dlx tsx src/i18n/generate.ts --only <nøklene>` fra `packages/shared`. Ingen hardkodet norsk.

## Paritetsmatrise

| | Web | Mobil-app | Arkiv-PDF |
|---|---|---|---|
| Sperrede knapper | ✅ `KnappMedForklaring` (tooltip) | ✅ ny `KnappMedForklaring` (tekst under) | ❌ gjelder ikke — PDF har ingen knapper |

## Funksjonsinventar

Betingelsen for hver knapp er **BEVART uendret**. Ser du at en betingelse er feil (knappen burde vært aktiv), er
det et **funn**: meld det i kartleggingen, rett det ikke.

## Tester

- Web: følg mønsteret i `apps/web/src/components/__tests__/knapp-med-forklaring.test.tsx` — ingen ny test per knapp.
- Mobil: én test for den nye komponenten: teksten vises når `sperret` er sann, og ikke når den er usann. Rød først.
- Gate-tall i formatet `unit-mock · unit-ren · integrasjon · e2e`. Web build + mobil typecheck + `pnpm test` fra rot.

## DoD

1. Kartleggingen levert og godkjent av design (steg 1).
2. Alle godkjente knapper forklart på sin flate (steg 2). Rekkefølgen følger rangeringen — blir runden avbrutt, er
   pilotflytene ferdige.
3. **Tekstbevis til designgaten:** tabellen oppdatert med endelig i18n-nøkkel og norsk tekst per knapp, og fil:linje
   der den er brukt. Ingen skjermbilder.
4. Design svarer «Designgatet – klar for merge» eller «Avvik: …». Cowork merger.

## Utenfor

Endre når en knapp er sperret · redesign av knapper · toasts eller bannere · feltstatus-markører (egen standard) ·
knapper i PDF.
