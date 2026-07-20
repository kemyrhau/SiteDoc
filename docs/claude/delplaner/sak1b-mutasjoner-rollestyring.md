---
name: sak1b-mutasjoner-rollestyring
status: 🟡 ARKITEKTURSAK — reist 2026-07-19, ikke startet. Utsatt bevisst (sak 1 valgte paritet)
eier: fabel (arkitektur) · cowork (måling gjort)
sist_verifisert_mot_kode: 2026-07-19
---

# Sak 1b — bør dokument-mutasjoner rollestyres i det hele tatt?

> Reist av cowork-målingen bak sak 1. Fabel valgte **(a) paritet** der, og (b) ble ført hit fordi den ikke er en N3-oppfølger — den er et arkitekturspørsmål om hele mutasjonslaget. **Skal ikke smugles inn i sak 1.**

## Funnet som reiser spørsmålet (kode-målt 2026-07-19)

Av 11 dokument-mutasjoner har **kun 2** rolle-håndheving:

| Mutasjon | Rolle-vakt |
|---|---|
| `sjekkliste.endreStatus:702` → `verifiserFlytRolle:716` | ✅ |
| `oppgave.endreStatus:888` → `verifiserFlytRolle:905` | ✅ |
| `sjekkliste`: oppdater · oppdaterData · forbedreOversettelse · slett | ❌ |
| `oppgave`: leggTilKommentar · oppdater · oppdaterData · forbedreOversettelse · slett | ❌ |

De 9 uten rolle-vakt har **status-vakter** i stedet («kun utkast», «kun utkast/avbrutt», append-only). Modellen er altså:

> **Hvem** = `verifiserDokumentTilgang` alene · **Når** = status-vakter · **Rolle** = kun på statusoverganger.

**Praktisk betydning i dag:** enhver bruker med dokument-tilgang (faggruppe, gruppe — og fra sak 1 også flyt) kan redigere og slette utkast uavhengig av sin flytrolle. En registrator kan slette et utkast; en utfører kan redigere et annet fags dokument i utkast.

## Spørsmålet

**Er dette riktig, eller er det en governance-luke?**

Argumenter for at det er riktig (dagens modell):
- Status-vaktene begrenser skaden — kun utkast/avbrutt kan røres, ferdigbehandlede dokumenter er låst.
- Tilgang er allerede faggruppe-avgrenset; man rører kun dokumenter i sitt eget arbeidsområde.
- Enkelhet: færre gater å holde konsistente (N3 viste hva som skjer når gater divergerer).

Argumenter for at det er en luke:
- «Slett» er irreversibelt, og ingen rolle kreves — kun status og tilgang.
- Flytrollene (registrator/bestiller/utforer/godkjenner) bærer allerede semantikk om hvem som eier hva; den semantikken ignoreres på 9 av 11 operasjoner.
- Statusoverganger *er* rollestyrt, så modellen er internt inkonsistent — hvorfor gjelder rolle for «send» men ikke for «slett»?

## Hvis (b) velges — omfang

Ikke en tilleggsgren, men en **ny håndhevingsdimensjon** på 9 mutasjoner:
1. Definer hvilke flytroller som eier hvilke mutasjoner (ikke bare statusoverganger) — ny matrise ved siden av `ROLLE_HANDLINGER`.
2. Håndhev per mutasjon.
3. **Treffer dagens faggruppe-brukere like hardt som flyt-medlemmer** — folk som i dag kan redigere/slette utkast vil miste det med mindre rollen deres tillater det. Krever bruker-kommunikasjon, ikke bare kode.
4. Del E-konsekvens: menyen må da også deaktivere skrive-handlinger per rolle, ikke bare statusoverganger.

## Forhold til sak 1
Sak 1 (paritet) gjør **ikke** dette spørsmålet verre — den behandler flyt-medlemmer likt med faggruppe-medlemmer. Velges (b) senere, treffer den begge veier samtidig, som er riktigere enn å rollestyre den ene og ikke den andre.
