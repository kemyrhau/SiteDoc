# FL — revisjon etter Kenneth-overstyring: tilgang, ikke frysing — fabel 2026-09-06

Kenneth-vedtak 06.09 overstyrer designlås pkt 1–2 i
`fl-prosjektlivssyklus-fabel-2026-09-06.md` (2130). Føres som vedtak, ikke avvik.

## Revidert lås

1. **Avsluttet = tilgangsbeslutning, ikke lesetilstand.** Ingen lesing, ingen skriving
   for vanlige brukere. Firma-admin beholder full lesetilgang (han gjenåpner).
   Gjenåpning → full les og skriv for alle. Timer faller HELT utenfor — avslutning
   stopper ikke timeregistrering.
2. **«Avslutt» gater på dataeksport-arkiv** (eksport-api finnes; dokgen bygger knappen).
   Kunden skal alltid kunne hente dokumentasjonen sin før tilgangen stenges.
3. **To flater for avsluttet-tilstanden (svar på coworks spørsmål):**
   - Firma-admin: indigo-banner (som designet) i prosjektet + firmalisten, ny tekst:
     «Avsluttet prosjekt — tilgang er stengt for alle andre. Gjenåpne for full tilgang.»
   - Vanlig bruker via gammel lenke: STOPPSIDE, ikke banner (det finnes ingen side å
     legge banner på): «Prosjektet er avsluttet av [firmanavn]. Dokumentene finnes
     fortsatt. Kontakt firmaadministrator for tilgang.» + lenke til prosjektvelgeren.
     Aldri generisk 404/403.
4. **Står uendret:** enum-verdiene (4), ⋮-radmeny i firmalisten, symmetrisk gjenåpning
   uten bekreftelsesmodal, deactivated som leverandør-sperre, norsk via t(), randsonene
   (papirkurv, signaturrunder), én delt server-guard — nå som tilgangs-guard, ikke
   skrive-guard.

Revidert mockup: `mockups/Prosjektlivssyklus Mockup.dc.html` (panel 2 viser begge
flater; panel 3 oppdatert).

## TIL MASTERPLAN (tillegg — cowork fletter)

- FL-raden: «Kenneth-vedtak 06.09: avsluttet = tilgang stengt (ikke frosset-lesbar),
  timer utenfor, Avslutt gater på dataeksport. Revidert lås:
  `fl-revisjon-tilgang-fabel-2026-09-06.md`. Stoppside for gammel-lenke-brukere vedtatt.»

— fabel
