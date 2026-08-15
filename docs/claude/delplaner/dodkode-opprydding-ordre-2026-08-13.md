# ORDRE: Opprydding av død kode — dokumentflyt-domenet (P1)


> ✅ **UTFØRT 2026-08-14** — `chore/dodkode-dokumentflyt`, merget develop. `verifiserFlytRolle` + `byggFaggruppeFilter` slettet (0 kallsteder, søkerom oppgitt), `dokumentflyt.md:29` rettet. Tre kaskade-døde symboler BLE STÅENDE og rapportert: `hentFlytRettighetOverrides` (live admin-UI), `erTillattForRolle`, `hentRolleFiltrertHandlinger` — krever egen beslutning om flyt-rettigheter-admin skal rives.

Dato: 2026-08-13 · Fra: fabel · Til: kode-Opus (via Kenneth) · Egen branch fra develop, ren opprydding — INGEN funksjonelle endringer i samme leveranse.

## Hvorfor nå
Død kode fra før posisjonsmodellen (prod 2026-08-03) har to ganger på én dag fått lesere (Opus og fabel) til å konkludere feil om hva som bærer modellen. Kostnaden er ikke diskplass — det er feilslutninger hos neste leser.

## Skal slettes (verifisert null kallsteder 2026-08-13 — utfører MÅLER PÅ NYTT før sletting, jf. redundans-prinsippet)
1. `verifiserFlytRolle` — erstattet i fase 3.4, aldri slettet.
2. `byggFaggruppeFilter` — samme.

**Krav til negativ-påstand:** oppgi kandidatmengden — søk i HELE repoet (api, web, mobil, shared, tester, seeds/migreringer), ikke ett grep i to filer. Rapporter søkerom + treff i leveransen.

## Skal rettes (dok som motsier kode/vedtak)
3. `docs/claude/dokumentflyt.md:29` — «trenger ikke navn, ettersom faggruppenavnet er selve boksen» strider mot Kenneth-vedtak 2026-07-31 (flytmodell-veileder § 2.6: frie boksnavn, posisjonsnummer + hvem + ansvarsmerke; posisjon er rutingsbærende). Rett avsnittet til vedtatt modell og merk hva som er bygget vs. vedtatt-ubygget.

## Sweep (samme leveranse, begrenset til dokumentflyt-domenet)
4. Søk etter flere erstattede-men-ikke-slettede symboler fra før fase 3.4 (rollenavn-basert ruting/autorisasjon). For hver kandidat: oppgi kallsteder-søkerom; null treff → slett; treff → IKKE rør, list i rapporten.
5. `ansvarsmerke`-kolonnen SKAL BLI STÅENDE (vedtatt, ubygget — ikke død, men ufødt). Ikke slett.

## Definition of Done
- Build grønn + eksisterende tester grønne, ingen atferdsendring.
- Leveranserapport: slettet-liste med søkerom per symbol, rettet dok-diff, kandidater som ble stående.
- Regel føres i repo-docs (cowork plasserer): **en erstattet funksjon slettes i samme fase som erstatningen merges** — ellers arver neste leser feilslutningen.
