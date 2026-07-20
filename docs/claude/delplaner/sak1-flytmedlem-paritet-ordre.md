---
name: sak1-flytmedlem-paritet-ordre
status: 🟡 SKREVET (cowork 2026-07-19) — venter fabel-gate før kode-Opus starter
eier: cowork (måling + ordre) · fabel (gate) · kode-Opus (ledd 3)
sist_verifisert_mot_kode: 2026-07-19
---

# Ordre — Sak 1 (G1-mutere): flyt-medlemskap likestilles med faggruppe-medlemskap

> Cowork-måling 2026-07-19 → fabel-vedtak **(a) paritet**. Erstatter den opprinnelige «G1-mutere»-framingen (som antok at problemet var UX/rollefiltrering — det var det ikke).

## 0. For deg som koder (les først)

**Hvem du er:** kode-Opus, **ledd 3 (koding)**. Cowork målte og skrev ordren, fabel gatet den. **Du koder — kun det.** Du gater ikke, tester ikke med brukere, merger ikke, deployer ikke.

**Branch:** `fix/sak1-flytmedlem-paritet` fra develop (`37935a08`). Du pusher kun denne.

**Leveranse (én fase — omfanget er én funksjon + 6 call-site-opprydninger):** implementer § 2 → `next build` grønn → push → vis diff til cowork.

**Ditt neste svar:** diff + build-status.

## 1. Målingen som styrer vedtaket

**Dagens autorisasjonsmodell for dokument-mutasjoner (kode-målt):**

| Lag | Hva styrer det | Hvor |
|---|---|---|
| **Hvem** | `verifiserDokumentTilgang` — **alene** | 11 mutasjons-call-sites |
| **Når** | status-vakter (`kun utkast`, `kun utkast/avbrutt`, append-only) | i hver mutasjon |
| **Rolle** | `verifiserFlytRolle` — **kun 2 av 11** (`endreStatus` × 2) | `sjekkliste.ts:716`, `oppgave.ts:905` |

De 9 øvrige mutasjonene (oppdater, oppdaterData, forbedreOversettelse, slett × 2 filer, leggTilKommentar) har status-vakter men **ingen rolle-vakt**. Et faggruppe-medlem på dokumentets bestiller/utfører-faggruppe kan derfor i dag redigere og slette utkast uavhengig av flytrolle. **Det er modellen, ikke en bug.**

**Konsekvens:** lese/skrive-splitten fra N3 del 2 er en **anomali** — et person-direkte flyt-medlem behandles som svakere enn et faggruppe-medlem uten prinsipiell grunn. Denne ordren fjerner anomalien.

## 2. Oppdraget

**Gjør flyt-grenen i `verifiserDokumentTilgang` ubetinget.** Siden alle 11 mutasjons-call-sites skal ha flyt-tilgang (parietsvedtaket), er `tillatFlytMedlemskap`-flagget meningsløst:
- Fjern parameteren `tillatFlytMedlemskap` fra signaturen.
- Fjern `true`-argumentet fra de 6 lese-sitene (N3 del 2 la dem inn).
- Grenen fyrer for alle 17 call-sites.

**Uendret i grenen:**
- **F1-A består:** grenen fyrer fortsatt IKKE for private HMS-dok (`domain === "hms" && hmsSynlighet !== "apen"`). HMS-personvern er ikke del av paritetsvedtaket.
- **Status-vaktene består:** «kun utkast», «kun utkast/avbrutt», append-only — de styrer *når*, uendret.
- **`verifiserFlytRolle` består** på de 2 `endreStatus`-sitene — statusoverganger forblir rolle-styrt. Et person-direkte medlem passerer nå tilgangsgaten, og rollen deres avgjør deretter hvilken overgang som er lov. Det er ønsket oppførsel.

**Krav 1 — delt medlemskapskilde (ufravikelig):** grenen skal fortsatt bruke `hentFlytIderForMedlem` / `hentBrukersFlytMedlemskap`. **Null kopier, ingen ny variant, ingen faggruppe lagt i helperen** (index-only fra `bed4b6a3` bevares). Blir det behov for en annen returform — stopp og flagg.

**Avvik-plikt:** finner du en call-site der grenen **ikke** bør fyre, **stopp og flagg** i stedet for å innføre et nytt flagg på eget initiativ.

## 3. Krav 2 — testdekning begge retninger (cowork lager testplan, web-Opus kjører)

1. **D5-snu (den inverterte):** kmy (person-direkte flyt-medlem) klikker en skrive-handling på et dokument i sin flyt → **skal nå LYKKES**. I N3-del-2-testen ga den «Du har ikke tilgang til dette dokumentet». Statusovergangen skal fortsatt være rolle-styrt (`verifiserFlytRolle`).
2. **Faggruppe-regresjon:** en faggruppe-bundet bruker skal kunne gjøre nøyaktig det samme som før — verken mer eller mindre. Endringen legger til en tilgangsvei, den skal ikke røre den eksisterende.
3. **Negativ kontroll:** bruker uten flyt-medlemskap, faggruppe eller gruppe blir fortsatt avvist på alle 11 mutasjonene.
4. **Periode-vindu:** deaktivert flyt-medlem (`periode_slutt` satt) mister også skrive-tilgang, ikke bare lese (arves fra helperen).
5. **F1-A:** privat HMS-dok forblir utilgjengelig for flyt-medlem — også på skrive-siden.
6. **Admin uendret.**

## 4. Krav 3 — (b) føres som egen arkitektursak

Alternativ (b) («flyt-medlemmer får kun det flytrollen tillater») er **ikke** forkastet som idé — det er utsatt fordi det egentlig er spørsmålet *«bør dokument-mutasjoner rollestyres i det hele tatt?»*, som treffer dagens faggruppe-brukere like hardt. Ført som egen sak: [sak1b-mutasjoner-rollestyring.md](sak1b-mutasjoner-rollestyring.md). **Skal ikke smugles inn i denne ordren.**

## 5. Ufravikelig
- Datamodell røres ikke. Statusmaskin røres ikke. Status-vaktene røres ikke.
- `hentBrukersFlytMedlemskap` = eneste medlemskaps-kilde, null kopier.
- Ingen i18n-endring forventet (ingen nye brukervendte strenger). Endres det, flagg.
- Opus pusher egen branch, aldri develop.

## 5b. Ledd 2-bekreftelse (cowork, kode-målt 2026-07-19) — GRØNT

Fabel gatet vedtaket (parameter fjernes, gren ubetinget). Cowork bekrefter at «ubetinget» er trygt å utføre:

| Sjekk | Funn | Dom |
|---|---|---|
| Komplett call-site-inventar | **17**, alle i `routes/oppgave.ts` (10) + `routes/sjekkliste.ts` (7). **Ingen kallere** i services/trpc/andre routes | ✅ ingen skjult kaller rammes |
| Sender alle `dokumentId` + `dokumentType`? | **17 av 17** — `dokumentParter` fylles overalt | ✅ grenen kan faktisk fyre alle steder |
| Overlever F1-A flagg-fjerningen? | HMS-vilkåret er et **eget konjunkt** (`!(domain==="hms" && synlighet!=="apen")`), ikke bundet til flagget | ✅ privat HMS forblir blokkert |
| Antall `true`-argumenter å fjerne | **6** (lese-sitene fra N3 del 2) | ✅ matcher |

**Konsekvens:** etter endringen gjelder flyt-tilgang på alle 17 stier. Status-vaktene og `verifiserFlytRolle` (2 × `endreStatus`) er urørt og styrer fortsatt *når* og *hvilken overgang*.

## 6. DoD
Kode → `next build` grønn → push → cowork-review av diff → cowork lager testplan (ledd 4) → web-Opus kjører (ledd 5) → Kenneth klikker → fabel-gate → dok-sync (`dokumentflyt.md § 3`: paritets-vedtaket + at flagget er borte) → «klar for commit».
