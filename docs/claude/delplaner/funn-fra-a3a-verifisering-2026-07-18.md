---
name: funn-fra-a3a-verifisering-2026-07-18
status: 🟢 FUNN — mater neste plan (fabel folder inn i A-3b / spor C)
sist_verifisert_mot_kode: 2026-07-18
kilde: Kenneths skjermbilde-verifisering av A-3a på test
---

# Funn fra A-3a-verifisering (Kenneth, test, 2026-07-18)

> A-3a verifisert grønn på test: primærhandling som knapp, ADMIN-seksjon kilde-drevet, «Avvis» korrekt plassert som eierløs handling. Disse tre funnene kom ut av testingen — de er **input til neste plan**, ikke A-3a-restanse. Planen utvikler seg; A-3a er nådd, dette er neste mål.

## 1. Tooltip-forklaring på felttyper (→ spor C, MalBygger-UX)

**Kenneths funn:** «overskrift» bærer en usynlig egenskap — den starter en kollaps-seksjon. Kenneth visste det ikke selv før han så det på test. Ønske: hover-forklaring (etter ~1 s) på hver felttype i paletten.

**Målt — kollaps-oppførselen er korrekt og forklarbar:** `seksjoner.ts` `grupperMedOverskrift` — en **rot-overskrift** (`type === "heading" && !parentId`) starter en seksjon som løper **til neste rot-overskrift**. Nestet overskrift (i repeater) bryter ikke. Så egenskapen er «overskrift = kollaps-grense til neste overskrift».

Hører i **spor C** ved siden av betingelse-flyt og kontrast. Ren visning/interaksjon, ingen datamodell-endring.

## 2. «Venter på: X» oppdateres ikke etter videresend (→ A-3b)

**Kenneths funn:** han sendte A.Markussen → Byggherre → A.Markussen om hverandre. Loggen viste alle stegene, men statusbadgen og «Venter på: X» rørte seg ikke. Som admin kunne han sende flere ganger uten å bli varslet om dokumentets faktiske tilstand.

**Målt — delvis by-design:** `forwarded` er **ikke en status** (står ikke i `isValidStatusTransition`). Server-grenen (`sjekkliste.ts:781`) bytter **flyt/faggruppe/mottaker** — ikke status. Så dokumentet blir stående på samme status; kun *mottakeren* endres. Det er derfor statusbadgen ikke rørte seg.

**Men mottaker-visningen SKAL da oppdateres**, og gjør det ikke: «Venter på: X» viste fast verdi mens mottaker faktisk endret seg (loggen beviste det). **Ikke en A-3a-regresjon** — A-3a gjorde bare videresending lettere å nå (1 klikk), så den avdekket at mottaker-badgen ikke refreshes etter `forwarded`.

**Liten fiks:** invalidér spørringen etter videresend så «Venter på»/mottaker-badgen oppdateres. A-3b (mottaker-visning).

## 3. Person-videresending — kollaps per faggruppe (→ A-3b, Kenneths idé)

**Kenneths ønske:** videresende til en **person i en faggruppe**, ikke bare faggruppen som helhet. Foreslått form: kollapset meny per faggruppe som ekspanderer til personene.

**Målt — datamodellen bærer det allerede, ingen schema-endring:**
- `recipientUserId` finnes i schema ved siden av `recipientGroupId` — mottaker *kan* være en person i dag.
- `VideresendValg.mottaker` har `userId` — API-veien er åpen.
- `DokumentflytMedlem` kjenner personene per steg: `projectMemberId`, `faggruppeId`, `steg`, `hovedansvarligPersonId`. Menyen har allerede `flytMedlemmer` som prop → personene er tilgjengelige klient-side.

**Form (Kenneths):**
```
Send ▾
  ▸ A.Markussen AS          ← klikk = hele faggruppen (dagens oppførsel, uendret)
     └ Kenneth Myrhaug       ← ekspander = velg person
  ▸ Byggherre Boligfelt B12
  ADMIN → Avvis
```
Bevarer det som virker (klikk på gruppe = send til gruppe), legger person-nivå oppå.

**Selve den visuelle løsningen er fabels** (mockup → Kenneth-gate, som georef). Cowork bekrefter kun at fundamentet er der.

**Henger sammen med funn 2:** bygger vi person-nivå uten mottaker-refresh, blir det verre — da sender du til en person og ser fortsatt ikke hvem som har ballen. **Ta funn 2 + 3 i samme sak.**
