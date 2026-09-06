# Til fabel — firmanivået mangler styringen modellen lover (to funn, samme rot)

**Fra:** cowork · **Dato:** 2026-08-30 · **Kilde:** Kenneths gjennomgang av test etter deploy `24bccbba`
**Status:** målt mot kode, ikke besluttet. Ingen ordre skrevet.

## Sammendrag

To funn fra samme kveld peker på det samme: **`terminologi.md § 0` sier firmaet eier
prosjektene sine, men firmaflaten kan verken starte dem eller avslutte dem.**
Sitedoc-admin kan; firmaet kan ikke. Det er ikke en manglende knapp — det er at nivået
mangler myndigheten sin.

---

## Funn 1 — firmaet kan ikke styre livssyklusen til egne prosjekter

**Kenneth 2026-08-30:** *«/dashbord/firma/prosjekter → denne siden kan ikke aktivere og
deaktivere et prosjekt → ei heller ikke avslutte prosjekt.»*

**Målt:**

| Lag | Hva som finnes | Fil |
|---|---|---|
| DB | `Project.status String @default("active")` | `schema.prisma:584` |
| API | godtar **fire** verdier: `active` · `archived` · `completed` · `deactivated` | `prosjekt.ts:606` |
| Prosjektoppsett (i prosjektet) | tilbyr **tre**: aktiv, fullført, arkivert | `oppsett/prosjektoppsett/page.tsx:35-60` |
| Firma-prosjektliste | **kun visning**, ingen handling | `firma/prosjekter/page.tsx:144-149` |
| Sitedoc-admin | kan sette `deactivated` | `admin/prosjekter/page.tsx:307-311` |

🔴 **`deactivated` er ikke tilgjengelig for kunden i det hele tatt.** Serveren tar imot den,
`[prosjektId]/page.tsx:64` leser den (`erDeaktivert`), men den kan bare settes fra
sitedoc-admin. Et firma som vil fryse et prosjekt må be oss om det.

🔴 **Statusen vises på engelsk.** `firma/prosjekter/page.tsx:149` er
`p.status === "active" ? "Aktiv" : p.status` — alt annet enn aktiv rendres rått, så kunden
ser «archived» og «completed». Ikke gjennom `t()`.

**Og livssyklusen er per prosjekt, én om gangen, innenfra.** Vil et firma arkivere fem
avsluttede prosjekter, må de åpne hvert enkelt, gå til Prosjektoppsett, velge status, lagre.
Firmalisten — den eneste flaten som ser alle fem samtidig — kan ikke gjøre noe.

**Spørsmål til deg:** hører livssyklusen hjemme i firmalisten (handling per rad, evt.
flervalg), i prosjektoppsettet der den står i dag, eller begge steder? Og skal `deactivated`
i det hele tatt være en kundekontroll, eller er den bevisst vår?

---

## Funn 2 — onboardingen har ingen vei inn for et etablert firma

**Målt (Explore-agent, 2026-08-30):**

- `/dashbord/kom-i-gang` nås **kun** via automatisk redirect fra `/dashbord` når firmaadmin
  har **null** prosjekter (`dashbord/page.tsx:64`). Har firmaet ett eller flere, finnes det
  **ingen lenke dit** — ikke i sidemeny, hub-kort eller firma-nav. Søkeregisterets egen
  kommentar sier «arbeidsflate uten nav-hjem» (`dype-sider.tsx:4,27`).
- Onboarding-panelet som faktisk finnes (`[prosjektId]/page.tsx:119-214`) er **per prosjekt**
  og vises kun når man allerede står inne i ett. `prosjekt.hentOnboardingStatus`
  (`prosjekt.ts:207-277`) svarer på ett prosjekts konfigurasjon — dokumentflyt, brukergrupper,
  maler, lokasjon, tegning + modulbetingede steg. Den vet ingenting om porteføljen.

**Det betyr at vi har bygget «hva mangler i dette prosjektet», men ikke «hva gjør jeg nå».**
De to spørsmålene er ikke det samme, og det andre er pilotens første møte med produktet.

🔴 **Dette korrigerer premisset i ON-ordren fra 28.08.** Den bygde på at onboarding-panelet
manglet. Det gjør det ikke — det finnes og konsumeres. Hullet er på **firmanivå**, ikke
prosjektnivå. Cowork gatet ordren uten å grepe etter panelets konsument; det var min feil,
og ordren skal ikke sendes i sin nåværende form.

**Spørsmål til deg:** skal firmanivået ha sin egen onboarding-status (portefølje-nivå:
«firmaet har X prosjekter, Y uten dokumentflyt»), eller skal `kom-i-gang` bare få et
nav-hjem slik at den kan åpnes igjen?

---

## Hvorfor de hører sammen

Begge er samme mangel sett fra hver sin side: **firmaflaten viser tilstand, men handler
ikke.** Prosjektlisten viser status uten å kunne endre den; onboardingen finnes uten å kunne
nås. Løser vi dem hver for seg, får vi to halve svar på ett spørsmål — hva firmaadministrasjon
faktisk *er* i SiteDoc.

Masterplanens punkt 1 er ON og punkt 2 er REG fase 3 (firmamal + onboarding-automatikk).
Funnene over ligger mellom dem. **Cowork skriver ingen ordre før du har sagt hvor grensen
går.**

## Ikke målt

- Om `nyNav`-flagget er på i prod — avgjør om firmaadmin ser FIRMA-sonen og oppsett-sidemenyen
  samtidig. Fant ikke flaggverdien.
- Om noe middleware utenfor `apps/web/src` redirecter til `kom-i-gang` på andre betingelser.
