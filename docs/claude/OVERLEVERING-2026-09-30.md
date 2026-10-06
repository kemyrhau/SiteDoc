---
name: OVERLEVERING-2026-09-30
description: Overlevering av cowork-orkestreringen til Claude Code. Fire åpne tråder med hash, hva hver venter på, og de beslutningene som bare fantes i samtalen. Les ved oppstart hvis du overtar orkestreringen.
sist_verifisert_mot_kode: 2026-09-30
---

# Overlevering — cowork → Claude Code, 2026-09-30

**Skrevet fordi cowork-flaten fases ut 6. oktober.** Alt av varig verdi ligger allerede i
repoet ([SAMARBEIDSREGLER](SAMARBEIDSREGLER.md), [FUNKSJONSENDRINGER](FUNKSJONSENDRINGER.md),
[STATUS-AKTUELT](STATUS-AKTUELT.md), [BACKLOG](BACKLOG.md), `relay/`). **Denne fila bærer det
som bare fantes i samtalen:** hvorfor de åpne trådene ser ut som de gjør.

```
develop  5c7a0bb4          main (prod)  eb9071f2 · 24.09          183 commits fra hverandre
test     kjørte 230f2b64 ved skriving — Kenneth venter med vilje på ÉN samlet deploy
```

🔴 **Byggestempelet står i UI-et og på `https://api-test.sitedoc.no/version`.** Sjekk det før
du tror en fiks ikke virket — det kostet oss en runde 30.09.

---

## 🔴 Fella som ikke er åpenbar: `relay/` er gitignorert

`.gitignore:68`. **Filene følger ikke med en klone og synkes ikke mellom arbeidstrær.** Hver
agent har sin egen kopi i sitt worktree.

**Kanalen er hovedtreets kopi:** `~/Documents/Programmering/SiteDoc/relay/`, med **absolutt
sti**. Kjører orkestratoren med et annet tre som arbeidsmappe, skriver den ordrer ingen leser.

⚠️ **Og les hele `inbox-cowork.md`, ikke halen.** Agentene bruker to konvensjoner: noen føyer
til nederst, noen skriver øverst med `[agent → cowork]`-prefiks. **Cowork leste bare halen
30.09 og fortalte to agenter at de ikke hadde meldt fra — de hadde.** Regelen er nå skjerpet
til «nederst, og bare nederst», men eldre poster ligger fortsatt øverst.

---

## Fire åpne tråder

### 1️⃣ `feat/mobil-bildeheader` @ `97b7440a` — hos design, tredje gate

**Gir mobilens `<Image>` et Bearer-token**, fordi den native bildelasteren sender en naken GET.
Uten den blir hvert bilde i appen en tom ramme når `/uploads`-gaten skrus på.

🔴 **To avvik er funnet på samme funksjon, begge av design, begge ekte:**
- `1250580b`: `erServerUpload` var en **substreng-test**, ikke en host-test →
  `https://fremmed.example.com/uploads/x.jpg` fikk tokenet vårt
- `6bf3a8fe`: `origin()` feilet **lukket** på manglende protokoll, men **åpent** på tom base.
  `AUTH_CONFIG.apiUrl = env ?? "http://localhost:3001"` — `??` fanger ikke tom streng

⚠️ **Dette er den ene funksjonen mellom en fremmed URI og et bærer-bevis med 30 dagers
levetid. Gate den hardt.** Basen er eldre enn `4dab72f1`; be om rebase på `5c7a0bb4` for å se
web-tsc grønt.

### 2️⃣ `fix/annotering-tom-tekst-vakt` @ `4f76fbef` — hos redesign

**Feiler `enterEditing()`, fyrer `text:editing:exited` aldri**, og det tomme IText-objektet
blir stående i `objekter` → serialisert → **lagret. Usynlig, tomt, permanent.**

Kravet er å filtrere tom IText **ved lagring**, ikke ved hendelse — en garanti ved
konstruksjon i stedet for avhengighet av en hendelse som kanskje aldri fyrer.

### 3️⃣ `fix/mobil-herding-signerte-urler` @ `ceaca4c9` — levert, venter

Krav 1+2 er inne: resolveren er nøkkel-agnostisk og leger **utløpt-signert**, ikke bare rå.
🔴 **Krav 3b (selvfornyelse: tak 3, backoff, debouncet invalidering, 404 → terminal) er IKKE
levert — den skal inn i `AutentisertBilde`, og venter derfor på tråd 1.**

**Hvorfor der og ikke i en hook:** fornyelsen trenger tokenet, og tokenet bor i wrapperen. En
hook i fem `onError`-kall ville trengt sin egen token-henting — fem kopier av regelen. Og
tråd 1 sletter nettopp de fem `<Image>`-elementene.

### 4️⃣ Prod-deploy — blokkert, og med vilje

**Kenneth valgte «mål først».** Kontrollplans måling
(`maaling-mobil-lagrede-uploads-2026-09-30.md`): **for de fleste nei, men et forbigående ja** i
et vindu som 24 t → 15 min gjør verre. Tråd 3 lukker det.

**Tre forhold hører med i beslutningen:** tekstannotering er verifisert i web og **utestet på
mobil** · de tre umigrerte migreringene · prod-verifisering skal skje **som innlogget bruker**,
aldri `curl -sI`.

---

## 🟡 Ikke bestilt, og Kenneth har truffet den tre ganger

**Miniatyren forsvinner etter «Ferdig» i annoteringen.** `byggAnnoteringsPatch` skriver
`url = data.fileUrl` — den **rå** `/uploads/`-stien fra opplastingen. `SignertBilde` signerer
ikke (og skal ikke — feil lag). Serveren avviser, og filnavnet vises i stedet for bildet.

🟢 **Løsningen cowork anbefalte til slutt: invalidér spørringen etter opplasting**, så serveren
re-emitterer en signert URL gjennom veien som alt er autorisert. **Modell-uavhengig** — virker
med dagens signatur og med designs `(sti, exp, userId)`. Koster én rundtur.

🔴 **Cowork frarådet først «opplastingsruten signerer selv»** fordi det sementerer bærer-modellen
Kenneth avviste. Den begrunnelsen står — men refetch-varianten rammes ikke av den.

---

## Beslutninger som bare fantes i samtalen

| Beslutning | Kenneths ord |
|---|---|
| **Innlogging kreves for ALLE lagrede objekter** | *«URL skal ikke være nok → vi skal ha en gyldig innlogging → dette gjelder alle objekter som lagres og tilhører systemet»* |
| **15-min-vinduet er akseptert restrisiko** | *«15 minutter er ikke et problem → risiko for tyveri er betydelig redusert til pågående arbeid»* |
| **Impersoneringen styrer synligheten** | Signaturen bindes til **effektiv** `userId`. Mekanikken finnes alt i `context.ts:100-108` |
| **Flytt-verktøyet skal ikke endres** | *«ingen endring → jeg liker dagens funksjon»* — avvist forslag, ført så det ikke gjenoppstår |
| **Tekstverktøyet treffer overalt** | Klikk oppretter alltid tekst, unntatt på eksisterende tekst |

🔴 **Designs forslag til gaten, som står:** signer over `(sti, exp, userId)` i stedet for
`(sti, exp)`, og la gaten lese sesjonen én gang pr. forespørsel. **Signaturen er da beviset på
at `harProsjektTilgang` ble kontrollert ved emisjon** — én kontroll pr. sjekkliste, ikke femti
pr. vedlegg. **Målt at rewriten bærer `Cookie` og `Authorization` hele veien** (`12d10719`,
ekko-server på port 3001). **`network_mode: "service:sitedoc-api"` forklarer hvorfor
`localhost:3001` virker — delt nettverksnavnerom.**

---

## 🔴 Tre lærdommer fra 30.09 som er ferske og lett å miste

1. **`next build` typesjekker ikke `.test.tsx`.** `tsc --noEmit` sto rødt på develop i over et
   døgn mens hver gate rapporterte grønt — «typecheck rent» kom fra **mobil**-typecheck lest
   som dekning for begge. **De tre byggeleddene dekker ikke hverandre. Kjør hvert for seg.**
2. **`turbo run test` uten `--force` er cache.** 7/7 på **1,8 sekunder** ble meldt som gate-tall
   for 2 400 tester. **Kjøretiden i rapporten er selv en kontroll.**
3. **En ordre som ber om en måling skal navngi flaten målingen kan gjøres på, eller si at den
   ikke finnes.** Uten det bygde en agent sin tredje nettleser-harness på tre dager — Kenneth
   stoppet de to første.

## Mønsteret Kenneth selv navnga, og som er verdt å lete etter

> *«jeg har fått det fikset mange ganger. så gjøres det en endring i vanlig tegning. så slutter
> 3d modellen å fungere som den skal»*

🔴 **En feil som er fikset mange ganger og kommer tilbake, mangler ikke en fiks — den mangler en
vakt.** Samme dag lukket vi tre feller av én klasse: **et felt settes én gang, i en flyt
brukeren kanskje aldri kjører, uten vei tilbake.** «UTEN ETASJE» · `status = "utkast"` for
alltid · frihåndsstrøket som forsvant. **Det finnes trolig flere.**
