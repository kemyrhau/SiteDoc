---
status: 🟢 ORDRE — klar for tildeling. Steg 1 av tre (steg 2 + 3 eies av cowork)
forfatter: design
gjelder: packages/shared
---

# Hva `packages/shared` får anta om verten sin

## § 1 Bakgrunn — målt, og «én linje» er feil ramme

**Cowork målte 2026-09-27: `pnpm typecheck` i shared gir exit 2 og 22 feil på ren develop. TRE av dem
er i `src`, i `signertBildePolicy.ts` — fersk `/uploads/`-kode.**

**Design målte bruken 2026-09-28 (fortsatt til stede på develop):**

| Sted | Bruk |
|---|---|
| `:40` | `new URLSearchParams(url.slice(q + 1)).get("exp")` |
| `:87` | `let timer: ReturnType<typeof setTimeout> \| null = null;` |

🟢 **`ReturnType<typeof setTimeout>` er bevisst plattform-agnostisk og riktig skrevet.**

🔴 **`packages/shared/tsconfig.json` legger til NULL** — den arver rotas `"lib": ["ES2022"]` og har
verken `types` eller `@types/node`. ⚠️ **Og `URLSearchParams`/`setTimeout` finnes ikke i ES2022-lib. De
er plattform-globaler.**

## § 2 Derfor er begge de opplagte fiksene for brede

| Fiks | Gir symbolene | 🔴 Lekker |
|---|---|---|
| `"lib": [… "DOM"]` | ja | **hele nettleser-API-et** inn i en pakke **api (Node)** og **mobil (RN)** importerer. `document` ville typesjekke og krasje ved kjøring |
| `@types/node` | ja | **hele Node-API-et** inn i en pakke nettleseren bundler. `fs`/`process` ville typesjekke |

🔴 **`packages/shared` kjører i TRE verter. En fiks som gir den én verts hele API-flate, gjør de to
andre utrygge på typenivå.**

## § 3 Kravet

🟢 **Erklær SMALT: bare de globalene shared faktisk avhenger av, i én ambient-erklæring i shared.**

🔴 **Og la erklæringen VÆRE den dokumenterte kontrakten for hva shared antar om verten.** ⚠️ **Da må en
framtidig fjerde avhengighet legges til lista eksplisitt — altså blir den synlig i review. Med `DOM`
eller `@types/node` blir den usynlig.**

**Kravet er at `pnpm typecheck` i shared går fra 3 til 0 feil i `src`.** 🟡 **De 19 testfil-feilene fra
`noUncheckedIndexedAccess` er steg 2 og eies av cowork — ikke rør dem her.**

## § 4 Hvorfor dette er designs ordre og ikke en mekanisk retting

🔴 **Valget er ikke hvilken linje som fjerner feilen. Det er hva shared får ANTA.** **Det er en
arkitekturbeslutning om en pakke tre flater deler, og den skal stå skrevet — ikke ligge i en
tsconfig-endring ingen leser.**

## § 5 Utenfor ordren

🔴 **Ingen endring i `signertBildePolicy.ts` sin logikk.** **Ikke bytt `ReturnType<typeof setTimeout>`
mot en konkret type — den er riktig som den er.**

🔴 **Ikke legg til et fjerde regel-10-ledd.** **Cowork eier regel 10, og rekkefølgen er hans: fiks
src → rydd testfilene → DA et ledd.** 🟢 **«En rød CI dag én blir ignorert» er riktig.**

🟡 **Meldt, ikke bestilt:** **ingen gate dekker shared i dag.** **Regel 10s tre ledd er web build,
mobil typecheck, web tsc; CI kjører test + mobil-typecheck. shared importeres av web, mobil OG api og
er ikke nevnt noe sted.** **Det er coworks sak — steg 3.**
