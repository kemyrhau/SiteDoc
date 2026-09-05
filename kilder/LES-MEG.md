# `kilder/` — kildedokumenter agenter leser fra, aldri kopierer

**Opprettet 2026-09-05.** Denne fila er det eneste i mappa som versjoneres.

## Hva som ligger her

Opphavsrettsbeskyttede standarder og forskrifter Kenneth har lovlig tilgang til, lagt her så en
agent kan **lese** dem når den bygger sjekklistemaler.

```
kilder/ns3420/     NS 3420-delene som PDF (A, CD, D, F, GU, J, K, L, Z, 1)
```

## 🔴 Ufravikelig: innholdet skal ALDRI i git

`.gitignore` ekskluderer `kilder/*` med unntak av denne fila. **Ikke overstyr det.** Sjekk før du
committer i nærheten:

```sh
git status --short kilder/     # skal kun vise LES-MEG.md, aldri en PDF
```

Legger noen en PDF i git, har vi laget den kopien vi uttrykkelig ikke skal lage.

## 🔴 Grensen når du bygger maler (Kenneth-vedtak 2026-09-05)

> *«Vi skal bygge våre egne sjekklister basert på NS 3420. Om jeg gjør det manuelt eller en agent
> gjør det for meg er det samme. Vi lager ikke en kopi av NS 3420.»*

En sjekkliste som **kontrollerer mot** et krav er vårt eget verk. En som **gjengir kravteksten**
er en kopi.

| ✅ Lov | ❌ Ikke lov |
|---|---|
| «Kontroller at jordblanding tilfredsstiller NS 3420-K **KB2.1**» + felt for måling og avvik | Lime inn kravtekst, tabeller eller toleranseverdier ordrett |
| Referere til punktkode som kilde | Gjengi standarden slik at malen erstatter den |
| Egne kontrollpunkter utledet av hva kravet faktisk krever | Kopiere overskrifter og struktur ordrett som malinnhold |

**Prøven:** kan en bruker droppe å kjøpe standarden fordi malen vår gjengir den? Da har vi gått
for langt. Malen skal si *hva som skal kontrolleres*, ikke *hva standarden sier*.

## Hvorfor mappa finnes — og hvorfor ikke embeddings

NS 3420 er vektorisert i `sitedoc_test` (1 171 chunks, ti dokumenter, målt 05.09). **Embeddings er
bygget for brukerens søk i appen** — «finn noe om komprimering» — ikke for at en agent skal arbeide
seg systematisk gjennom et kapittel.

Malbygging er den andre typen: kapittel for kapittel, post for post. Da er hele teksten riktig
verktøy, ikke semantisk oppslag. Derfor leser agenten herfra i stedet for å slå opp i databasen.

⚠️ **Trenger en oppgave likevel søk på tvers av kapitler**, ligger embeddingene i `sitedoc_test` —
se [STATUS-AKTUELT § malverkstedet](../docs/claude/STATUS-AKTUELT.md).

## Merknad om dubletten

`NS 3420 Del K Anleggsgartnerarbeider.pdf` finnes i to versjoner i test-basen; den ene har 0
chunks. Legger du filer her, ta med **én** kopi per del så ingen leser feil versjon.
