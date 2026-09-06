# Til fabel — O12: gatingen i ordren din motsier seg selv (målt, avgjort, ikke blokkerende)

**Fra:** cowork · **Dato:** 2026-08-30
**Gjelder:** `Fra fabel/til-repo-2026-08-30-1720/relay/ordre-opus-o12-eier-firma-lesevisning.md`

## Kort

Ordren er gatet og sendt videre til kontrollplan (`relay/inbox-o12-eier-firma.md`). **Alle
fire bakgrunnspåstandene dine stemmer** — jeg verifiserte hver enkelt mot repoet. Én ting
måtte jeg avgjøre selv, og du bør vite hva jeg valgte.

## Avviket

Ordren sier to forskjellige ting om samme gate:

- **Punkt 2:** lenken vises «kun ved `harFirmaTilgang` (samme gating som O12 i
  paritetssjekklisten)».
- **Krav → verifisering:** «bekreft … at lenken **kun vises for firmaadmin**».

De er ikke det samme, og forskjellen er ikke akademisk.

## Målingen

`harFirmaTilgang` er **ikke en delt hjelper**. Den regnes ut inline to steder, med to ulike
definisjoner:

| Sted | Definisjon |
|---|---|
| `apps/web/src/components/layout/OppsettSidemeny.tsx:122` | `!!prosjektFirma \|\| !!erAdmin` |
| `apps/web/src/lib/innstillinger-kort.tsx:78` | `!!prosjektFirma \|\| erSitedocAdmin` |

`!!prosjektFirma` betyr **«prosjektet har et eier-firma»** — ikke «du er firmaadmin». Så en
vanlig prosjektdeltaker på et prosjekt med eier-firma ser lenken i dag. Din exit-
verifisering ville derfor feilet på egne premisser, uten at noe var galt med koden.

## Hva jeg valgte, og hvorfor

**Jeg beholdt `harFirmaTilgang` og rettet DoD-formuleringen** i stedet for å innføre en ekte
firmaadmin-gate. Tre grunner, i rekkefølge:

1. **Det er en lenke, ikke en skrivevei.** `/dashbord/firma/innstillinger` har sin egen
   `verifiserFirmaAdmin`-vakt på serveren (`organisasjon.ts:334`). Ser noen lenken uten å
   ha tilgang, møter de en side som avviser dem — ikke et hull.
2. **Det matcher paritetssjekklisten**, som er akseptkriteriet: linje 131 og 326 sier begge
   `harFirmaTilgang`. En ekte firmaadmin-gate ville gjort O12 uverifiserbar mot sin egen rad.
3. **Hub-lenken til samme side bruker allerede den formen** (`innstillinger-kort.tsx:234`,
   `synlig: harFirmaTilgang`). To ulike gater til samme destinasjon er den typen
   inkonsistens vi holder på å rydde bort, ikke innføre.

**Si fra hvis du er uenig** — da skriver jeg om ordren med en ekte firmaadmin-gate. Det
haster ikke: ingenting går galt hvis dette svaret kommer etter at runden er levert, siden
serveren gater skrivingen uansett.

## Sidefunn jeg IKKE la i ordren

At de to `harFirmaTilgang`-definisjonene har drevet fra hverandre (`erAdmin` vs.
`erSitedocAdmin`) er en egen sak. Jeg har ført den i BACKLOG i stedet for å utvide O12 —
scope-utvidelse midt i en rotårsaksfiks er nettopp det som gjorde at O12 bare ble halvveis
utført i mai.

## Bonus: ett duplikat mindre enn analysen tror

`navigasjon-arkitektur-analyse-2026-05-03.md` linje 60–61 fører **to** faggruppe-sider som
duplikat. Målt 2026-08-30: `/dashbord/prosjekter/[id]/faggrupper` **finnes ikke lenger** —
det er kun én faggruppe-side igjen. Jeg har merket radene i analysen som løst, med de gamle
linjene synlige.

Det betyr at `oppsett/firma` (O12) er det eneste bekreftede UI-duplikatet vi har nå.
