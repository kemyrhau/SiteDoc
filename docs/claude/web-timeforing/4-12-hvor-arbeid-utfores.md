> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.12. Seksjonsnumrene er de samme som før delingen.

### 4.12 Hvor arbeid utføres: prosjekt og byggeplass, eller prosjekt og underprosjekt (versjon 11)

**Kenneth 2026-11-20, presisering til B34:** *«prosjekt og byggeplass eller prosjekt og underprosjekt må være
gyldige valg for hvor arbeid utføres.»* Det gjelder arbeid, ikke bare reise.

Målt mot develop @ `8c260833`. Alt er lest av Fabel. Ingenting er kjørt.

| # | Målt | Hvor |
|---|---|---|
| **FA66** | **Telefonen:** et kort er prosjekt, byggeplass og underprosjekt. «+ Nytt kort» viser byggeplassene som rader, alltid med «Uten byggeplass», og underprosjektene som knapper med «Uten» som forvalg. Har prosjektet høyst én byggeplass og ingen underprosjekter, åpnes kortet direkte. | `M/components/timer-detalj/prosjektkort/KortValgModal.tsx:14–27`, `:33–43`, `:76–84`, `:99–118` |
| **FA67** | **PC:** timerad-vinduet har feltet byggeplass (skjult når prosjektet ikke har noen, tekst når det har én, nedtrekk med «Ingen byggeplass» når det har flere) og et valgfritt underprosjekt. | `WS:2914`, `:3537–3541`, `:3690–3707`; `apps/web/src/components/timer/RadByggeplassFelt.tsx:49–86`; `apps/web/src/lib/timerByggeplass.ts:21–33` |
| **FA68** | **Serveren krever ingen av dem.** Byggeplass og underprosjekt kan begge være tomme på en timerad. Serveren sjekker bare at byggeplassen hører til prosjektet. | `D:3920`, `:3934`, `:4016` |
| **FA69** | **Nøkkelen (K2–K4)** er prosjekt, byggeplass og underprosjekt. Byggeplass og underprosjekt kan være tomme hver for seg. Byggeplassen er den effektive: radens egen, ellers dagsseddelens når den hører til radens prosjekt. | `packages/shared/src/utils/kortId.ts:127–129`, `:132–140` |
| **FA70** | **PC kan ikke alltid føre arbeid uten byggeplass.** Har prosjektet én byggeplass, velges den selv og kan ikke tas bort. Har dagsseddelen en byggeplass på samme prosjekt, arver raden den når brukeren velger «Ingen byggeplass». Telefonen løfter arven ut ved lagring, så «Uten byggeplass» blir stående. PC har ikke den koden. | `apps/web/src/lib/timerByggeplass.ts:21–33`; `kortId.ts:132–140`; `KortValgModal.tsx:24–26`; søk på `loftByggeplassArv` gir bare treff i `apps/mobile` |

**Svaret:**

1. **Begge valgene er gyldige i dag** — på telefon, PC og server.

   | Arbeidet føres på | Telefon | PC | Server og nøkkel |
   |---|---|---|---|
   | Prosjekt og byggeplass | ja | ja | ja |
   | Prosjekt og underprosjekt, uten byggeplass | ja | ikke alltid (FA70) | ja |
   | Prosjekt, byggeplass og underprosjekt | ja | ja | ja |
   | Bare prosjektet | ja | ikke alltid (FA70) | ja |

2. **Hva mangler:** ingenting for gyldigheten. Det ene avviket er FA70: på PC får en jobb på et underprosjekt
   noen ganger en byggeplass med på kjøpet. Kostnaden blir ikke feil av det. Underprosjektet står på raden
   uansett, og rapporten følger prosjektet og underprosjektet (FA57).
3. **Jobbens kort og nøkkelen:** K1–K4 trenger ingen endring. En jobb på «prosjekt og underprosjekt» har nøkkel
   med tom byggeplass, eller med byggeplassen arbeidet sto på. To jobber kan ha lik nøkkel (K7). Regelen for
   reisen (§ 4.11 del A punkt 3) dekker alle fire radene i tabellen.
4. **Er det nytt arbeid?** Ikke i w12 eller w12m. Hva som eventuelt bygges, følger svaret på **B35** (§ 8), som
   nå gjelder både arbeid og reise:
   - **Med A** bygges ingen ny del. FA70 rettes i w3, der jobbens hode på PC bygges: «Ingen byggeplass» blir
     stående, som på telefonen. 🟡 Ikke bygget.
   - **Med B** blir det en egen del, **w13** (§ 9). 🟡 Ikke bygget.
