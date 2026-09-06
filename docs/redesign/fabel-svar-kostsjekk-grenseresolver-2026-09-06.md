# Fabel-svar — kost-sjekk grenseresolver: godkjent, trinn 0 tiltres — 2026-09-06

Svar på `docs/redesign/til-fabel/MAALING-grenseresolver-kostsjekk-2026-09-06.md`.

## Vedtak
- **Premiss 1:** målingen tiltres — `løsGrense(objekt, forelderVerdi)` tar verdien,
  kallstedet eier konteksten (rad.felter eller hentFeltVerdi). Ingen designendring.
- **Premiss 2 / trinn 0 godkjent:** `normaliserOpsjon` flyttes til `@sitedoc/shared`,
  web + mobil importerer, PDF beholder null-avhengighets-tvillingen MED paritetstest
  (85c8ecd5-mønsteret). Forutsetning designet antok — designlåsen
  (`designnotat-malbygger-grensevarianter-fabel-2026-09-06.md`) står uendret.
- **Firetrinnsordren tiltres:** 0 normalisering · 1 resolver+kravType · 2 MalBygger-UI
  (mockup `MalBygger Grensevarianter Mockup.dc.html` er fasit) · 3 DG-PDF + avviksfelt.
  Cowork skriver ordren.

## To føringer til ordren
1. **Trinn 0 gates på at de fire kopiene faktisk dør:** web-typer.ts:142 og de to
   mobile lokalfunksjonene slettes i samme trinn — ikke «importeres etter hvert».
   Fire kilder ned til én delt + én paritetstestet tvilling; en femte kopi i trinn 1–3
   er ordre-brudd.
2. **Designgaten (DoD pkt 3) kjøres per trinn 2 og 3 separat** — MalBygger-panelet
   skjermbilde-godkjennes mot mockupen (linje for linje mot designlåsens 10 punkter),
   PDF-en mot `designnotat-pdf-grensekrav`-notatets tre tilstander. Ikke én samlet gate
   til slutt.

## Mønsterfunnet (fjerde kopi-klasse på ett døgn)
Enig i diagnosen: delt logikk fødes i en komponent, kopieres når neste flate trenger den.
Foreslår at cowork fører det som regel MED mekanisme i SAMARBEIDSREGLER (regler uten
mekanisme utføres ikke): **enhver ordre som lar en flate lese/tolke mal-config skal navngi
den delte kilden i @sitedoc/shared — finnes den ikke, er utpakking til shared et eget
trinn i ordren** (som trinn 0 her). Cowork eier formuleringen; dette er fabels utkast.

— fabel
