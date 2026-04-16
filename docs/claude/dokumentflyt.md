# DOKUMENTFLYT — SiteDoc

## 1. Kjernekonsepter

### Bestiller
Den som opprettet dokumentet. Endres aldri.

### Eier
Den som har overordnet ansvar for at dokumentet blir ferdig. Tilhører alltid faggruppen dokumentet ble opprettet i. Kan byttes av en med rett rettighet (se Rettigheter).

Eier settes automatisk ved mottak:
- Ballen sendes til en person → den personen blir eier
- Ballen sendes til en gruppe → gruppens leder (blå prikk) blir eier

### Nåværende mottaker
Den som har ballen akkurat nå. Endres for hvert steg i flyten.

### Faggruppe
Prosjektdeltaker innen et fag (Elektro, Tømrer, Rør osv.). Definerer hvilke parter som kan motta et dokument innen denne flyten.

### Prosjekteier
HE-Leder eller BH. Avhenger av hvem som eier prosjektet.

### Status
Uavhengig av hvem som eier eller har ballen akkurat nå. Settes manuelt av nåværende mottaker.

### Flytboks
Representerer nåværende mottaker visuelt. Er dynamisk — viser dokumentets bevegelse gjennom flyten. Trenger ikke navn, ettersom faggruppenavnet er selve boksen. Leder i gruppen markeres med blå prikk og mottar ballen automatisk når dokumentet sendes til gruppen.

---

## 2. Dokumenttyper

### Sjekkliste

| Regel | Verdi |
|-------|-------|
| Oppretter | Alle med redigeringsrettigheter |
| Redigerbar | Den som har ballen + admin/registrator alltid |
| Sletting | Kun i kladd av bruker, alltid av admin/registrator |
| Låses | Etter godkjenning — kan gjenåpnes |
| Flyt | Toveis |
| På tvers av faggrupper | Kun admin/registrator/prosjekteier |
| Fremtidig | Per-ledd konfigurasjon, per-medlem rettighet |

### Oppgave

| Regel | Verdi |
|-------|-------|
| Oppretter | Alle med redigeringsrettigheter |
| Redigerbar | Aldri — append-only fra opprettelse |
| Legg til info | Den som har ballen + admin/registrator |
| Sletting | Kun i kladd av bruker |
| Godkjenning/lukk | Admin/registrator i alle flyter, ellers → Ferdig |
| Flyt | Toveis |
| På tvers av faggrupper | Kun admin/registrator/prosjekteier |
| Fremtidig | Per-ledd konfigurasjon, per-medlem rettighet |

Oppgave skilles fra sjekkliste ved opprettelse — de to konverteres ikke til hverandre.

### HMS

| Regel | Verdi |
|-------|-------|
| Oppretter | Alle brukere |
| Flyt | Enveis med automatisk retur: Innsender → HMS-gruppe → (Godkjent) → Innsender |
| Behandling | Kun HMS-gruppe |
| Godkjenning | HMS-gruppe godkjenner, rapport returneres automatisk til innsender |
| Redigerbar | Innsender i kladd/sendt, HMS-gruppe når de har ballen |
| Sletting | Kun i kladd av innsender |
| Admin/registrator | Kan lese alltid, kan legge seg til i HMS-gruppen |
| Fremtidig | Per-ledd konfigurasjon, flere HMS-grupper per prosjekt |

Retursteget til innsender ved godkjenning er automatisk — ikke en manuell sending.

### Godkjenning

| Regel | Verdi |
|-------|-------|
| Oppretter | Kun første flytboks (lengst til venstre) |
| Flyt | Enveis — låst til sin egen dokumentflyt |
| Avvis/send tilbake | Konfigurerbart per mal |
| Synlighet | Kun de i flyten |
| Redigerbar | Per-ledd konfigurasjon (se seksjon 5) |
| Sletting | Kun i kladd av oppretter |
| På tvers av faggrupper | Aldri |
| Fremtidig | Full per-ledd låsbarhet, konfigurerbare godkjenningsregler per mal |

Godkjenning kan aldri:
- Flyttes til en annen faggruppe
- Flyttes til en sjekklisteflyt eller oppgaveflyt
- Slås sammen med en annen godkjenningsflyt

Dokumenter kan refereres som vedlegg på tvers (f.eks. en ferdig Teknisk avklaring kan legges ved et Krav), men selve flyten forblir alltid separat.

---

## 3. Rettigheter

### Rettighetsbasert UI

| | Leser | Redigerer | Admin/Registrator |
|---|---|---|---|
| Ny sjekkliste | – | Redigeringsmodus | Redigeringsmodus |
| Eksisterende sjekkliste | Forhåndsvisning | Redigeringsmodus | Redigeringsmodus |
| Ny oppgave | – | Redigeringsmodus | Redigeringsmodus |
| Eksisterende oppgave | Forhåndsvisning | Forhåndsvisning + legg til nederst | Redigeringsmodus |
| HMS | Forhåndsvisning | Opprett + fyll ut | Lese alltid |
| Godkjenning | Forhåndsvisning (hvis i flyten) | Per-ledd | Per-ledd + overstyr |

### Hvem kan sende på tvers av faggrupper

| Rolle | Sjekkliste/Oppgave | Godkjenning | HMS |
|---|---|---|---|
| Prosjekteier (HE/BH) | ✓ | ✗ | ✗ |
| Registrator / Admin | ✓ | ✗ | ✗ |
| Fag (Elektro, Tømrer osv.) | ✗ | ✗ | ✗ |

### Hvem kan bytte eier

| Rolle | Kan bytte eier |
|---|---|
| Prosjekteier (HE/BH) | ✓ |
| Registrator / Admin | ✓ |
| Fag | ✗ |

### Handlingsknapper basert på posisjon i flyten

**Første/midtre flytboks:**
```
[Send ▾]
  → Faggruppe A (neste i flyten)
  → Send tilbake (hvis ikke første boks)
  → Andre faggrupper (hvis tilgang)
```
Kun én mottaker → send direkte uten dropdown.

**Siste flytboks (godkjenner):**
```
[Godkjenn]  [Avvis]  [Send ▾]
                       → Svar avsender
                       → Andre faggrupper (hvis tilgang)
```

**Admin-seksjon i dropdown:**
Registrator/admin ser alltid en egen seksjon med alle flytbokser og manuelle statusendringer.

**Implementert: kanRedigere per flytledd**
- `DokumentflytMedlem.kanRedigere` (boolean, default `true`) styrer om et flytmedlem kan redigere dokumenter
- Toggle i dokumentflyt-oppsettet: "Redigerer" (default) / "Leser" (amber badge)
- `utledDokumentRettighet()` sjekker `kanRedigere` — `false` → bruker får kun lesevisning selv med ballen
- Admin/registrator upåvirket (alltid full tilgang)

**Fremtidig:**
- Per-person overstyring innad i en gruppe (nå gjelder hele gruppen)

---

## 4. Flytregler

### Grunnprinsipp
Ett dokument reiser mellom mennesker. Én eier av gangen. Prosjekteier/admin er koblingspunktet når et dokument må involvere flere faggrupper (kun for sjekklister/oppgaver).

### Send-modal
Viser kun faggruppenavn — ikke roller eller tekniske termer. Kun faggrupper brukeren har tilgang til vises. Systemet vet selv at lederen (blå prikk) hos den valgte faggruppen mottar dokumentet.

### Eksempel — dokument på tvers av faggrupper

```
Faggruppe 1 (HE ↔ Elektro):
[Elektro] → [HE-Leder]

Faggruppe 2 (HE ↔ Tømrer):
[HE-Leder] → [Tømrer] → [HE-Leder]

Faggruppe 1 (fortsetter):
[HE-Leder] → [Elektro] → [HE-Leder] → lukkes
```

---

## 5. Redigerbarhet (Godkjenning)

Redigerbarhet er ikke en fast egenskap ved dokumenttypen, men en konfigurerbar regel per flytledd i malen.

### Per ledd defineres
- **Kan redigere**: ja / nei
- **Låses etter**: X antall passeringer forbi dette leddet
- **Tillat avvis**: ja / nei (konfigurerbart per mal)
- **Tillat send tilbake**: ja / nei (konfigurerbart per mal)

### Eksempel

| Ledd | Kan redigere | Låses etter |
|---|---|---|
| 1 | ✓ | 2 passeringer |
| 2 | ✓ | aldri |
| 3 | ✓ | 1 passering |
| 4 | ✗ | – |

### Viktig for datamodellen
Flytmal-strukturen må støtte per-ledd-konfigurasjon fra start for alle dokumenttyper, selv om feltene ikke er aktive ennå.

---

## 6. Validering ved opprettelse av faggrupper

Systemet skal advare brukeren når dokumentflyt-oppsett er ugyldig:
- Ingen leder (blå prikk) definert i en gruppe
- Samme gruppe på begge sider av flyten
- Flyt uten mottaker
- Godkjenningsflyt som går på tvers av faggrupper

---

## 7. Fremtidige utvidelser

- **Per-ledd låsbarhet** — `låsesEtterPasseringer` finnes i schema, ikke implementert ennå
- **Per-person rettighet innad i gruppe** — overstyring av kanRedigere per gruppeperson (nå gjelder hele gruppen)
- **Lenking mellom dokumenter** — referanser/vedlegg på tvers av flyter uten at dokumentet reiser
- **Tildeling til person** — leder tildeler dokument til spesifikk ansatt innen faggruppen
- **Varsling** — tildelt person varsles når de får ballen
- **Flytvisualisering i dokumentlisten** — kompakt visuell indikator per rad: `[Elektro] →●→ [HE] → [Tømrer]`
- **Konfigurerbare godkjenningsregler per mal** — avvis, send tilbake, antall nivåer
- **Flere HMS-grupper per prosjekt**
- **Mobilapp handlingsmeny** — portering av ny Send-dropdown og flytindikator til React Native
