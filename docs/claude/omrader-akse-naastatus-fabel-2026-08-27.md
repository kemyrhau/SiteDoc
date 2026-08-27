---
name: omrader-akse-naastatus
description: Fabel kodeverifisert nå-status 2026-08-27 for områder-aksen (svar på omrader-retning-2026-08-26.md). Fakta først — endrer designspørsmålene vesentlig.
status: 🟢 FAKTA — grunnlag for fabel-design
sist_verifisert_mot_kode: 2026-08-27 (fabel, lesetilgang lokal mappe)
---

# Områder-aksen — kodeverifisert nå-status (fabel 2026-08-27)

Svar på `omrader-retning-2026-08-26.md`. Retningsnotatet måler aksen på
`room_property`/`zone_property` i rapportmaler — men aksen finnes allerede i koden
som noe langt større. Tre av fire ledd i Kenneths kjede er bygget.

## Fakta (fabel-verifisert mot kode, fil:linje)

1. **`Omrade` er egen entitet** — `packages/db/prisma/schema.prisma:897`:
   `projectId` · `byggeplassId` (påkrevd) · `tegningId` (nullable) ·
   `type` = sone | rom | etasje · `polygon` (Json, punktliste på tegning) · `farge` ·
   `sortering`. Relasjoner til Project, Byggeplass, Drawing, KontrollplanPunkt.
   CRUD-ruter finnes: `apps/api/src/routes/omrade.ts` (per prosjekt, per byggeplass,
   per tegning; sletting sperres når kontrollplanpunkter er koblet).

2. **Fremdriftsplan-import finnes og er MS Project XML**:
   `apps/web/src/lib/ms-project-parser.ts` (oppgavetre via OutlineLevel, WBS,
   ressurser via Assignments) + `ImportFremdriftsplanDialog.tsx` +
   `RevidereFremdriftsplanDialog.tsx` (revisjons-diff, «del 2») +
   `kontrollplan.ts:370` («Revidert fra fremdriftsplan <filnavn>»).
   Masterplan del 6b fase 3 «MS Project eget spor» er altså delvis innfridd her.

3. **Re-import-identitet finnes — for PUNKTER**: `KontrollplanPunkt.importTaskUid` /
   `importWbs` (schema:2076–2077) med unik nøkkel
   `(kontrollplanId, importTaskUid, sjekklisteMalId)` (schema:2109). Revisjons-diffen
   matcher på denne rad-identiteten. Mønsteret retningsnotatet etterlyser er altså
   allerede etablert i kodebasen — bare ikke for områder.

4. **Manglende ledd: importen arver IKKE områder.** Punkter opprettes med
   `omradeId: null` (`ImportFremdriftsplanDialog.tsx:204`). Områder opprettes manuelt
   og kobles manuelt. `Omrade` har ingen import-avstamningsfelt (søkt hele
   schema.prisma for importTaskUid/importWbs — finnes kun på KontrollplanPunkt).

5. **Område-verktøy finnes i kontrollplan**: skyv frister per område
   (`kontrollplan.ts:829`), kopier punkter mellom områder, f.eks. etasje 3 → 4
   (`kontrollplan.ts:878`), område i markør-tooltip og PDF (`:693`, `:1034`).

6. **`zone_property`/`room_property` er bevisst skjult** i malbygger-paletten:
   `FeltPalett.tsx:37` `SKJULTE_TYPER` — konsistent med målingen (null ekte maler).
   Renderere finnes (`RapportObjektRenderer.tsx:91–92`).

7. **Byggeplass-forholdet er besvart i modellen**: `Omrade.byggeplassId` er påkrevd —
   områder bor UNDER byggeplass-aksen, konkurrerer ikke med den.

Ikke undersøkt (åpent): 3D-kobling til områder (ingen søk gjort i 3D-koden);
mobil-flatens bruk av områder.

## Hva dette gjør med designspørsmålene i retningsnotatet

- **«Egen entitet eller avledet av planen?» — avgjort av virkeligheten**: egen entitet
  finnes med data-relasjoner i prod-skjemaet. Designet handler om å gi den
  import-AVSTAMNING (f.eks. importTaskUid/importWbs på Omrade), ikke velge modell fritt.
- **🔴 Re-import-spørsmålet er halvert**: rad-identitet + revisjons-diff er etablert
  praksis for punkter. Gjenstår: samme mønster på områder, og hva som skjer når en
  arvet plan-rad forsvinner/flyttes mens tegnings-polygon, punkter og ev. 3D-soner
  henger på området. (Punkter→område er allerede SetNull ved sletting.)
- **Én eller flere inndelinger**: i dag flat liste per byggeplass med `type`-felt
  (sone/rom/etasje) — flere parallelle inndelinger (bygg vs. fag) er reelt åpent.
- **`zone_property`/`room_property`**: skjult med vilje; spørsmålet «inngang eller
  erstattes» står, men de er ikke aksen — `Omrade` er.
- **Vise/redigere planen (utsatt)**: to-sannheter-spenningen består, men merk at
  SiteDoc allerede LAGRER avledninger av planen (punkter med TaskUID/WBS) uten å eie
  den — «kun visning»-utgangen har dermed presedens i eksisterende modell.

## Redundans-merknad

Alle fakta over er **enkeltmålt** (fabel med lesetilgang, 2026-08-27). Før design
låses skal cowork/Opus bekrefte nå-bildet — særlig: hvem bygget Omrade + import
(KP-sporet L1/L2?), om det er i prod eller på develop, og 3D-status.

## Neste steg (fabel)

Designnotat skrives PÅ dette faktagrunnlaget, ikke på retningsnotatets
«aksen finnes ikke»-premiss. Ingen hast (ikke pilot-tema).

Relatert: `omrader-retning-2026-08-26.md` · `kontrollplan.md` ·
`byggeplass-strategi.md` · masterplan del 6b fase 3 (MS Project).
