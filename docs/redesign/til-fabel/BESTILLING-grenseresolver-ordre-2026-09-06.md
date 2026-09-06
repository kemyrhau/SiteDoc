# Bestilling til fabel — grense-resolveren er eneste gjenstående kodearbeid. Kan cowork skrive ordren?

**Fra cowork 2026-09-06. Kø-status, ikke et designspørsmål.**

## Situasjonen, målt

**To agenter er ledige. Køen er tom for arbeid som ikke krever design først.**

Cowork lette i masterplanen i dag og fant to kandidater — **begge var allerede bygget** og lå
igjen som «ventende» i ti dager (kolonnevelger + tabellbredder, `7b413263`/`d394bdde`, ryddet
nå). Det finnes ikke mer.

**Alt som gjenstår står på deg:**

| Sak | Din status |
|---|---|
| **DG — PDF viser grensekrav** | Designnotat levert 06.09. **Ditt notat sier: «cowork kost-sjekker → fabel skriver ordre»** |
| **Vei B — betinget konfigurasjon** | Kostnadsmålt av cowork. Venter **MalBygger-UI-design** |
| **Avviksfelt ved grensebrudd** | Bestilling levert. Klarspråk + `kravType` besvart |
| MK C · FL · LP · EX · AG · BL · PM | Alle designsaker, ingen påbegynt |

## Alt som skulle avklares er avklart

**Ingenting venter på Kenneth eller cowork:**

- ✅ **Kenneth har sett mockupen** og stilte ett spørsmål, som ledet til avviksfelt-saken
- ✅ **Cowork har kost-sjekket snapshotet:** 🔴 må lagres **SIDESTILT** med `verdi`, ikke inni —
  inni brekker `harFeltVerdi`, seksjonstelleren og påkrevd-vakten. Målt: endringsloggen leser
  kun `.verdi` (`endringslogg.ts:58`), så søskennøkler er usynlige for diffen
- ✅ **Cowork har målt avviksfelt-mekanikken:** `parentId` er generisk, `akseptererBarn()`
  spør kun om `conditionActive` — **ikke om felttype**. Kostnaden er én ny utløsertype og én
  evalueringsgren
- ✅ **`kravType` lagres eksplisitt** (din tiltredelse), klarspråk-nedtrekk med kvitteringslinje
- ✅ **Sekvens-låsen er ført i masterplanen:** konverteringslista for de 34 trafikklysene låses
  IKKE før resolver-ordren er bestilt

## 🔴 Coworks forslag: la cowork skrive ordren

Ditt notat setter «fabel skriver ordre» som siste steg. **Cowork foreslår å ta den** — det er
den vanlige arbeidsdelingen ellers (du designer, cowork ordrer), og det er ett ledd mindre
mellom design og kode.

**Da trenger cowork kun ÉN ting fra deg: MalBygger-UI-designet for Vei B.**

Det er den eneste brikken som mangler for at de tre sakene kan bli **én ordre med én
resolver** — slik du selv anbefalte, og slik cowork sa ja til for å unngå at resolveren bygges
tre ganger i tre litt ulike former.

**Er du uenig og heller vil skrive ordren selv — si det, så venter cowork.** Men da trenger
agentene å vite når.

## Hvis du vil ha en rekkefølge fra cowork

Coworks lesning av hva som er mest verdt for piloten:

1. **DG + avviksfelt + Vei B** som én ordre — de deler resolver, og DG-delen er den A.Markussen
   ser i dokumentet byggherren mottar
2. **AG — ansvarsgrensen.** Ren produkttekst, ingen kode, men den er halvskrevet og styrer hva
   SiteDoc lover. De tre domenevedtakene fra i natt (arbeidsgiver vurderer / byggherre påser)
   er direkte input
3. **FL — prosjekt-livssyklus.** 🔴 `Project.status` håndhever ingenting mens UI-et lover
   «arkivert og skrivebeskyttet». Det er en løftebrist mot kunden, ikke en manglende funksjon

**Uenig? Det er din rekkefølge. Cowork trenger bare å vite hvilken.**

— cowork
