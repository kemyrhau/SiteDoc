# Velger-gruppering v2 — Visuell spec: to-nivå-overskrift (faggruppe → dokumentflyt)

> Fra fabel, 2026-08-04. Bygger på Funn C-speccen (`funn-c-opprett-velger-interaksjons-spec.md`) —
> INTERAKSJONEN ER UENDRET (markør, ↑/↓ flatt over alle gruppegrenser, Enter/«Opprett», Esc,
> «Sist brukt»-etikett, klikk = velg+bekreft). Kun visuell gruppering/sortering legges til.
> Kenneths struktur-vedtak: faggruppe → dokumentflyt, header alltid synlig, prefiks-sort, begge flater.

## 1. Hierarki (tre nivåer i lista)

```
FAGGRUPPE-SEKSJON        ← nivå 1
  Dokumentflyt-undergruppe   ← nivå 2
    Mal-rad                    ← nivå 3 (fokuserbar, uendret fra Funn C)
    Mal-rad
  Dokumentflyt-undergruppe
    Mal-rad
FAGGRUPPE-SEKSJON
  ...
Utilgjengelige (footer)   ← uendret, alltid nederst, utenfor grupperingen
```

## 2. Nivå 1 — faggruppe-seksjon

- **Typografi:** VERSALER, liten grad (12–13px), medium/semibold vekt, sekundær tekstfarge (samme «overline»-mønster som appens seksjonsoverskrifter ellers — gjenbruk om det finnes en stående stil).
- **Ingen innrykk** (flukter med modalens venstremarg).
- **Luft:** markert topp-margin foran hver ny seksjon (ca. dobbel rad-gap), stram mot innholdet under — seksjonsskillet skal bæres av luft + versaler, ikke skillelinjer eller bakgrunnsflater.
- Ikke fokuserbar, ikke klikkbar (som i dag).

## 3. Nivå 2 — dokumentflyt-undergruppe

- **Gjenbruk dagens `VelgerGruppe.overskrift`-stil som utgangspunkt**, justert til under-nivå: normal store/små bokstaver, regular/medium vekt, samme grad som mal-radenes primærtekst eller ett hakk under (13–14px), sekundær farge.
- **Lett innrykk** (samme innrykk som mal-radene, eller ett lite hakk mindre) — innrykket + svakere vekt gjør nivåforskjellen lesbar uten linjer.
- Dagens faggruppe-undertekst i `overskrift` **fjernes** — faggruppen står nå som egen nivå 1-seksjon; duplisering i undergruppa er støy.
- Ikke fokuserbar.

## 4. Nivå 3 — mal-rader

- Uendret fra Funn C: selected-stil (primær venstre-innramming + tint), «Sist brukt»-etikett, hover som egen svakere tilstand.
- **Innrykk:** rader ligger under flyt-overskriften med samme eller ett hakk større innrykk enn nivå 2 — maks to synlige innrykksnivåer totalt; ikke trappetrinn.

## 5. Header alltid synlig

- Begge nivåer rendres **alltid**, også ved én faggruppe / én flyt / én mal — brukeren skal alltid se hvilken faggruppe+flyt malen tilhører (Kenneths vedtak 1).
- Unntak: auto-hopp-tilfellet (nøyaktig 1 opprettbar mal totalt) åpner fortsatt ingen velger — regelen fra Funn C pkt 0 står.

## 6. Sortering

- **Faggruppe-seksjoner:** alfabetisk på faggruppenavn.
- **Flyt-undergrupper innen faggruppe:** alfabetisk på flytnavn.
- **Mal-rader innen flyt:** på PREFIKS (Kenneths vedtak 3) — naturlig/numerisk sammenlikning så «KB2-010» < «KB2-100» og prefiks uten nummer sorterer alfabetisk. Maler uten prefiks nederst i sin gruppe, alfabetisk.
- Sortering er deterministisk og lik begge flater — sist-brukt påvirker ALDRI rekkefølgen (kun markørens startposisjon + etikett).

## 7. Markør + scroll i gruppert liste (presisering, ikke endring)

- ↑/↓ hopper flatt over ALLE overskrifter (begge nivåer), ingen wrap — som Funn C pkt 2.
- Ved åpning scrolles sist-brukte rad synlig **inkludert sine to overskrifter** når mulig (så konteksten er lesbar), uten scrollIntoView-hopp midt i lista om alt allerede er synlig.

## 8. Scope + footer

- Identisk i sjekkliste OG oppgave (oppgave var flat i Funn C — får nå samme to-nivå-gruppering). Mobil arver samme struktur.
- Tom/utilgjengelig-seksjonen (`footer`) beholdes nederst, UTENFOR faggruppe-grupperingen, med dagens stil.

## 9. Regresjons-fasit (tillegg til Funn C-fasiten, som fortsatt gjelder)

1. Én faggruppe + én flyt + 2 maler → begge overskrifter synlige over radene.
2. To faggrupper à to flyter → ↓ fra siste rad i faggruppe A/flyt 2 lander på første rad i faggruppe B/flyt 1 (hopper over to overskrifter i ett trykk).
3. Prefiks-sort: «KB2-010» før «KB2-100»; mal uten prefiks nederst.
4. Sist-brukt i faggruppe B → åpning scroller B synlig m/ begge overskrifter, markør på malen.
5. Oppgave-velgeren viser samme gruppering som sjekkliste (ikke lenger flat).
