---
status: 🟢 MÅLING — masterplanen mot kode. Bestilt av Kenneth 2026-09-30
forfatter: design
base: develop 49d3fffb
---

# Masterplanen mot hva som faktisk har landet

## § 1 Hvorfor målingen kom

**Kenneth 2026-09-30:** *«jeg syns utviklingen på sett og vis har stoppet opp. nå er det svært
små fikser her og der. det virker ikke som om masterplanen følges.»*

🟢 **Tallet støtter observasjonen. develop, siste tre døgn — 80 commits:**

| Type | Antall |
|---|---|
| `docs(samarbeid)` — regler om hvordan vi jobber | 🔴 **13** |
| `fix` | 17 |
| øvrige `docs` | 13 |
| **`feat`** | 🔴 **2** |

🔴 **Ni separate merge-runder gikk til ÉN funksjon (annotering).** ⚠️ **Design skrev de fleste
av de tretten samarbeids-commitene — den største enkeltandelen av prosessarbeidet er designs.**

## § 2 Planen er selv utdatert — og den advarer mot det

🔴 **`REDESIGN-MASTERPLAN.md` er sist rørt 2026-09-26.** **develop har fått 80 commits siden.**

**Planen bærer sin egen lekse, tatt to ganger:**

> 🔴 **Mønster, andre gang på rad:** både P2 og ON sto på «kan ordres nå»-lista og var levert.
> **Cowork måler mot KODE før hver plan-ordre, ikke mot listen.**

🔴 **Design målte alle seks «IKKE BYGGET»-punktene mot koden. To til var utdatert — altså fjerde
og femte gang samme felle.**

## § 3 «IKKE BYGGET» — målt mot `49d3fffb`

| Punkt | Planen sier | 🔴 MÅLT |
|---|---|---|
| **LP** — lokasjonsnivå | «`lokasjonOmfang` har kun `punkt`/`byggeplass`, `:1168`» | 🔴 **UTDATERT.** Tredje nivå `"omrade"` landet **2026-09-23** med `omradeId` + app-validering (`schema.prisma:1291-1298`). **Linjenummeret stemmer heller ikke** |
| **BL** — byggeplass-nivå | «`Byggeplass` har kun `status`, `:953`» | 🔴 **UTDATERT.** Modellen har `type` («bygg»/«anlegg»), `latitude`/`longitude`/`radiusM` (geofence), `hmsregNummer`, `number`, `address` |
| **Del 7** — seddel-statusfarger | ikke bygget | 🟡 **TROLIG LEVERT.** `b1eb484c feat(statusfarger): én nøytral fargekilde for dokumentstatus — web + mobil` + merge `1d6bd31d`. ⚠️ **Commitene sier «dokumentstatus», planen sier «seddel» — design har IKKE bekreftet at det er samme sak** |
| **Del 8** — dokumentflyt-redesign | ikke bygget | 🟡 **DELVIS.** Flere flyt-commits siden 01.09 (`21520673` opprett uten modal, `c7049531` flytvalg etter hent). **Om det dekker «redesign» er ikke målt** |
| **10/K11 + 10a fase 2** | `admin/prosjekter/` lever | 🟢 **STEMMER.** `apps/web/src/app/dashbord/admin/prosjekter/page.tsx` finnes fortsatt |
| **K14** — admin i søkeregisteret | ikke bygget | 🟡 **IKKE AVGJORT.** Registeret er `lib/hub-ruter.ts`; `sok-dekning.test.ts` har 6 treff på «admin». **Design har ikke lest om de dekker K14** |

🔴 **Nettoen: av seks punkter er ÉTT sikkert ubygget. To er utdaterte. Tre er uavklarte.**

## § 4 Hva dette betyr

🔴 **Planen kan ikke brukes til å prioritere i den tilstanden den er i.** ⚠️ **En liste der to
av seks punkter er feil, og tre er uavklarte, gir ingen rekkefølge — den gir en ny målerunde
per punkt.**

🟢 **Det er derfor ikke sant at «masterplanen ikke følges». Det er sannere at planen ikke VET
hva som er gjort**, og at ingen har ført den siden 26.09 mens 80 commits landet.

🔴 **Og det forklarer mønsteret Kenneth så:** **når planen ikke kan brukes til å velge, velger
feltfunn selv.** **Ni annoterings-runder er ikke et brudd på prioriteringen — de er fraværet
av en.**

## § 5 Anbefaling

🟢 **1. Før planen à jour FØR neste prioritering.** **Én runde: seks punkter, målt mot kode, med
`fil:linje`.** **Design har gjort tre av dem i denne rapporten; tre gjenstår.**

🟢 **2. Deretter: velg ETT planpunkt og kjør det parallelt med feltfunn.** **§ ARBEIDSFORM har
alt mekanikken — ett plan-spor og ett funn-spor. Den har ikke vært brukt på tre døgn.**

🔴 **3. Ikke skriv flere samarbeidsregler før et planpunkt har flyttet seg.** **13 mot 2 er
tallet som skal snus, og designs andel er den største.**

## § 6 Det design IKKE har målt

1. **Om Del 7 «seddel-statusfarger» er samme sak som `feat(statusfarger)`.**
2. **Om Del 8 er dekket av flyt-commitene siden 01.09.**
3. **Om K14 er dekket av admin-treffene i `sok-dekning.test.ts`.**
4. **`MASTERPLAN.md`** — DOC-MAP sier planen finnes forgrenet i to filer. **Design fant kun
   `REDESIGN-MASTERPLAN.md`; den andre er ikke lokalisert.**
