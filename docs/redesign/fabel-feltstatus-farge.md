# Til fabel: hvilken farge betyr «her må noen ta en avgjørelse»?

**Fra:** cowork · **Dato:** 2026-09-07 · **Status:** 🔴 ÅPEN — Kenneth har vedtatt prinsippet,
fargespråket mangler

## Kenneths vedtak (2026-09-07)

> *«bør varsles med farge dersom timer er valgt som modul → ikke la stå hvit → alle felter som
> krever en instilling eller en avgjørelse bør få en farve → f.eks gult i felter som mangler
> utfylling»*

**Prinsippet er låst.** Et felt som venter på en menneskelig avgjørelse skal ikke se ut som et felt
noen har svart på. **Hvordan det ser ut, er ditt.**

## Hvorfor dette går til deg og ikke til en kodeagent

🔴 **Gult er allerede opptatt.** Cowork har målt web-appen:

| Klasse | Forekomster |
|---|---|
| `bg-amber-50` | 95 |
| `bg-amber-100` | 48 |
| `bg-yellow-50` | 10 |
| Øvrige amber/yellow | ~34 |
| **Filer som bruker dem** | **96** |

Bruken er **ustandardisert** og handler i dag om **meldinger** — varselbannere, advarsler,
informasjonsbokser. Innfører vi gult på **felter** uten å avklare forholdet, får vi to
betydninger av samme farge på samme skjerm, og begge svekkes.

**Det er en fargespråk-avgjørelse, ikke en implementasjonsdetalj.** En kodeagent som velger
`bg-yellow-50` i god tro låser standarden ved uhell.

## Det vi trenger fra deg

**1. Hvilke tilstander finnes?** Cowork ser minst fire, men listen er din:

| Tilstand | Eksempel |
|---|---|
| Tomt og **påkrevd** — blokkerer lagring | Prosjektnavn |
| Tomt og **valgfritt** — helt greit | Beskrivelse |
| Tomt og **konsekvensbærende** — lagring går fint, men noe slutter å virke | 🔴 **reise-lønnsart: reisetid beregnes, men føres aldri** |
| **Tvetydig** — systemet kan gjette, men gjetningen kan bli feil | To lønnsarter matcher «reise» |

🔴 **Den tredje er saken som utløste dette**, og den er den vanskeligste: ingenting er ugyldig,
skjemaet lagrer, men en automatikk et helt annet sted blir stille slått av. **Ser den ut som
«valgfritt tomt» i dag, og det gjør den.**

**2. Hvordan skiller de seg visuelt** — og hvordan forholder det seg til amber-bannerne som alt
finnes? Skal feltet bære fargen, kantlinjen, en markør ved etiketten, eller noe annet?

**3. Gjelder det mobil også?** Firmaoppsett er kontorarbeid og bor i web. Men prinsippet
(«ikke la stå hvit») er generelt, og mobil har egne skjemaer. **Din vurdering.**

**4. Hva med et skjema der halvparten av feltene lyser?** Firmainnstillinger er lange.
🔴 **Fargen må ikke bli tapet.** Er det en grense der signalet slutter å virke, si det — da er
svaret kanskje en oppsummering øverst framfor farge per felt.

## Rammer — dette er ikke et blankt ark

- 🟢 **Presedens finnes:** `ui-standarder.md:120` — *«Deaktivert knapp skal si hva som mangler.»*
  Samme familie: si hva som mangler, ikke bare at noe er galt. **Fargen bør ikke erstatte teksten.**
- 🟢 **Mikrotekst-standarden gjelder** ([tooltip-hjelpetekst-veileder.md § 3](../claude/retningslinjer/tooltip-hjelpetekst-veileder.md)):
  hva mangler · hva blir konsekvensen · relasjonelle benevnelser.
- ⚠️ **Fargepaletten er per-firma konfigurerbar** i søsterproduktet, men SiteDoc har fast palett
  (`sitedoc-primary` m.fl., [ui-standarder.md](../claude/retningslinjer/ui-standarder.md)).
  **Velg innenfor den.**
- 🔴 **Ikke en full skjema-revisjon.** Vi trenger en standard som kan tas i bruk **opportunistisk**
  når en flate uansett røres — samme modell som mikrotekst-oppgraderingen. Cowork bestiller ingen
  sveip over 96 filer.

## Hva som bygges FØR du svarer

Reise-lønnsart-varselet bygges nå (`fix/reise-lonnsart-varsel`) med **eksisterende
banner-mønster**, ikke ny feltfarge. 🟢 **Det foregriper ikke svaret ditt** — banneret er en
melding, som er den bruken amber allerede har. **Feltfargen er det du definerer, og den kommer
etterpå.**

## Leveranse

Et avsnitt i [ui-standarder.md](../claude/retningslinjer/ui-standarder.md) — tilstandene, den
visuelle regelen for hver, og forholdet til dagens amber-bannere.

⚠️ **Kenneth stoppet på ~96 % bruksgrense 06.09.** Denne saken haster ikke: reisetid-varselet
leveres uten den. **Ta den når du er i gang igjen.**
