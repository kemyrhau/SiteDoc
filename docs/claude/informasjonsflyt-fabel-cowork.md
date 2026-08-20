---
name: informasjonsflyt-fabel-cowork
description: STYRENDE — hvordan leveranser fra fabel mottas, verifiseres og gjøres gjeldende. Fabel har ikke skrivetilgang til repoet; alt går via nedlastingsmapper som Kenneth pakker ut.
sist_verifisert_mot_kode: 2026-08-20
sist_endret: 2026-08-20
---

# Informasjonsflyt fabel ↔ cowork

**Grunnvilkåret:** fabel har **ingen skrivetilgang til SiteDoc-mappen**. Han leverer ved å
lage en nedlastingspakke som Kenneth pakker ut manuelt. Alt som går galt i flyten, går galt
her — ikke i innholdet.

## 1 · Hvor leveranser havner

```
~/Documents/Programmering/SiteDoc/Fra fabel/til-repo-<ÅÅÅÅ-MM-DD-TTMM>/
```

Innholdet ligger under `docs/redesign/` i pakken (noen ganger i mappe-rot, f.eks.
`REDESIGN-MASTERPLAN.md`).

**Finn nyeste selv — aldri spør Kenneth hvor den er:**

```bash
ls -dt ~/Documents/Programmering/SiteDoc/"Fra fabel"/til-repo-* | head -4
```

🔴 **`ls -dt`, ikke `ls`.** macOS lager dubletter med « 2»-suffiks når samme pakke lastes
ned på nytt — og **dubletten er den nyeste**. Sortert på navn havner den feil sted.
Målt 2026-08-20: `til-repo-2026-08-20-2200 2` inneholdt rettingen; `til-repo-2026-08-20-2200`
hadde den gamle teksten.

## 2 · Tre feilmoduser, og hvordan de skilles

| Symptom | Årsak | Handling |
|---|---|---|
| Mappa finnes ikke | Ikke lastet ned ennå | Be Kenneth laste ned. **Ikke gjett innholdet** fra fabels sammendrag |
| Mappa finnes, innholdet er gammelt | Dublett med « 2», eller synk-svikt | **Sjekk « 2»-varianten FØR du sier noe.** Finnes den ikke: be fabel lime ordlyden |
| Fabel melder endring, disk er uendret | Redigering lagret hos ham, ikke synket ut | Bruk **den innlimte ordlyden** som autoritativ (se § 3) |

**Ingen av disse skal føre til en anklage om at fabel melder noe som ikke finnes.**
Målingen må skille de tre først.

## 3 · Autoritetsregelen

Fabels leveranser lever i tre tilstander med ulik autoritet:

1. **Ordlyd limt inn i meldingen** — autoritativ ved konflikt. Synk kan svikte; en tekst
   Kenneth har limt inn kan ikke svikte.
2. **Fil i nedlastingsmappen** — gjeldende når den stemmer med (1) eller (1) mangler.
3. **Fil committet i repoet** — **fasit etter commit.** Det er her leveransen «finnes» for
   alle andre enn Kenneth.

**Cowork eier steg 2→3.** En fabel-leveranse som ikke er kopiert inn og committet, finnes
ikke for agentene og overlever ikke neste compact.

## 4 · Coworks plikter ved hver leveranse

1. **Finn nyeste pakke selv** (`ls -dt`, fang « 2»).
2. **Les hele fila**, ikke sammendraget i meldingen.
3. **Gate innholdet mot kode** før relay — fabel oppgir fil:linje, verifiser stikkprøver.
   Særlig: påstander om at noe «finnes», «mangler» eller «kalles fra».
4. **Kopier inn i repoet og commit** — `docs/redesign/`, samme filnavn.
5. **Krysskoble** mot eksisterende saker i `docs/claude/` så ingen bygger to steder.
6. **Relay til agent** først etter at 3 og 4 er gjort.

## 5 · Fabels plikter (avtalt 2026-08-20)

1. **Lim den avgjørende ordlyden i selve meldingen** når en leveranse melder en endring —
   ikke bare stien. To linjer fra ham sparer en runde hver gang synk svikter.
2. **Oppgi kun stier som er sendt** — ikke stier som «skal» sendes.
3. **Ved retting av et eksisterende notat:** si eksplisitt hvilket avsnitt som erstattes, og
   at resten er uendret. Da kan cowork verifisere kirurgisk i stedet for å diffe hele fila.

## 6 · Meldinger tilbake til fabel

Kenneth relayer **hver melding manuelt**. Derfor:

- **Én komplett blokk per melding.** Aldri dryppvis; aldri «se forrige melding».
- Mål ferdig og tenk ferdig før blokken skrives.
- Er noe umålt, merk det eksplisitt som umålt i blokken.

Se også [SAMARBEIDSREGLER § Spørsmål: samle, ikke drypp](SAMARBEIDSREGLER.md).

## 7 · Hva som IKKE er fabels ansvar

Fabel eier design og produktbeslutninger. Han eier **ikke** merge, deploy, branch-hygiene
eller repo-tilstand — det er coworks. En fabel-leveranse er ferdig når designet er avklart;
at den *finnes* i repoet er coworks jobb, og det er ikke gjort før commiten er pushet.
