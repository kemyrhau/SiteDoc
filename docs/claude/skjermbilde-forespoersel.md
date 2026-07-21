---
name: skjermbilde-forespoersel
status: 🟢 STYRENDE — krav til hvordan en Opus ber Kenneth om skjermbilder
eier: Kenneth (kravet) · cowork (håndhevelse i ordrer)
sist_verifisert_mot_kode: 2026-07-21
---

# Skjermbilde-forespørsel — hvordan be Kenneth om visuell verifisering

> **Kenneth 2026-07-21:** *«Da må instruksjonene være presise slik redesign-Opus gjorde det. Jeg har tidligere fått veiledere som er mer til forvirring enn praktisk bruk. Hvis jeg må bruke masse ressurser på å prøve å finne riktig side, er det også ressurs- og tidkrevende.»*

**Manuell fangst er nå hovedveien.** Browser-automatisering kostet 12+ mislykkede forsøk 2026-07-21; Kenneths manuelle runde virket umiddelbart. Regn med at han tar bildene.

## Kravet — fire ting, hver gang

| # | Krav | Hvorfor |
|---|---|---|
| 1 | **Limbar URL, komplett** | Kenneth skal ikke navigere seg fram. `test.sitedoc.no/dashbord/firma/hms?nyNav=1`, ikke «firma-HMS-siden» |
| 2 | **Nummererte steg i rekkefølge** | Han utfører ovenfra og ned uten å velge selv |
| 3 | **Nøyaktig hva som klikkes** | «Klikk chippen (venstre del, **ikke** ⇄)» — ikke «åpne velgeren» |
| 4 | **Hva som forventes i hvert bilde** | Da kan han se avvik selv, uten å vente på analyse. Det gjør fangsten til verifisering, ikke fotografering |

**Oppgi alltid antall bilder øverst**, så han vet omfanget før han starter.

## Mal

```
Fem bilder, alle på test.sitedoc.no:

1. test.sitedoc.no/dashbord/firma/hms?nyNav=1
   Forventet: amber chip «{Firma} ▾ | ⇄», amber tone bak overskriften, INGEN prosjektnavn i topplinja

2. Klikk chippen (venstre del, ikke ⇄) → popover åpner
   Forventet: firmanavn øverst i popoveren

3. Klikk ⇄ på chippen
   Forventet: hopper til prosjekt-HMS, blå chip, blå tone, firmaprefiks borte

4. Klikk ⇄ igjen
   Forventet: tilbake til firma-HMS

5. Samme side med ?nyNav=0
   Forventet: tonen bak overskriften står fortsatt, chippen er borte
```

## Dette gjør en forespørsel ubrukelig

- **Ingen URL** — «gå til HMS-siden» finnes to steder, og det er nettopp forvekslingen som testes
- **Beskrivelse av UI i stedet for handling** — «verifiser at nivåsignalet er tydelig» er ikke et steg
- **Ingen forventning** — da er Kenneth en kamera-operatør, ikke en verifisør
- **Ukjent omfang** — «ta noen bilder» kan bety tre eller tretti

## Gjelder også

Samme krav ved forespørsel om **klikk-testing** (ledd 5) og **prod-verifisering**. Kenneth skal alltid vite: hvilken URL, hvilket klikk, hva som forventes, hvor mange steg.

**Cowork håndhever dette** i hver ordre som har visuell verifisering i DoD.
