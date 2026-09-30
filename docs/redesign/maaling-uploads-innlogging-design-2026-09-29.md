---
status: 🟢 MÅLING — ingen kodeendring. Svar på coworks måleordre 2026-09-29
forfatter: design
base: develop 230f2b64
---

# Innlogging for hele `/uploads/` — måling og forslag

🔴 **Skillet mellom MÅLT og FORESLÅTT holdes gjennom hele dokumentet. § 4 lister det design IKKE
har målt.**

## § 1 KRAV 1 — hvem henter filer uten å være en innlogget nettleser?

### 🔴 Hovedfunnet: mobilens bildevisning bærer ingen sesjon, og kan ikke få den uten en endring

**MÅLT:**

| | Kilde |
|---|---|
| **Mobil autentiserer med Bearer-token i header**, lagret i SecureStore | `lib/trpc.ts:20` `Authorization: \`Bearer ${token}\`` · `services/auth.ts:25` SecureStore |
| **Mobil bruker IKKE cookie** | ingen cookie-håndtering i `apps/mobile/src` |
| **Bildet rendres med React Natives native laster** | `FeltDokumentasjon.tsx:413-414` `<Image source={{ uri: bildeUrl }} />` |

🔴 **`<Image source={{ uri }}>` sender en naken GET. Ingen `Authorization`-header, ingen cookie.**
⚠️ **Skrus innloggingskravet på i dag, blir hvert bilde i mobilappen en tom ramme uten feilmelding.**

### 🟢 Mobilens ANDRE filveier bærer sesjon allerede

**MÅLT — alle tre bruker JS-`fetch` med eksplisitt header:**

| Konsument | Kilde |
|---|---|
| `services/bildeRegistrering.ts` | `:107-111`, `:163-167`, `:202-206`, `:227-231` — `Authorization: Bearer` |
| `services/ifcCache.ts` | `:114` |
| `services/offlineKlargjoring.ts` | `:78` |

🟢 **Skillet er ikke «mobil vs web». Det er «JS-fetch vs native bildelaster».**

### 🟢 Web bærer sesjon — via en rewrite

**MÅLT:** `apps/web/next.config.js:146` rewriter `/api/uploads/:path*` til API-et. **Nettleserens
forespørsel går altså SAME-ORIGIN mot web-appen, og Auth.js-cookien sendes med `<img>`.**

🟡 **IKKE MÅLT: om Next faktisk videresender `Cookie`-headeren gjennom rewriten.** **Hele
web-veien hviler på det. Se § 4.**

### 🟢 Server-side konsumenter passerer ikke gaten

🟢 **Bekrefter coworks måling:** arkiv-/PDF-genereringen leser fra disk og bygger inn data-URI-er.
**Design fant ingen server-side HTTP-henting av `/uploads/` i `apps/api/src`.**

### Oppsummering krav 1

| Konsument | Bærer sesjon i dag | Kan bære sesjon |
|---|---|---|
| **Web `<img>` / `<a>`** | 🟢 **ja** (cookie, same-origin via rewrite) | — |
| **Mobil `<Image>`** | 🔴 **NEI** | 🟡 **ja, men krever endring:** `source={{ uri, headers: { Authorization } }}` |
| **Mobil `fetch` (bilde/ifc/offline)** | 🟢 **ja** (Bearer) | — |
| **Arkiv/PDF på server** | — | **passerer ikke gaten (disk)** |

## § 2 KRAV 2 — hvilke lagrede objekter har en eierrad?

**MÅLT i `packages/db/prisma/schema.prisma`:**

| Modell | Eierskap | Hopp til `projectId` |
|---|---|---|
| `Drawing` | 🟢 **`projectId` direkte** | 0 |
| `PointCloud` | 🟢 **`projectId` direkte** | 0 |
| `Overflate` | 🟢 **`projectId` direkte** | 0 |
| `FtdDocument` | 🟢 **`projectId` direkte** | 0 |
| `DrawingRevision` | 🟢 **`drawingId`** (indeksert) → `Drawing.projectId` | 1 |
| `Image` | 🟡 **`checklistId` / `taskId`** (begge nullable, begge indeksert) | 2 |
| `OrganizationIntegration` | 🟡 **`organizationId`** — firma, ikke prosjekt | — |

🔴 **`Image.fileUrl` er IKKE unikt indeksert.** **Et oppslag fra sti → eierrad er derfor en full
skanning i dag.** **Det er den eneste DB-endringen forslaget under krever.**

🟡 **IKKE MÅLT: eksporter og HMS-vedlegg.** **Design fant ingen egen modell for dem; de kan være
`Image`-rader eller ligge utenfor `/uploads/`. Se § 4.**

## § 3 KRAV 3 — forslag til gate-design

🔴 **Alt i denne paragrafen er FORESLÅTT, ikke målt.**

### 🟢 Forslaget: bind signaturen til sesjonen

**I dag signerer `signerFilSti` over `(sti, exp)`. Forslaget er å signere over `(sti, exp, userId)`.**

**Da gjelder:**

- 🔴 **URL alene er ikke nok** — Kenneths krav. **En lekket URL virker ikke uten den matchende
  innloggingen.**
- 🟢 **Signaturen beholdes uendret som lag**, med 15-minutters-vinduet. **Ingenting fjernes.**
- 🟢 **Ingen DB-runde pr. fil.** ⚠️ **Dette er svaret på femti-vedleggs-spørsmålet:** **gaten leser
  sesjonen ÉN gang pr. forespørsel (den lesingen skjer uansett) og verifiserer HMAC lokalt.**

### 🟢 Hvorfor prosjekttilgang ikke trenger et oppslag pr. bilde

🔴 **Signaturen utstedes bare inne i en query som ALT har passert `harProsjektTilgang`.**
🟢 **En gyldig signatur er derfor et bevis på at tilgangen ble kontrollert ved emisjon** — én
kontroll pr. sjekkliste, ikke femti pr. vedlegg.

⚠️ **Prisen er eksplisitt og bør sies høyt: mister en bruker prosjekttilgang, virker URL-ene han
alt har i inntil 15 minutter.** 🟢 **Det er samme vindu Kenneth har akseptert.**

### 🟡 Der eierraden trengs likevel

**For filer som IKKE emitteres gjennom en query som har sjekket prosjekttilgang, må gaten slå opp
eieren.** 🔴 **Da kreves `@@index([fileUrl])` på `Image`** — ellers er hvert slikt oppslag en full
skanning.

### 🔴 Mobil må endres FØR gaten skrus på

**Rekkefølgen er ikke valgfri:**

1. **Mobil `<Image>` får `headers: { Authorization }`** — og det verifiseres på ENHET, ikke i benk.
2. **Deretter** skrus innloggingskravet på.

⚠️ **Motsatt rekkefølge gir tomme bilder i felt uten feilmelding** — samme stille feil som de
forgiftede lenkene.

## § 4 Det design IKKE har målt

🔴 **Fyll ikke disse med antakelser.**

1. **Om Next videresender `Cookie` gjennom `/api/uploads/`-rewriten.** **Hele web-veien hviler på
   det.** **Måles med én forespørsel mot test med en innlogget nettleser.**
2. **Om `<Image source={{ uri, headers }}>` faktisk virker i denne Expo-/RN-versjonen på iOS OG
   Android.** **API-et finnes; design har ikke kjørt det.** **RN cacher bilder på URI, ikke på
   header — atferden ved cache-treff er umålt.**
3. **Eksporter og HMS-vedlegg** — ingen egen modell funnet; eierskap ukjent.
4. **Simulatoren.** **Den peker mot prod (BACKLOG) og er ikke målt her.**
5. **Om noen tredjepart (e-post, Proadm) henter `/uploads/`.** **Design har ikke søkt utenfor
   repoet.**
