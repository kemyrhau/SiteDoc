---
status: 🟢 MÅLING 1 — besvart. Ingen kodeendring. Svar på coworks ordre 2026-09-29
forfatter: design
base: develop 230f2b64
---

# Måling 1 — bærer `/api/uploads/`-rewriten cookien videre?

## 🟢 SVAR: JA. Ingenting strippes.

**MÅLT 2026-09-30, lokalt.** **Design satte en EKKO-SERVER på port 3001 i stedet for API-et og
sendte en forespørsel gjennom Next-rewriten.** 🟢 **Da måles rewriten ISOLERT — ingen midlertidig
logging i repoet, ingen kodeendring, og det er ikke mulig å forveksle hva nettleseren sendte med
hva Next sendte videre.**

**Sendt inn mot `http://localhost:3100/api/uploads/privat/prove.jpg?exp=1&sig=abc`:**

**Mottatt på 3001 — ordrett fra ekko-loggen:**

```
sti: /uploads/privat/prove.jpg?exp=1&sig=abc
  authorization:     Bearer TOKEN456
  cookie:            authjs.session-token=HEMMELIG123; annen=verdi
  x-egendefinert:    prove
  host:              localhost:3001
  x-forwarded-host:  localhost:3100
```

| Spørsmål fra ordren | Målt svar |
|---|---|
| Kommer `Cookie` fram? | 🟢 **JA — intakt, inkludert Auth.js-cookienavnet** |
| Kommer `Authorization` fram? | 🟢 **JA — intakt** |
| Strippes noe? | 🟢 **NEI** — egendefinert header kom også fram |
| Query-strengen? | 🟢 **bevart** (`?exp=1&sig=abc`) |
| Stien? | 🟢 `/api/uploads/…` → `/uploads/…` |

🟢 **`x-forwarded-host: localhost:3100` LEGGES TIL, og `host` settes til destinasjonen.**
⚠️ **En gate som validerer `Host` vil altså se API-porten, ikke web-domenet. Bruk
`x-forwarded-host` hvis opphavet skal kontrolleres.**

### 🟡 Avgrensning som skal stå

🔴 **Dette er målt på Next DEV (14.2.35), ikke på et produksjonsbygg i container.**
**Rewrite-mekanismen er den samme, men design har ikke målt det bygde imaget.**
🟢 **At `Authorization` også overlever er et sidefunn med verdi: en klient som bærer Bearer kan gå
samme vei som nettleseren.**

## 🟢 KRAV 2 — hva får `destination: http://localhost:3001` til å virke i Docker?

🟢 **MÅLT i `docker/docker-compose.yml`. Svaret er én linje, og den er tilsiktet:**

```yaml
sitedoc-web:            # linje 37
  ...
  network_mode: "service:sitedoc-api"    # linje 69
```

🔴 **Web-containeren deler API-containerens NETTVERKS-NAVNEROM.** **`localhost:3001` inne i
web-containeren ER api-en — samme navnerom, ikke en proxy og ikke DNS.**

🟢 **Samme mønster i test:** `docker-compose.test.yml:69` → `network_mode: "service:sitedoc-test-api"`.

**Konsekvens for gate-arbeidet:**

- 🟢 **Veien er kort og lukket: nettleser → web (Next) → samme navnerom → api.** **Det finnes ikke
  et nettverkshopp der en header kan gå tapt.**
- 🔴 **`API_PORT` er et BUILD-arg, ikke runtime.** `Dockerfile.web:25-29` sier det rett ut: verdien
  **bakes inn i Next routes-manifestet ved BUILD**. ⚠️ **Endres porten, må imaget bygges på nytt —
  en `environment:`-endring har ingen virkning.**

## 🟢 Hva dette betyr for forslaget

🟢 **Forutsetningen design førte som UMÅLT i § 4 av forrige rapport holder.** **Web bærer sesjon
helt fram til API-et, både som cookie og som Bearer.**

🔴 **Mobilsporet er uendret: `<Image source={{ uri }}>` sender fortsatt en naken GET.** **Måling 2
står.**

## 🔴 Det design IKKE har målt

1. **Produksjonsbygget.** **Målingen er gjort på Next dev. Det bygde imaget er ikke målt.**
2. **Om en ekte innlogget nettleser sender cookien til `/api/uploads/`** — design sendte den for
   hånd. 🟢 **Same-origin gjør at den skal sendes, men det er utledet, ikke observert.**
3. **Ingenting er målt på server-ny.** **Krav 2 er besvart fra compose-filene, uten en eneste
   kommando mot serveren.**
