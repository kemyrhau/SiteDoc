# DOKUMENTFLYT — SiteDoc

## 1. Kjernekonsepter

### Bestiller
Den som opprettet dokumentet. Endres aldri.

### Eier
Den som har overordnet ansvar for at dokumentet blir ferdig. Tilhører alltid entreprisen dokumentet ble opprettet i. Kan byttes av en med rett rettighet (se Rettigheter).

### Nåværende mottaker
Den som har ballen akkurat nå. Endres for hvert steg i flyten.

### Entreprise
Kontraktsforholdet mellom prosjekteier og et fag (Elektro, Tømrer, Rør osv.). Definerer hvilke parter som kan motta et dokument innen denne flyten.

### Prosjekteier
HE-Leder eller BH. Avhenger av hvem som eier prosjektet.

### Status
Uavhengig av hvem som eier eller har ballen akkurat nå. Settes manuelt av nåværende mottaker.

### Flytboks
Representerer nåværende mottaker visuelt. Er dynamisk — viser dokumentets bevegelse gjennom flyten. Trenger ikke navn, ettersom gruppe- eller personnavnet er selve boksen.

---

## 2. Dokumenttyper

### Sjekkliste
- Kan redigeres og slettes
- Fleksibel toveis flyt
- Kan flyttes på tvers av entrepriser av prosjekteier eller registrator/admin

### Oppgave
- Append-only fra opprettelse — ingenting kan endres eller slettes, kun tilføyd
- Fleksibel toveis flyt
- Kan flyttes på tvers av entrepriser av prosjekteier eller registrator/admin
- Skilles fra sjekkliste ved opprettelse — de to konverteres ikke til hverandre

### Godkjenning
- Kan redigeres (med konfigurerbare begrensninger per ledd — se Redigerbarhet)
- Låst til sin egen dokumentflyt. Kan aldri:
  - Flyttes til en annen entreprise
  - Flyttes til en sjekklisteflyt eller oppgaveflyt
  - Slås sammen med en annen godkjenningsflyt
- Finnes i ulike maler: Krav, Varsel, Teknisk avklaring osv.
- Dokumenter kan refereres som vedlegg på tvers (f.eks. en ferdig Teknisk avklaring kan legges ved et Krav), men selve flyten forblir alltid separat

---

## 3. Flytregler

### Grunnprinsipp
Ett dokument reiser mellom mennesker. Én eier av gangen. HE-Leder er koblingspunktet når et dokument må involvere flere entrepriser (kun for sjekklister/oppgaver).

### Eksempel — dokument på tvers av entrepriser

```
Entreprise 1 (HE ↔ Elektro):
[Elektro] → [HE-Leder]

Entreprise 2 (HE ↔ Tømrer):
[HE-Leder] → [Tømrer] → [HE-Leder]

Entreprise 1 (fortsetter):
[HE-Leder] → [Elektro] → [HE-Leder] → lukkes
```

HE-Leder mottar dokumentet fra Elektro, sender det manuelt videre til Tømrer i en ny entreprise-kontekst, og styrer når det kommer tilbake og til hvem.

### Hvem kan sende på tvers av entrepriser

| Rolle | Sjekkliste/Oppgave | Godkjenning |
|---|---|---|
| Prosjekteier (HE/BH) | ✓ | ✗ |
| Registrator / Admin | ✓ | ✗ |
| Fag (Elektro, Tømrer osv.) | ✗ | ✗ |

### Hvem kan bytte eier

| Rolle | Kan bytte eier |
|---|---|
| Prosjekteier (HE/BH) | ✓ |
| Registrator / Admin | ✓ |
| Fag | ✗ |

---

## 4. Redigerbarhet (Godkjenning)

Redigerbarhet er ikke en fast egenskap ved dokumenttypen, men en konfigurerbar regel per flytledd i malen.

### Per ledd defineres
- **Kan redigere**: ja / nei
- **Låses etter**: X antall passeringer forbi dette leddet

### Eksempel

| Ledd | Kan redigere | Låses etter |
|---|---|---|
| 1 | ✓ | 2 passeringer |
| 2 | ✓ | aldri |
| 3 | ✓ | 1 passering |
| 4 | ✗ | – |

### Viktig for datamodellen
Flytmal-strukturen må støtte per-ledd-konfigurasjon fra start, selv om feltene ikke er aktive ennå. Dette forhindrer stor refaktorering når funksjonaliteten utvides.

---

## 5. Fremtidige utvidelser

- **Per-ledd låsbarhet** — fullt konfigurerbart i flytmal-oppsett
- **Lenking mellom dokumenter** — referanser/vedlegg på tvers av flyter uten at dokumentet reiser
- **Tildeling til person** — HE-Leder tildeler dokument til spesifikk ansatt innen en entreprise
- **Varsling** — tildelt person varsles når de får ballen
- **Flytvisualisering i dokumentlisten** — kompakt visuell indikator per rad i listen som viser hvor dokumentet befinner seg i flyten akkurat nå, uten å åpne dokumentet. F.eks. `[Elektro] →●→ [HE] → [Tømrer]`. Ikke ment som animasjon per dokument — tidslinje-snapshots inne i dokumentet dekker det behovet.
