> Del av [Timeføring på web — plan med bilder](../web-timeforing-plan.md): § 4.9. Seksjonsnumrene er de samme som før delingen.

### 4.9 Beskrivelsen i kortet (versjon 9)

**Kenneth 2026-11-20:** *«Jeg glemte at vi også må ha med beskrivelse i kortet. Denne er svært viktig ved
attestering.»*

Målt mot develop @ `a5483f48`:

| # | Målt | Hvor |
|---|---|---|
| **FA34** | **Det finnes to tekstfelt.** Dagsseddelen har ett for hele dagen, som heter «Kommentar» på skjermen. Hver timerad har ett, som heter «Hva gjorde du?». Begge er valgfrie i databasen. Ingen kode kopierer mellom dem. Maskinraden har ingen tekst. | `ST:191`, `:251`; `packages/shared/src/i18n/nb.json:496` (`timer.felt.beskrivelse`), `:654` (`timer.felt.radBeskrivelse`). Lest av Fabel. |
| **FA35** | **Telefonen skriver «Hva gjorde du?» på timeradene.** I prosjektkort-modus er det én tekst pr. jobb. Den er påkrevd og lagres på alle jobbens arbeidsrader, også overtidsraden. Reiserader får ingen. I dagskort-modus er teksten pr. rad og påkrevd i radvinduet. | `M/utils/dagsforslagAnvend.ts:284`, `M/utils/beskrivelseKort.ts:202–212` (lest av Fabel); `M/components/timer-detalj/prosjektkort/kortBeskrivelse.ts:16–40`, `M/utils/bekreftDag.ts:115–119`, `M/components/timer-detalj/TimerSeksjon.tsx:1751–1761` (leseagent) |
| **FA36** | **Web skriver «Hva gjorde du?» på raden, og feltet er valgfritt.** Teksten kopieres ikke til de andre radene i jobben. B6 (påkrevd pr. jobb) er vedtatt og bygges i w3. | `WS:3758–3771` (lest av Fabel); `WS:3187`, `:3201`, `:3303–3341` (leseagent) |
| **FA37** | **«Kommentar» for dagen skrives et annet sted:** i skjemaet «Ny dagsseddel» og på dagssiden på web, og i vinduet for arbeidstid på telefonen. Returkommentaren har sitt eget felt og blandes ikke inn. | `NY:345–356`; `WS:5562–5570`; `M/components/timer-detalj/ArbeidstidSeksjon.tsx:204`; `ST:192` (`lederKommentar`). Målt av leseagent. |
| **FA38** | **Kortet leser bare radenes tekst.** En rad uten tekst gir aktivitetsnavnet i stedet. Tekstene skjøtes med « · ». En jobb med én rad med tekst og én uten viser «Graving … · Anleggsarbeid». En jobb uten tekst viser bare «Anleggsarbeid», og attestanten ser ikke at beskrivelsen mangler. | `RP:109`, `:250–252`. Lest av Fabel. |
| **FA39** | **Dagens «Kommentar» vises ikke i lista eller i kortet.** Den står bare på detaljsiden. Begge listene sender den til nettleseren. | `AD:454–459` (lest av Fabel); `D:5779–5788`, `:5893`, `:6022–6036`, `:6215` (leseagent) |
| **FA40** | Tabellen har en kolonne «Beskrivelse» som leser radens tekst. Den er ikke blant kjernekolonnene og må slås på med «Velg parameter». | `packages/shared/src/utils/timerDetaljRader.ts:745–751` (lest av Fabel); `AM:391` |
| **FA41** | **Attestanten kan ikke rette beskrivelsen.** Rettekallet har ikke feltet, og «Rediger»-vinduet tar det ikke for nye rader. | `D:7299–7320` (lest av Fabel); `D:2874–2892` |
| **FA42** | **✂ mister beskrivelsen.** Den første delen beholder den, fordi originalraden oppdateres. De andre delene lages uten tekst. «Del opp» ved klokkeslett kopierer teksten. | `D:7722–7748`, `:6813`. Lest av Fabel. |
| **FA43** | **Telefonens attestering viser dagens «Kommentar», men ikke radens «Hva gjorde du?».** | `M/components/timer-attestering/AttesteringDetaljMobil.tsx:268–271` (lest av Fabel), `:300–314` |
| **FA44** | Testdagen 13.05. har teksten i dagens «Kommentar», ikke på radene (målt av orkestrator på test). Dagen ble lagt inn med SQL (WM93). Teksten finnes ikke i noe skript i repoet. Databasen er ikke lest av Fabel. | `relay/inbox-fabel.md` ordre 2026-11-20 (3) |

**Hvorfor kortet viste «Anleggsarbeid»:** testdagen har ingen tekst på radene (FA44), og kortet setter da inn
aktiviteten (FA38). Ekte dager ført på telefonen har teksten på radene (FA35). Feilen i koden er at aktiviteten
tar beskrivelsens plass, og at dagens kommentar ikke vises.

**Slik skal det være** (w10 del A punkt A6):

1. **Del 3 «Hva gjorde du?» viser det arbeideren skrev på jobben.** Det er teksten på jobbens timerader, hver
   tekst én gang, i rekkefølge etter klokkeslett.
2. **Aktiviteten står aldri der beskrivelsen skal stå.** Har ingen av jobbens rader tekst, står det
   **«Ikke utfylt»**, uthevet, så attestanten ser at beskrivelsen mangler og kan returnere jobben.
3. **Aktiviteten flyttes til kortets hode,** ved siden av byggeplassen. Den forsvinner ikke fra kortet.
4. **Dagens «Kommentar» vises i kortet,** under del 3, med ledeteksten «Kommentar til dagen». Den vises i hvert
   kort den dagen, også reisens. Er den tom, vises ingenting.
5. **Beskrivelsen kan leses, ikke rettes, i w10.** Slik er det i dag (FA41). Er den feil eller mangler, returneres
   jobben med kommentar. Retting av teksten følger w3, der jobben føres som én flate.
6. **✂ arver beskrivelsen** (FA42). De nye delene får originalens tekst, slik «Del opp» alt gjør. Det er én linje
   på serveren og lukker et hull: i dag mister de nye delene teksten i rapporten og eksporten.
7. **Kolonnen «Beskrivelse» står som i dag.** Den er ikke i kjernen (B13 A, 13 kolonner), og kan slås på.
8. ⚠️ **Reisens eget kort slik § 4.7 punkt 4 beskrev det, er utgått** (B32 B). Et kort med bare reise viser ikke
   del 3 «Hva gjorde du?» (w10 A6), og ruta står i del 8 «Reise» (§ 4.11 del C).

**Utenfor w10:**
- Telefonens attestering viser ikke radens beskrivelse (FA43). Det bør rettes i en egen liten ordre for
  telefonen. Hjemmelen er Kenneths ord over.
- «Hva gjorde du?» blir påkrevd på web i w3 (B6).
- Ny testdata (§ 8.7) skriver beskrivelsen på radene, gjennom serverens egne skriveveier. Det står alt i kravet.
