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

---

## Kenneth-beslutninger 2026-07-18 (etter strukturell test)

| Funn | Vedtak |
|---|---|
| **1** «Venter på»/badge etter videresend | Statusbadgen endrer seg ikke (korrekt — `forwarded` er ikke status). **Gi feedback:** endre badge-utseende (farget → ufarget) som signal, og **vis hvem som fikk ballen** prominent. Best: hvem har ballen, ikke bare «Venter på»-tekst |
| **2** «Send tilbake» → «Avvist» | **Badge «Til revisjon»** for denne bruken (godkjenner sender tilbake). For utfører som mottar: **«Under arbeid»/pågående** |
| B1 admin sender gjentatte uten feedback | Løses av funn 1-fiksen |
| B2 Send-nedtrekk blander videresend-mål + admin | **Enig — tydeligere skille** (f.eks. «Send videre til:» over faggruppene, «ADMIN» for overstyring) |
| B3 overskrift = usynlig kollaps-egenskap | **Enig** — tooltip på felttyper (spor C) |
| **3/C1** person-videresending | **Bekreftet form:** faggruppe vist kollapset → åpner viser medlemmer. Enig |
| C2 kommentar-nudge kun ved Send tilbake/Avvis | **Enig** |

## To NYE funn fra strukturell test (web-Opus, cowork-målt) — trenger Kenneth-beslutning

### N1 — `sent` er en fantom-status (ubetinget auto-mottak)

**Målt:** `sjekkliste.ts:923` — `const effektivStatus = input.nyStatus === "sent" ? "received" : input.nyStatus`. **Ubetinget.** Når *hvem som helst* sender, blir dokumentet `received` umiddelbart. Tidslinjen skriver «Sendt → Mottatt» som to rader, men dokumentets faktiske status hviler aldri på `sent`. Samme i `oppgave.ts:1107`.

**Konsekvens — treffer Kenneths opprinnelige A-3a-funn:** «Trekk tilbake» ligger i matrisen på `sent` (`bestiller.sent = [cancelled]`). Men siden `sent` er uoppnåelig, er **«Trekk tilbake» aldri synlig** — og A-3as primærknapp-forbedring for `sent` vises aldri. Verre: i `received` har **avsender (bestiller) ingen handlinger** (received tilhører utforer). Så **avsender kan ikke trekke tilbake et sendt dokument** — det er `received` og eid av mottaker i samme øyeblikk.

**Beslutning trengs:** (a) skal `sent` beholdes som hvilestatus (fjern auto-mottak, mottaker «åpner» eksplisitt)? eller (b) er auto-mottak riktig, og «Trekk tilbake» skal flyttes til `received` for avsender? Dette er statusmodell-arkitektur, ikke A-3a.

### N1-VEDTAK (Kenneth 2026-07-18) — status er PERSPEKTIV-AVHENGIG, ikke global

**Verken (a) eller (b). En tredje modell, og den er fundamentet for hele dokumentflyt:**

> **Status er relativ til den som ser. Det finnes ikke ett fasit-svar per status — etiketten tilpasses dokumentets mening og betrakterens rolle.** «Sendt» gjelder KUN brukeren som sender, som en kvittering. Andre brukere får status som gir mening for dem.

**Kenneths illustrasjon (gjelder alle steg, ikke bare send):**
- Admin sender → admin ser momentant **«Sendt»** (kvittering på egen handling).
- Mottaker ser **«Til behandling»** (eller tilsvarende), og dokumentet dukker opp i mottakers **«mine oppgaver»**.
- Når admin *senere* ser status i sin oversikt → **«Til behandling»** (dokumentets sanne tilstand), IKKE «Sendt».

**Målt — halve modellen er allerede bygget:**

| Lag | I dag | Kenneths modell |
|---|---|---|
| Lagret tilstand | `sent → received` ubetinget (`sjekkliste.ts:923`, `oppgave.ts:1107`) | ✅ **Allerede mottaker-perspektiv** — dokumentet lagres som «hos mottaker» |
| Badge | Global, én etikett for alle (`status-badge.tsx:40`) | ❌ skal være perspektiv-avhengig |
| «Hvem har ballen»-data | `recipientUserId` + `beregnHarBallen` (bygget i natt) | ✅ grunnlaget finnes |
| Perspektiv-visning | Finnes ikke for dokumentflyt | ❌ nytt |

**Frø som alt finnes:** `status-badge.tsx:43` — *«sent + mottaker har lest → vis «Lest»»*. En kontekst-avhengig etikett; bare ikke *seer*-avhengig ennå. Mønsteret skal utvides til å være betrakter-relativt.

**Det auto-mottak-koden så ut som en bug (fantom-`sent`) er FUNDAMENTET halvbygget:** den lagrede tilstanden er allerede mottaker-perspektiv. Det som mangler er visningslaget som gjør etiketten seer-avhengig, pluss «mine oppgaver»-listen filtrert på hvem som har ballen.

**Binder sammen alt:** funn 1 («vis hvem som har ballen»), N2 («Venter på» virker men er ikke synlig), N1 (perspektiv-status) — **samme sak fra tre vinkler.** Dette er fabels ramme for dokumentflyt, ikke en enkeltfiks. Ikke en tabell cowork skriver — utarbeides per dokumenttype, tilpasset meningen (Kenneth: *«ikke et fasitsvar for alle statuser»*).

### N2 — «Venter på»-treghet IKKE REPRODUSERT (ikke det samme som løst)

**Målt (web-Opus, ren sekvens):** ved videresend A.Markussen → Byggherre → A.Markussen oppdaterte «Venter på»-teksten korrekt ved *begge* steg. Kenneths tidligere manuelle test (rask fram-og-tilbake) opplevde den som fast.

**Status: IKKE REPRODUSERT — ikke løst** (§11e). To ekte observasjoner: web-Opus (ren, langsom sekvens) så oppdatering; Kenneth (rask klikking) så treghet. Mulig race under hurtig-klikking, eller Kenneth så på statusbadgen (som korrekt ikke endres). Vi kan ikke påstå den er fikset — kun at den ikke slo til i den strukturerte testen.

**Uansett utfall er retningen den samme:** teksten er ikke prominent nok. **Bekrefter funn 1-vedtaket** — løsningen er å gjøre «hvem har ballen» synlig, ikke å jage en treghet vi ikke klarte å reprodusere.

## Del E ikke kjørt — krever ikke-admin-bruker

Rollefiltrering (deaktiverte handlinger med begrunnelse) kunne ikke observeres — kun admin innlogget, som ser alt. På `closed` var handlingsraden helt tom (ingen deaktiverte knapper med tooltip, bare fravær). **Åpent:** logg inn som utfører/godkjenner for å verifisere «Kun administrator»/«Kun godkjenner»-begrunnelsene A-3a bygde.
