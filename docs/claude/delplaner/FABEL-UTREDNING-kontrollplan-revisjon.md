# Fabel — UTREDNING: kontrollplan-revisjon + dokumentflyt-kobling — 2026-08-11

Grunnlag: Kenneths tre forhold (2026-08-11), retningen i
FABEL-SVAR-veiA-og-kontrollplan + FABEL-TILLEGG-msproject-radidentitet, og
kodemåling gjort nå. Cowork skriver ordre mot denne når ⚖-ene er tatt.

## Målt nå-tilstand (verifisert i kode)

- **Kontrollplan** er per byggeplass (upsert i `kontrollplan.ts:48`), med
  plan-livssyklus utkast→aktiv→godkjent→arkivert (overganger valideres,
  :251) — men overgangene LOGGES ikke (historikk er kun punkt-nivå).
- **Punkt** = sjekklistemal × område × faggruppe × frist(uke/år);
  milepeler grupperer. `KontrollplanHistorikk` per punkt:
  opprettet/startet/utført/godkjent/avvist/endret.
- **MS Project-import** (`ImportFremdriftsplanDialog`, 1144 linjer +
  `ms-project-parser.ts`): XML-format (ikke .mpp), parser UID, WBS, navn,
  start/finish, ressurser, outline-hierarki. Dialogen mapper ressurs→
  faggruppe og oppgave→mal, frist = finish→uke/år.
- 🔴 **Nøkkelfunn:** `importPunkter` bærer `taskUid` helt til lagring —
  og KASTER den der. `kontrollplan_punkter` har ingen UID/WBS-kolonne
  (migrering 20260418120000). Rad-identiteten er derfor billig: kolonnene
  mangler, ikke flyten.
- **Ingen dokumentflyt-kobling** på kontrollplan/punkt/sjekkliste-oppretting
  fra plan (coworks nå-sjekk bekreftet).

## Del 1 — Rad-identitet (fundamentet, bygges først)

Per tillegget, justert mot målt kode:

- `kontrollplan_punkter` får `import_task_uid INT?`, `import_wbs TEXT?`,
  `import_kilde_id FK?` — punktet ER mappingen for rader som ga punkt
  (1 rad → N punkter når samme aktivitet ga flere maler; alle bærer samme
  uid). Ingen egen mappingtabell for disse.
- Ny tabell `KontrollplanImport` (én per importhendelse): fil-navn,
  parsed antall, importert av/når + `hoppetOver Json` — UID-ene som ble
  vist men IKKE valgt, med navn/wbs-snapshot. Dermed er «valgt bort»
  eksplisitt uten å lagre hele filen.
- Import-dialogen skriver alt dette ved `handleOpprett` — én utvidelse av
  eksisterende mutation, ingen ny flyt.

## Del 2 — Revisjon fra oppdatert fremdriftsplan (diff)

Ny «Revider fra fremdriftsplan»-handling på plan med minst én import:

1. Samme parser leser ny fil. Match per UID mot punkter med
   `import_task_uid`; fallback fingerprint WBS+navn («antatt samme» —
   bekreftes, oppgraderes til UID ved bekreftelse).
2. Diff-visning i tre grupper: **frist-endringer** (finish ≠ lagret frist —
   vis gammel→ny per punkt, huk av per rad eller alle), **nye aktiviteter**
   (ikke i mapping og ikke i hoppetOver → samme mal/faggruppe-tilordning
   som import-dialogen; hoppetOver-rader vises kollapset «tidligere valgt
   bort»), **forsvunne** (punkt med uid uten motpart → varsel-liste, aldri
   auto-slett; bruker kan manuelt arkivere punkt uten utført arbeid).
3. Anvendt revisjon skriver: frist-oppdateringer med punkt-historikk
   `endret` (kommentar «revidert fra fremdriftsplan {fil}»), ny
   `KontrollplanImport`-rad (type revisjon), og **plan-nivå-hendelse**
   (del 3). Sjekklister med utført arbeid røres aldri av frist-endring —
   kun punktets frist endres.

## Del 3 — Plan-nivå-historikk

Ny `KontrollplanHendelse` (plan-FK): statusoverganger (fanges i
`oppdaterStatus`), import, revisjon (med fil-navn og rad-antall),
punkt-tillegg i bulk. Dette er laget arkiv-PDF-ens kontrollplan-variant
mangler i dag — «Punkt-historikk»-seksjonen suppleres med plan-hendelser
uten malendring (allerede forberedt i fase 3-designet).

## Del 4 — Dokumentflyt-kobling per sjekkliste

Per hovedretningen: kobling settes ved sjekkliste-oppretting fra punkt når
flyt finnes for faggruppe/dokumenttype; ellers eksplisitt tilstand
`venter_paa_flyt` (egen kolonne/enum, indeksert — aldri NULL-som-ukjent).
Ettersleps-kobling: ved flyt-oppretting i oppsettet vises ventende
sjekklister for faggruppen med bulk-kobling; kontrollplan-flaten viser
teller «N uten dokumentflyt». NB: krever at Spor 1-modellen (flyt per
faggruppe/dokumenttype) er landet — del 4 sekvenseres etter Spor 1 v2.2.

## Rekkefølge

Del 1 → 2 → 3 kan gå som én ordre (samme flate, samme migrering).
Del 4 egen ordre etter Spor 1 v2.2. Mockup: jeg tegner diff-visningen
(del 2) før ordren kodes — det er der brukervalgene bor.

## ⚖ Kenneth

1. Forsvunne aktiviteter: holder «varsle + manuell arkivering» — eller vil
   du kunne slette punkter uten utført arbeid direkte fra diffen? (Anbefalt:
   manuelt, i første versjon.)
2. Revisjon av frister på punkter der sjekklisten alt er UTFØRT: vis dem i
   diffen som låst («utført — frist ikke endret»)? (Anbefalt: ja, låst.)
3. Vil du se diff-mockupen før ordren går, eller holder utredningen?

— fabel (relayet av Kenneth)
