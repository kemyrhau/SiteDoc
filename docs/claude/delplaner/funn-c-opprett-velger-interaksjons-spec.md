# Funn C — Interaksjons-spec: unifisert opprett-velger (sjekkliste + oppgave)

> Fra fabel, 2026-08-03. Konsept vedtatt av Kenneth: velgeren åpnes ALLTID ved >1 opprettbar mal,
> sist-brukt auto-valgt med flyttbar markør. Denne speccen definerer interaksjonen. Opus implementerer.

## 0. Åpne-regel (begge flater, identisk)

- **0 opprettbare maler** → ingen velger; opprett-knapp deaktivert m/ forklaring (pkt 0-filteret gjelder).
- **Nøyaktig 1 opprettbar mal** → auto-hopp rett til opprettelse (dagens sjekkliste-oppførsel beholdes, oppgave harmoniseres).
- **>1 opprettbar mal** → velgeren åpnes ALLTID. Aldri stille auto-opprett fra sist-brukt-nøkkel (det var fella).

## 1. Markør / auto-valg

- Ved åpning står **markøren på sist-brukte mal** (finnes ingen sist-brukt → første rad).
- Markert rad: **primærfarge venstre-innramming + svak primær-tint bakgrunn** (samme uthevingsmønster som aktiv rad ellers i appen — gjenbruk eksisterende selected-stil i velger-modalen, ikke ny stil).
- Sist-brukte rad bærer i tillegg en diskret etikett **«Sist brukt»** (sekundærtekst, høyrestilt i raden). Etiketten følger MALEN, ikke markøren — flyttes markøren, står etiketten igjen der den var.
- Kun ÉN markør. Hover flytter ikke markøren (hover er egen, svakere tilstand); klikk på en rad flytter markøren dit OG bekrefter (= ett trykk oppretter, som i dag).

## 2. Tastatur

- **↑ / ↓** flytter markøren én rad. Stopper på endene (ingen wrap) — forutsigbart i grupperte lister.
- **Enter** oppretter markert mal. Hurtig-stien er dermed bevart: åpne → Enter = sist-brukt.
- **Esc** lukker uten å opprette.
- I gruppert liste (sjekklistens flyt-overskrifter): markøren hopper **flatt over gruppegrensene** — overskrifter er ikke fokuserbare, ↓ fra siste rad i gruppe A lander på første rad i gruppe B.
- Fokus ligger på lista ved åpning (så ↑/↓/Enter virker umiddelbart uten ekstra tab).

## 3. Bekreft-affordance

- **Både Enter OG synlig primærknapp «Opprett»** nederst i modalen (deaktivert-tilstand finnes ikke — markøren står alltid på en rad). Touch/mus-brukere trenger den synlige knappen; Enter dekker tastatur.
- Knappteksten er **«Opprett»** (ikke «Opprett [malnavn]» — malnavnet står alt uthevet i lista; kort knapp).
- Klikk på rad = velg + bekreft i ett (pkt 1). «Opprett»-knappen er altså primært for tastatur-løse brukere som vil se valget før de bekrefter — begge veier er lovlige.

## 4. Scope + sist-brukt-nøkkel (harmonisering)

- **Én interaksjon, begge flater:** sjekkliste (`sjekklister/page.tsx`) og oppgave (`oppgaver/page.tsx setVisModal`) bruker identisk velger-oppførsel per pkt 0–3. Mobil arver samme regler (samme opprett-modell).
- **Sist-brukt-nøkkel: per prosjekt + dokumenttype** (én for sjekkliste, én for oppgave). Sjekklistens per-flyt-nøkkel erstattes: i flyt-gruppert liste lander markøren på sist-brukte MAL uansett hvilken gruppe den ligger i (lista scroller den synlig ved åpning).
  - *Flagget nyanse:* per-flyt sist-brukt ga marginal presisjon, men to ulike nøkkel-modeller var nettopp det som skapte Funn C. Én nøkkel per flate = forutsigbart. Om felt-piloten viser savn av per-flyt-minne, kan nøkkelen utvides senere uten interaksjonsendring.
- **Gruppering:** sjekkliste beholder flyt-overskrifter; oppgave-lista forblir flat inntil faggruppe-grupperingen (mobil kontekst-sporet) lander — velger-interaksjonen er uavhengig av grupperingen.

## 5. Regresjons-fasit (til ordren)

1. Prosjekt m/ 2+ oppgave-maler, én tidligere opprettet → «Ny oppgave» åpner velger m/ markør på sist-brukt; ↓ + Enter oppretter den ANDRE malen («KS avvik»-casen).
2. Åpne → Enter oppretter sist-brukt (hurtig-sti).
3. Nøyaktig 1 opprettbar mal → ingen velger, rett til opprettelse.
4. Sjekkliste: markør krysser flyt-gruppegrense med ↓, Enter oppretter på tvers av gruppe.
5. Esc lukker uten opprettelse; ingen sist-brukt-nøkkel skrives før faktisk opprettelse.
