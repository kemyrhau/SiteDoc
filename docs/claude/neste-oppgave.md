# OrganizationMember-refaktoren er komplett

Dato: 2026-05-13
Status: Fullført

O-1 → O-5c deployet til prod. User.organizationId fjernet.
OrganizationMember er eneste sannhetskilde for firma-tilhørighet.

## Neste arbeidsoppgaver (ikke planlagt)
- OrganizationMemberPermission (modul-tilgang per ansatt) — låst i fase-0-beslutninger.md
- Ansattrolle-UI (vis/rediger ansattRolle og firmaRoller i firma/ansatte)
- T7-2b (per-rad-attestering + tillattRedigerVedAttestering)
- T7-3 (mobil timer-redesign)
- Nye integrasjonstester for tilgangskontroll.ts
