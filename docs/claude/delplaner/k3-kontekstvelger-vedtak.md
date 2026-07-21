---
name: k3-kontekstvelger-vedtak
status: 🟢 DESIGN LÅST (fabel 2026-07-21) — ordre skrives etter P1-lukking. K1+K2 lander først
eier: fabel (design) · Kenneth (retning) · cowork (sekvensering + gate)
sist_verifisert_mot_kode: 2026-07-21
kilde: ført av cowork fra fabel-relay. Fabels arbeidskopi i designprosjektet — denne er kanonisk
---

# K3 — Kontekstvelgeren som trakt (firma → prosjekt → byggeplass)

> ⚠️ **UAVKLART — venter fabel: er K3 P1s siste revisjon, eller en egen sak?**
>
> **Kenneth 2026-07-21:** *«K3 er den siste revisjonen av P1»* → P1 lukkes først når K3 er bygget, og designgaten på A+B+C er en **delgate**.
>
> **Fabel 2026-07-21:** *«K3-ordre skrives når P1 er lukket»* → P1 lukkes på sitt scope, K3 er **oppfølger**.
>
> **De to kan ikke begge stemme.** Cowork førte først Kenneths versjon som avgjort — det var for raskt. Fabel eier design-sekvenseringen og skal avklare. Konsekvensen er reell: står P1 åpen til K3 lander, blokkeres lukkingen av K1+K2+K3, og verifiseringsloggen holdes åpen i flere runder.

## Chip-innholdet rettes her (cowork-funn 2026-07-21)

Cowork sammenlignet implementasjonen mot fasit-bildene (`docs/redesign/fasit/01-`/`02-p1-fasit-r2-final.png`) og fant **ett avvik**:

| | Fasit (2a + 3a) | Bygget (A+B) |
|---|---|---|
| Topplinje | `A.Markussen AS` som **ren tekst** + chip `FIRMA ▾ \| ⇄` | Navnet **inne i** chippen, intet nivåord |
| Popover-rad (3a) | `FIRMA` (liten, farget) · **A.Markussen AS** (fet) · «Endre» | — |

**Designspråket er gjennomgående: nivåord + navn + handling.** Spec-teksten *«topplinja viser KUN eget nivå (firma: firmanavn; prosjekt: prosjekt + bygning)»* gjelder hvilken **entitet** som navngis — ikke chippens innhold.

**Hvorfor det betyr noe:** uten nivåordet bæres signalet av **farge alene**, og da svikter det for fargeblinde. Amber/blå skal forsterke teksten, ikke være eneste bærer.

**Rettes i K3**, ikke som egen lapp — K3 bygger om både chip og popover etter samme mønster.

> Utløst av Kenneths observasjon under P1-skjermbilderunden: *«nå blandes prosjekt og byggeplass i en salsasaus — alle ingredienser er synlig»*. Måling og bakgrunn: [kontekstvelger-funn-2026-07-21.md § K3](kontekstvelger-funn-2026-07-21.md).

## Tre vedtak (fabel 2026-07-21, «lås den»)

1. **Trakt-retningen er låst.** Én popover: **firma → prosjekt → byggeplass**. Kun **ett nivå åpent om gangen**. Et valgt nivå kollapser til en sammenfoldet rad med **«Endre»**.
2. **Den frittstående `ByggeplassVelger` fjernes i ny nav** — byggeplass bor i trakten. **K1-fiksen trengs likevel**, siden gammel nav beholder velgeren.
3. **Popoveren lukkes ved prosjektvalg.** Byggeplass er et **valgfritt ettervalg**, ikke et obligatorisk tredje steg.

## Låste prinsipper

| Prinsipp | Detalj |
|---|---|
| **Alle/Mine** | Er en **filter-pille**, ikke et eget nivå i trakten |
| **Firma-steget** | Vises **kun når brukeren har flere firmaer**. Ett firma → steget finnes ikke |
| **Firmabytte** | **Nullstiller nedover** — prosjekt og byggeplass tømmes |
| **«Hele prosjektet»** | Er default. **Bygg-steget vises kun når byggeplasser finnes** |
| **Lange lister** | Over 6 elementer: søkefelt + rulling + **«Sist brukt»**-seksjon |
| **Hierarkiet** | **Absolutt.** Gruppeetiketten navngir prosjektet |

## Sekvensering (cowork eier — bekreftet av fabel)

**K1 + K2 lander FØR K3.** Begrunnelse: K3 bygger på K2s navigasjonssemantikk. Bygges K3 først, bygges den på en semantikk som er i ferd med å endres.

**K3-ordren skrives etter at P1 er lukket** — ellers vokser P1 mens den verifiseres.

## Fasit ved ordreskriving

§ 3a i beslutningskartet + skjermbilder. **Begge ligger i designprosjektet, ikke i repoet** — må relayes av Kenneth til utførende Opus (jf. [MASTERPLAN § filkart](../../redesign/MASTERPLAN.md)).
