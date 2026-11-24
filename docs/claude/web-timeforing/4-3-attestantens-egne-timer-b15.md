> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.3. Seksjonsnumrene er de samme som før delingen.

### 4.3 Attestantens egne timer (B15) — firmavalg

**Kenneth:** *«leder bør attestere attestants timer dersom denne har timelønn. dette bør være et firmavalg i
firmainstillinger.»*

**Målt (WM85–WM92):**
- Systemet vet ikke hvem som har timelønn. Det finnes bare som navn på en lønnsart (WM85, WM86).
- Systemet vet ikke hvem som er noens leder (WM87).
- Ingenting hindrer en attestant i å attestere eller rette egne timer i dag (WM89).
- En ubrukt innstilling for selv-attestering finnes i firmainnstillingene (WM90).

Fordi modellen mangler både «timelønn» og «leder», går fem spørsmål til Kenneth: B16–B20 (§ 8). Forslaget under
bruker de anbefalte svarene.

| Del | Forslag | Spørsmål |
|---|---|---|
| **Firmavalget** | Firma → Innstillinger, ved «Rediger ved attestering»: **«Attestant kan attestere egne timer»** — «Ja» eller «Nei». «Ja» er som i dag. Lagres i kolonnen som finnes (`tillattSelvAttestering`, WM90). | B19 (standardverdi) |
| **Hvem regelen treffer** | Sedler der den som attesterer, selv eier sedelen og har lønnsformen timelønn. Lønnsformen er et nytt felt på den ansatte: «Timelønn» eller «Fastlønn». Innstillingssiden viser firmaets attestanter med lønnsformen, så firmaadministratoren ser hvem valget treffer og kan rette det der. | B17 |
| **Hvem som attesterer i stedet** | Alle andre som har attesteringsrett på raden (WM88): en annen prosjektleder på prosjektet, eller en firmaadministrator. | B16 |
| **Hva som sperres på egne sedler** | ✓, ↩, ↺, penn, ✂, «Del opp», bytte av underprosjekt og retting i celle. Sedelen vises fortsatt i lista, med merket «Egne timer» og forklaringen «Egne timer attesteres av en annen». Registreringen kan åpnes og leses. Egne rettinger gjøres i Mine timer, som for andre ansatte. | B18 |
| **Ingen andre kan attestere** | Timene blir stående som «Venter». Innstillingssiden advarer når valget slås på og en attestant står uten noen andre. Ingen automatisk unntak. | B20 |
| **Serveren** | Sperren håndheves i de elleve prosedyrene (WM89). De tre listene sender et flagg pr. seddel, så PC og telefon skjuler knappene uten å kjenne innstillingen (WM91). Telefonen trenger ingen lokal kolonne (WM92). | — |
| **«Attester utvalget»** | Hopper over egne linjer og melder hvor mange som ble stående. Mekanismen finnes for sperrede linjer (WM91). | — |

**Trengs ny kolonne (migrering, Kenneth)?** Det avhenger av svarene:

| Svar | Ny kolonne | Hvor |
|---|---|---|
| B17 A — lønnsform på den ansatte (anbefalt) | Ja: lønnsform på ansettelsen | `packages/db`. Kan gå i samme migrering som B5 (w6; ⚠️ begge er utgått, og B17 er utsatt, § 8.4). |
| B17 B — valget gjelder alle attestanter | Nei | Firmavalget bruker kolonnen som finnes. |
| B17 C — merke på lønnsarten | Ja | `packages/db-timer`. Egen migrering. |
| B16 C eller D — navngitt leder, eller leder på avdelingen | Ja | `packages/db` |

**Følge, si fra hvis du mente noe annet:** kolonnen `tillattSelvAttestering` ble lagt inn for en annen plan — at en
vanlig ansatt uten attesteringsrett kunne attestere egen seddel (`timer.md:453`). Den er ikke bygget. Tas kolonnen i
bruk for B15, bygges den planen ikke med dette, og `timer.md` rettes i ordren.
