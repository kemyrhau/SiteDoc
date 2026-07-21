---
name: lesekvittering
status: 🔴 KREVER KENNETH-VEDTAK — ønsket i det hele tatt? Ikke startet, ikke planlagt
eier: Kenneth (vedtak) · fabel (design hvis ja) · cowork (måling gjort)
sist_verifisert_mot_kode: 2026-07-20
---

# Lesekvittering — skal vi vite når den ansatte åpnet dokumentet?

> Skilt ut av A-3b (fabel-gate 2026-07-20). **Ikke en fiks — en ny funksjon.** «Lest»-visningen har aldri virket, så å «gjenopprette» den er i praksis å innføre lesekvittering for første gang. Det har en personvern-/arbeidsmiljøside som krever Kenneths eksplisitte vedtak.

## Målt: funksjonen har aldri kjørt

Kjeden er død i **begge** retninger:

| Ledd | Kode | Hvorfor den aldri fyrer |
|---|---|---|
| **Skriveren** | `sjekkliste.ts:127`, `oppgave.ts:188` — setter `lestAvMottakerVed` kun når `status === "sent"` | Status persisteres **aldri** som `sent` |
| **Statusen** | `sjekkliste.ts:924`, `oppgave.ts:1110` — `effektivStatus = nyStatus === "sent" ? "received" : nyStatus` | Auto-mottak konverterer ubetinget; ingen rad hviler på `sent` |
| **Leseren** | `packages/ui/src/status-badge.tsx:44` — `status === "sent" && lestAvMottakerVed != null` | Begge konjunkter er umulige |

**Konsekvens:** `lestAvMottakerVed` er alltid `NULL` i databasen, og «Lest»-badgen har aldri vist seg for noen bruker. Feltet finnes i schema, men har aldri fått en verdi.

Dette er tredje gang i samme økt at et sitert «frø» viser seg å være kode som aldri har utført seg (append-only-låsingen, den døde `"oppretter"`-rollematchen, denne). Mønsteret er verdt å huske: **et felt i schema er ikke bevis på at en funksjon finnes.**

## Beslutningen (Kenneth)

**Spørsmålet er ikke «skal badgen si Lest?» — det er «skal systemet registrere når den enkelte ansatte åpnet et dokument, og vise det til avsender?»**

Piloten er ~50 ansatte hos A.Markussen. Innføres lesekvittering, kan arbeidsgiver se tidspunktet en navngitt ansatt åpnet et dokument. Det er behandling av personopplysninger om ansattes aktivitet, og det er et arbeidsmiljøspørsmål uavhengig av om det er juridisk kurant.

**Argumenter for:**
- Avsender slipper å purre på noe som allerede er lest — reduserer støy.
- «Er dette sett?» er et reelt spørsmål i dokumentflyt, og gjetting er verre enn fakta.

**Argumenter mot:**
- Overvåkningsopplevelse: den ansatte vet at åpne-tidspunktet registreres og vises til leder.
- Løser et problem «hvem har ballen»-visningen (A-3b Del 1c) allerede løser bedre — den sier hvem som *skal* handle, uten å registrere individuell atferd.
- Krever ny lagret tilstand, mens A-3b ellers er rent visningslag.

**Cowork-observasjon (ikke anbefaling — dette er Kenneths):** A-3b Del 1c gir avsender svaret «hvem har ballen nå» uten å registrere når en person åpnet noe. Overlappet er stort nok til at lesekvittering bør begrunnes med et behov Del 1c *ikke* dekker, ikke bare med at feltet finnes.

## Hvis vedtaket blir JA — omfang
1. Flytt skrive-betingelsen av `status === "sent"` (som aldri er sann) til noe nåbart — f.eks. mottaker åpner et `received`-dokument.
2. Badge-betingelsen tilsvarende.
3. **Avklar synlighet:** ser bare avsender lesetidspunktet, eller alle i flyten? Ser den ansatte selv at det registreres?
4. Personvern-dokumentasjon: behandlingsgrunnlag, lagringstid, informasjon til de ansatte.

## Hvis vedtaket blir NEI — omfang
Rydd bort den døde koden: `lestAvMottakerVed`-skrivingen i `sjekkliste.ts`/`oppgave.ts`, badge-grenen i `status-badge.tsx:44`, og vurder om schema-feltet skal droppes. Ellers står det som en felle for neste økt som tror funksjonen finnes.

**A-3b berøres ikke av vedtaket** — «Lest» er tatt ut av perspektiv-tabellen, og ordrens «alt er visningslag, lagret tilstand endres aldri» står intakt.
