---
name: mobil-opplasting-protokoll-2026-08-23
description: Simulator-verifiseringsprotokoll for uploadAsync-fiksen (0-byte + manglende filendelse). Fire krav-tilfeller med negativ kontroll. Kjøres av SiteDoc-simulator-agenten.
sist_verifisert_mot_kode: 2026-08-23
sist_endret: 2026-08-23
---

# Verifiseringsprotokoll — mobil opplasting (uploadAsync, 0-byte + filnavn-hull)

**Branch:** `fix/mobil-uploadasync-0byte` · **Rolle:** `SiteDoc-simulator` (simctl/idb) kjører dette.
kontrollplan bygde koden; kan ikke kjøre simulator selv.

## Hva som ble fikset (kontekst)

1. **0-byte (rotfiksen på branchen):** mobil gikk fra `fetch`+`FormData` til
   `FileSystem.uploadAsync`, fordi `fetch` med `{uri}`-objekt sendte TOM kropp under New
   Architecture (RN 0.81) på privat-opplasting (`?privat=1`) → serveren lagret 0-byte filer.
2. **Filnavn-hull (denne runden, `opplasting.ts`):** `uploadAsync` har ingen filnavn-opsjon —
   den utleder multipart-`filename` fra URI-ens basename. `upload.ts:121` avviser tomt suffiks
   med **400** FØR magic-bytes får korrigert noe. Fiks: fila kopieres til en cache-sti navngitt
   `sikreEndelse(filnavn, mimeType)` (endelse utledes fra MIME om den mangler) og lastes opp
   derfra, så tiltenkt navn + endelse når serveren.

## 🔴 Negativ kontroll — les FØR du starter

**En opplasting som lykkes uten at fila har bytes SER UT som suksess.** HTTP 2xx alene beviser
ingenting. Hvert tilfelle krever ALLE tre:
1. **HTTP 2xx** (responsstatus)
2. **`fileSize > 0`** i responsen — les fra `[OPPL] Suksess: … size:`-loggen (console) eller
   responskroppens `fileSize`-felt. `0` = fortsatt bugget, uansett status.
3. **Innhold vises** — thumbnail/visning viser faktisk bilde (ikke svart/tomt), eller for PDF:
   riktig visningsnavn i vedleggslista.

Serveren returnerer `fileSize: data.file.bytesRead` (`upload.ts`), så størrelsen er direkte lesbar.

**Privat sti (`?privat=1`) serveres signatur-KUN** — du kan ikke hente fila anonymt for å måle
bytes på disk. Bruk responsens `fileSize` + visningen i appen (som er autentisert).

## Krav-tilfeller

### 1 · Kamerabilde på sjekkliste (privat sti)
- **Gjør:** åpne en sjekkliste, legg til bilde via **Kamera** på et felt (FeltDokumentasjon → privat).
- **URI-form:** kamera gir typisk `…/ImagePicker/xxxx.jpg` — endelse finnes, bør ha fungert før òg.
- **Krav:** HTTP 2xx ∧ `fileSize > 0` ∧ thumbnail viser bildet (ikke svart).

### 2 · 🔴 PDF plukket fra Filer (uten endelse i cache-stien) — VIKTIGST
- **Gjør:** legg til vedlegg → **Filer** → velg en **PDF**. Document-picker kopierer ofte til en
  cache-uri **uten** `.pdf`-endelse.
- **Hvorfor kritisk:** `bildeEndelseFraMagic` (server) returnerer kun `.png/.jpg/null` → et
  dokument uten endelse har **ingen redning bak extname-gaten**. Uten fiksen: 400. Med fiksen:
  `sikreEndelse` legger på `.pdf` fra `application/pdf`.
- **Krav:** HTTP 2xx ∧ `fileSize > 0` ∧ **riktig visningsnavn** i vedleggslista (det opprinnelige
  dokumentnavnet, ikke en cache-hash eller «(ingen)»).

### 3 · Timer-kvittering (privat sti)
- **Gjør:** dagsseddel → utlegg/tillegg → legg til kvitteringsbilde (privat, signatur-KUN).
- **Krav:** HTTP 2xx ∧ `fileSize > 0` ∧ thumbnail viser kvitteringen.

### 4 · HEIC-bilde — MÅL, ikke anta (fjerde tilfelle, fra kontrollplans mistanke)
- **Gjør:** ta et **HEIC**-foto i simulatoren (iOS-standardformat) og last opp på sjekkliste.
- **Mistanken:** `bildeEndelseFraMagic` korrigerer kun til `.png/.jpg` — ikke `.heic`. Et HEIC med
  `.heic`-endelse kan lagres som `.heic` mens serveren venter png/jpg for thumbnails.
- **Mål (ikke godkjenn/avvis på forhånd):** noter **hvilken endelse fila faktisk lagres med**
  (responsens `fileType`/`fileUrl`), og **om thumbnailen viser innhold eller er svart/tom**.
- **Rapporter som funn**, ikke krav: dette steget måler HEIC i stedet for å gjette. Ett steg.

## Forventet output (per tilfelle)

| # | Tilfelle | HTTP | fileSize | Innhold/visningsnavn | Funn el. mistanke |
|---|----------|------|----------|----------------------|-------------------|
| 1 | Kamera → sjekkliste | | | | |
| 2 | PDF fra Filer | | | | |
| 3 | Timer-kvittering | | | | |
| 4 | HEIC-foto | | (mål) | (mål) | (mål lagret endelse + visning) |

Skill **funn** (målt) fra **mistanke** (ikke verifisert). Er noe uklart: si det, ikke gjett.
