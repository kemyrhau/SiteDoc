# Bevis-løype-veiledning (fabel, 2026-07-29 — cowork legger i docs/claude/ og relayer til utfør-Opus)

> Testsystemet finnes, men øktene kjenner det ikke. Dette er standardvalget for «hvordan skaffer jeg skjermbilde-bevis fra en worktree». Velg ETTER hva beviset skal demonstrere — ikke etter hva som er lettest.

## Steg 0 — alltid (én gang per worktree)
1. Kopiér dev-env inn i worktreet: `apps/api/.env` + `apps/web/.env.local` fra hovedtreet (gitignorert, aldri commit). Finnes `scripts/worktree-bootstrap.sh`, bruk den.
2. Aldri be Kenneth logge inn manuelt — det finnes agent-veier for alt under.

## Løype 1 — Dev-harness (KOMPONENT-bevis: tilstander/varianter av én komponent)
Bruk når beviset er «komponent X ser slik ut i tilstand Y» (f.eks. P3s 4 matrise-rader).
- Midlertidig dev-rute (f.eks. `app/dev/harness/page.tsx`) som rendrer den EKTE komponenten med eksplisitte props per tilstand — aldri en kopi av komponenten.
- `next dev` fra worktreet + headless skjermbilde per tilstand.
- Deterministisk, ingen DB/innlogging. **Ruten slettes før commit** (sjekk `git status` — harness-filer skal aldri inn i PR).
- Begrensning: beviser ikke data-wiring/serversamspill — bruk løype 2 når DET er poenget.

## Løype 2 — Full app + dev-login + seed (FLYT-bevis: ende-til-ende gjennom ekte sider)
Bruk når beviset er «flyten virker» (opprett-veier, statusendringer, gate-bevis på hele skjermer).
- Start api+web fra worktreet mot lokal DB.
- Innlogging: `docs/claude/dev-login-agent.md` — mint session-token per testbruker (`POST /dev-login`, `DEV_LOGIN_SECRET` i lokal api-env). Én bruker per rolle, ikke multi-login i samme session.
- Tilstand: seed, ikke klikk — `packages/db/scripts/seed-e2e-flyt.ts` (utvid seeden hvis tilstanden mangler; det er gjenbrukbart, klikke-oppsett er det ikke).
- Rydd testdata etterpå (in-app eller seed-reset) — ikke etterlat BEF2-aktige rester.

## Løype 3 — Chrome-attach mot Kenneths instans (SISTE utvei)
Kun når noe ikke KAN repoduseres lokalt (OAuth-låst tredjepart, prod-data-avhengig). Koster Kenneths tid — begrunn i relé-meldingen hvorfor 1/2 ikke holder.

## Regel
Komponent-tilstander → 1. Flyt/gate-bevis → 2. Aldri 3 uten begrunnelse. Bevisets filnavn sier løype: `p3-harness-01-...png` / `p3-e2e-01-...png`.
