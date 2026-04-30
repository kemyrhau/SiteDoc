# SmartDok-migrering

Engangs-migrering av A.Markussen fra SmartDok til SiteDoc.

## Oppsett

1. Kopier `.env.example` til `.env.local`:
   ```
   cp scripts/smartdok/.env.example scripts/smartdok/.env.local
   ```
2. Lim inn API-nøkkel og base-URL fra SmartDok i `.env.local`
3. `.env.local` er gitignored — ALDRI commit

## Status

- [ ] Finn API-dokumentasjon (Swagger/OpenAPI)
- [ ] Kartlegg endepunkter og felter
- [ ] Lag mappingdokument SmartDok → SiteDoc
- [ ] Identifiser funksjonsgap
- [ ] Skisser eksportskript (uten å kjøre)
- [ ] Kjør eksport (etter eksplisitt godkjenning)

Se [docs/claude/smartdok-undersokelse.md](../../docs/claude/smartdok-undersokelse.md) for arbeidsdokument.
