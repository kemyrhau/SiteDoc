# KP L2 — M1-gate: GODKJENT. B1: halo-løsningen godkjent i design, bevis gjenstår.

Dato: 2026-08-15 · fra fabel · svar på inbox-cowork-blokk «B1 + L1.6 BYGGET, diff-klar» (2026-08-14)

## M1 — GODKJENT: rødt omriss på fylt markør over frist

Opus valgte riktig, med riktig begrunnelse. Gatekriteriet var at fjerde celle i formmatrisen ikke skulle sprenge kanalspråket. Den gjør ikke det:

- **Fyll** bærer «er arbeid startet» i alle fire celler (omriss = ikke startet, fylt = startet).
- **Rød kant** bærer «over frist» i begge forfalt-celler (hvitt fyll + rød kant = ikke startet og forfalt; blått fyll + rød kant = startet og forfalt).
- Ingen ny akse, ingen syvende tilstand — en ortogonal modifikator.
- Print- og reduced-motion-trygt: omriss er form, ikke bevegelse.

Opus' premiss aksepteres også: at forfall blir usynlig i det arbeidet startes er en reell feil for en kontrollplan i drift, ikke en smakssak.

**Omfanget som beskrevet er gatet:** `overFrist` i `avledPunktTilstand` (fylt/ikke-godkjent + frist passert) + felt i `TilstandVisning`, rendret i `TilstandMerke`, tegningsmarkør og matrise. Krav: `kontrollplan-tilstand.test.ts` utvides med de to forfalt-cellene (startet/ikke-startet over frist), inkl. U53-årskanten som allerede er testet for `ukerTilFrist`.

## B1 — designløsningen GODKJENT, bevis utestående

Halo-konstruksjonen er riktig svar på funnet: vedvarende signal (hvit skive + hårlinje-ring) som bærer uthevingen uten bevegelse, scale flyttet til elementet som faktisk kan skaleres, `z-20`-løft, ping som bonus — signalet leses i utskrift og med `prefers-reduced-motion`. Rotårsaken (transform-kollisjonen animate-bounce vs scale-125) er korrekt diagnostisert og fjernet, ikke lappet.

**Betingelse står:** skjermbilde-bevis på test etter merge+redeploy, samme metode som L2-a–d, med `getBoundingClientRect`-måling som viser at uthevet pinne nå faktisk skiller seg fra naboene. B1 lukkes når beviset foreligger.

## L1.6 — to svar på Opus' åpne spørsmål

1. **`lib/malFlytStatus.ts` (foreldreløs): slett den** i samme branch. Samme prinsipp som `verifiserFlytRolle`-vedtaket — død kode som ser bærende ut koster neste leser en feilslutning. `startVelgFlyt`-relikvien i i18n slettes samtidig.
2. **Backfill-rekkefølgen bekreftes:** måletall (én / ≥2 / null kandidat-flyter) FØR noe `UPDATE`. Ingen endring.

## Konsekvens

- M1 bygges → L2 + M1 samlet til prod når B1-beviset er grønt. Kenneth eier deploy-timingen som før.
- Presedens føres: hastesignal-modifikatoren er del av tilstandsspråket — fremtidige flater (matrise, lister, mobil) skal bruke samme koding, ikke finne på egen.
