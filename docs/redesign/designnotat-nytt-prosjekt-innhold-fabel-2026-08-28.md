# Designnotat — hva et nytt prosjekt skal inneholde

**Fra:** fabel · **Dato:** 2026-08-28 · **Status:** til Kenneths valg → deretter ordre
**Svar på:** `relay/fabel-nytt-prosjekt-innhold.md` (cowork 2026-08-28)
**Grunnlag:** prosjekt.ts:257 (opprett), :344 (opprettTestprosjekt, lest i sin helhet),
prosjektoppsett-veileder.md (2026-05-02), veileder-ordren (inbox 2026-08-28).
Ingenting i coworks måling bestrides.

## Anbefaling i én setning

**Blankt som default, «kopier oppsett fra et tidligere prosjekt» som tilbudt valg
ved opprettelse — aldri generisk seeding.**

## Svar 1 — blankt med veileder, ikke seeding

Generiske defaults strykes helt, ikke bare nedprioriteres. Grunnen står i coworks
eget notat: faggrupper er firmaspesifikke, og en «Entreprenør»/«Byggherre» ingen
bruker forurenser flytoppsettet. `opprettTestprosjekt` demonstrerer problemet i
kode: den seeder STANDARD_FAGGRUPPER og kobler oppretteren blindt til «første
faggruppe» — riktig for en testside, gal for et driftsprosjekt der faggruppene
skal hete noe kundens motparter kjenner igjen.

Veilederen er ikke plan B — den ER onboardingen. Fire tomme steg med lenker er en
ærligere start enn fire grønne steg fylt med innhold brukeren må rydde. Og
merk: veilederens DB-tilstandskilde finnes allerede — `prosjekt.ts:241` returnerer
`harBrukergruppe`, `harMalKobletTilFlyt`, `harLokasjon` m.fl. (dokgen-ordren kan
gjenbruke i stedet for å bygge tellinger på nytt).

## Svar 2 — innholdet kommer fra et tidligere prosjekt, valgt av brukeren

Nytt-prosjekt-skjemaet (tre felt i dag) får ett valg til:

```
Start fra:  (•) Blankt prosjekt
            ( ) Kopier oppsett fra …   [nedtrekk: firmaets prosjekter]
```

- Nedtrekket lister prosjekter i samme firma (ProjectOrganization-avgrenset).
- Valget er synlig kun når firmaet HAR minst ett prosjekt — et nytt firma ser
  aldri et tomt nedtrekk (svar 5).
- Dette matcher hvordan byggefirmaer faktisk jobber (coworks egen observasjon):
  neste prosjekt ligner forrige, ny adresse. Og det matcher etablert
  produktmønster: sjekklistemal-byggeren har allerede «Importer fra annet
  prosjekt» — kopi-fra-prosjekt er kjent vokabular i SiteDoc, nå løftet fra
  én mal til hele oppsettet.

## Svar 3 — hva kopien tar med og ikke

**Kopieres (oppsett — det som beskriver HVORDAN firmaet jobber):**

| Hva | Merknad |
|---|---|
| Faggrupper | navn, bransje, farge, nummer — IKKE medlemskoblinger |
| Dokumentflyter | per faggruppe, med roller |
| Brukergrupper | som tomme skall (navn/slug/rettigheter/domener) — IKKE medlemmer |
| Rolle→gruppe-koblinger | følger med fordi gruppeskallene kopieres |
| Maler (ReportTemplate + objekter) | prosjektkopi, som «Importer fra annet prosjekt» gjør i dag |
| Mal→flyt-koblinger | følger flyten |

**Kopieres IKKE (innhold og sted — det som beskriver HVA og HVOR):**
medlemmer, tegninger, byggeplasser/lokasjoner, områder, kontrollplan, dokumenter,
timer-/maskin-/varelager-data.

Grensen er én regel, ikke en liste å pugge: **oppsett kopieres, innhold og
lokasjon gjør ikke.** Brukergruppe-skall uten medlemmer er den ene subtiliteten:
kopieres ikke skallene, peker flytrollene på ingenting og kopien er ødelagt;
kopieres medlemmene, har det nye prosjektet fått bemanning ingen har valgt.
Skall med rolle-koblinger, null personer, er den ærlige midten — veilederens
«Brukergrupper»-steg forblir da naturlig utfylt-men-tomt og lenker til stedet
folk legges inn.

Prosjektspesifikke faggruppenavn («Byggherre Boligfelt B12») kopieres som de er —
navnet er redigerbart, og et gjenkjennelig-men-litt-feil navn å rette er bedre
enn et generisk. Ingen navnemagi (ikke prøv å flette nytt prosjektnavn inn).

## Svar 4 — ingen firmamal-entitet i denne omgangen

Kopi-fra-prosjekt gjør hvert prosjekt til en potensiell mal, uten ny modell.
Dermed: **ingen avhengighet til ReportTemplate/OrganizationTemplate-migreringen**
— designet forutsetter den ikke, og 🔴-rammen respekteres. En eksplisitt
«firmamal» (utpekt standardoppsett på Organization-nivå) er et naturlig steg 2
HVIS kunder viser seg å kopiere samme prosjekt hver gang — men den beslutningen
er billigere å ta med bruksdata enn nå, og den vil da møte migreringsspørsmålet
med åpne øyne.

## Svar 5 — første prosjekt i nytt firma: blankt, veilederen er svaret

Ikke noe å kopiere → valget vises ikke → blankt + veileder. Det er nøyaktig
situasjonen veilederen ble planlagt for i mai («blokkerer selvstendig
A.Markussen-onboarding»). Malbiblioteket (NS 3420, «Hent fra bibliotek») dekker
mal-steget for den som starter fra null — ingen generisk seeding trengs der heller.

## Implementasjonsform (til ordren, når den skrives)

- Én ny tRPC-mutasjon `prosjekt.kopierOppsett` (eller input-utvidelse på
  `opprett`): kjør dagens opprett-transaksjon, deretter kopiér i samme
  transaksjon i rekkefølgen brukergruppe-skall → faggrupper → flyter (med
  rolle→gruppe-mapping via id-oversettelsestabell) → maler+objekter → mal-koblinger.
  Alt-eller-ingenting; en halvkopiert flyt er verre enn blank.
- Tilgang: kopikilden må være et prosjekt brukeren er medlem av i samme firma.
- `opprettTestprosjekt` røres ikke — testsiden skal fortsatt seedes generisk.
- Veilederen trenger ingen endring (dokgen-ordren har alt tatt høyde for at
  steg kan være grønne ved fødsel).

## Rammer kvittert

- Faggruppe (part i flyt) vs. brukergruppe (samling ansatte) holdt adskilt hele
  veien — kopiregelen behandler dem ulikt nettopp derfor.
- «Entreprise/Enterprise» ikke brukt.
- ReportTemplate-migreringen ikke startet, ikke forutsatt.

**Åpent for Kenneth:** (1) blankt-som-default bekreftes — eller skal «kopier fra
forrige» være forhåndsvalgt når firmaet har prosjekter? Anbefaler blankt som
default første runde; kan snus med bruksdata. (2) Er brukergruppe-skall-uten-
medlemmer riktig for hvordan A.Markussen faktisk bemanner — eller gjentas samme
folk så ofte at medlemskopi bør tilbys som avhuking?

---

## 🟢 KENNETH-VEDTAK 2026-08-28 — begge åpne punkter avgjort

**1. Blankt er default.** «Kopier fra forrige prosjekt» vises som et valg når firmaet
har prosjekter, men er ikke forhåndsvalgt. Begrunnelse: en forhåndsvalgt kopi arver et
annet prosjekts faggrupper og flyt stille, og første gang det er feil må brukeren
oppdage noe han aldri valgte. Kan snus senere med bruksdata — fabels anbefaling fulgt.

**2. ⚠️ SNUDD SAMME DAG — les
[designnotat-registreringsmodellen-fabel-2026-08-28.md](designnotat-registreringsmodellen-fabel-2026-08-28.md)
§ «Kopi-fra-prosjekt består som tillegg» FØR du bygger dette.** Vedtaket under står som
det ble tatt, men er **erstattet**: medlemskopi-som-avhuking avløses av
`prosjektTilgang`-regelen per ansatt (`alle`/`avdeling`/`manuell`) — regelen svarer på
spørsmålet avhukingen prøvde å stille, og gjør den overflødig. Grunnen til snuingen var
at ansatt-livssyklusen ikke var premiss da dette vedtaket ble tatt.

🔴 **`relay/inbox-kopier-prosjektoppsett.md` krever fortsatt avhukingen og skal IKKE
relayes uendret.**

Det opprinnelige vedtaket, bevart:

**2. Medlemmer kopieres, som avhuking.** Ikke tomme skall som standard-eneste-vei.
Gruppene («Ansatte», «Ledelse») er rollebaserte og de samme personene går igjen på
tvers av prosjekter, så skall-uten-folk ville betydd å bemanne på nytt hver gang.
Avhukingen bevarer fabels poeng — bemanningen blir valgt, ikke arvet stille.

🔴 **Konsekvens som må håndteres i ordren:** å kopiere medlemmer er ikke bare
bekvemmelighet, det er **å gi tilgang**. De kopierte personene får `ProjectMember`-rader
og dermed innsyn i et prosjekt de ikke hadde før. Avhukingen skal derfor si hvor mange
personer den gir tilgang til, ikke bare «kopier medlemmer».
