# Til fabel: Kontakter-flaten — splitt, redigeringsregel og forslagslag

**Fra:** cowork · **Dato:** 2026-09-08 · **Status:** 🟢 KLAR — én åpen Kenneth-beslutning (§ 6)

⚠️ **Ikke hastende.** Kenneth stoppet deg på ~96 % bruksgrense 06.09. **Ta den når du er i gang
igjen.** Ingenting bygges før du har svart.

## 0. Hva dette er

Kenneth har brukt tid på å analysere `/dashbord/oppsett/brukere` slik den er i dag.
Hans dom: **«det er bra — men forbedring trengs.»**

🔴 **Alt under er MÅLT i kode, ikke antatt.** Der noe er cowork-vurdering, står det.

---

## 1. Problemet, i Kenneths ord

> *«det er noe med visningen som jeg syns blir feil. det er lastet for mye informasjon inn i
> linjene»*
>
> *«det er litt mange plasser å administrere denne siden»*
>
> *«Den verste plassen å finne er legg til en bruker i dokumentflyt»*

**Én rad bærer i dag:** navn · flyt-chips (opptil 6) · e-post · telefon · firma · rolle ·
attestering · faggrupper (redigerbar) · tilgangsgrupper (redigerbar). Pluss tre ikoner per
gruppeoverskrift og tre knapper i toppen.

## 🔴 2. Rotårsaken er ikke antall kolonner — den er skjult avledning

**Målt `page.tsx:412-470`:** `flytChipsPerMedlem` slår sammen **tre relasjoner** til én flat liste:

| Kilde | Binding |
|---|---|
| **Direkte** | `DokumentflytMedlem.projectMemberId` |
| **Via brukergruppe** | `groupId` → utvides til alle gruppens medlemmer |
| **Via faggruppe** | `faggruppeId` → utvides til alle faggruppens medlemmer |

Skjemaet sier «**HØYST én av**» de tre (`schema.prisma:1458`). 🔴 **Chipsene oppgir ikke kilden.**

**Seks «Flyt →»-chips på en rad sier ikke hvilke som er personens egne og hvilke som er arvet.**
Raden viser avledet data fra tre hierarkier uten provenans. **Det er problemet.**

---

## 3. Kenneths forslag — splitt i tre nivåer

> **Kontakter** → ren kontaktliste (navn, e-post, telefon, firma) — **redigerbar her**
> **Brukergrupper** → kort med kun navnene, lite ikon bak (les/rediger)
> **Åpne gruppen** → medlemmene + hvilke tilganger gruppen har
> **Trykk på et navn** → kort med telefon, e-post, firmatilknytning, og hvilke dokumentflyter
> medlemmet er med i

**🟢 Målt at modellen bærer det:**

| Del | Datagrunnlag |
|---|---|
| Kontaktliste | 🟢 Alt på `user` — navn, e-post, telefon, rolle, `canLogin`, HMS-kort. **Ingen avledning** |
| Gruppekort | 🟢 `dbGrupper`: `name`, `category`, `domains`, `members` |
| Gruppens tilganger | 🟢 `domains` **ER** tilgangene — Bygg/HMS/Kvalitet-chipsene finnes alt, bare på feil sted |
| Flyt-liste på personkort | ⚠️ Avledet av de tre kildene i § 2 — **trenger provenans** |

## 🟢 4. KENNETH-VEDTAK — én redigeringsplass per relasjon

> *«e-post, telefonnummer, firma, navn kan redigeres → ikke dokumentflyt → den må legges til i
> dokumentflyten → kun der»*

**Personkortet VISER flyt-deltakelse. Det er ikke en inngang til å endre den.**

🟢 **Det løser to ting:**
1. Arvet-vs-direkte blir et **forklaringsproblem**, ikke et redigeringsproblem. Provenansen skal
   fortsatt vises — men som forklaring, ikke som en knapp som kan endre for alle i en gruppe.
2. 🟢 **`+`-ikonet i gruppeoverskriften skal BORT**, ikke gjøres lettere å finne. Handlingen hører
   i dokumentflyten.

### Og skillet som følger

| | Hva den er | Redigeres |
|---|---|---|
| **Faggruppe** | En **egenskap ved personen** — hvilket fag han tilhører | 🟢 På kontakten (bygget `ed21b640`) |
| **Dokumentflyt** | En **struktur personen deltar i** — egne ledd, roller, rekkefølge | 🟢 I dokumentflyten, kun der |

🔴 **Faggruppe trenger derfor INGEN egen flate.** Dokumentflyt har allerede sin.

## 🟢 5. Forslagslaget — «legg til hvor som helst, få foreslått resten»

> **Kenneth:** *«problemet for en ny bruker er at hen glemmer å legge til en plass → brukeren får
> ikke til det som er ønsket»*

| Start her | Skjer automatisk | Foreslå |
|---|---|---|
| **Gruppe** | 🟢 Kontakt opprettes (`gruppe.leggTilMedlem` tar e-post → `User` → `ProjectMember`) | dokumentflyt? |
| **Kontakter** | — | dokumentflyt + gruppe |
| **Dokumentflyt** | 🟡 Kontakt opprettes for firmaansatte (batch-veien) | gruppe |

**🟢 Målt: rørleggingen finnes stort sett.** `GruppeMedlem` og `DokumentflytMedlem` peker begge på
`projectMemberId` — **det er strukturelt umulig å være i gruppe eller flyt uten å være i
kontaktlista.** Arven Kenneth beskriver er allerede tvunget av datamodellen.

🔴 **To gap:**
1. **Forslagslaget finnes ikke noe sted.** Hver handling fullfører seg selv og sier ingenting om de
   to tomme tilknytningene. **Dette er ditt designoppdrag.**
2. **E-post-vei inn i dokumentflyten mangler.** Gruppen har den; `dokumentflyt.leggTilMedlem` tar
   `projectMemberId` direkte. **Skal flyten få samme mønster, eller er «legg til i flyt» alltid et
   andre steg?** Meld din vurdering — det påvirker hvordan forslaget skal se ut.

⚠️ **Hjemmel finnes:** [prosjektoppsett-veileder.md](../claude/prosjektoppsett-veileder.md) står som
🟡 PLAN «steg-for-steg ny bruker». **Kenneths forslag er den veilederen, men kontekstuell.**
🟢 **Coworks vurdering: kontekstuell er bedre.** En lineær veileder må fullføres i én økt og hjelper
ikke den som kommer tilbake om tre uker for å legge til én person.

## 🔴 6. ÅPEN KENNETH-BESLUTNING — navnet

**Målt:** `page.tsx:520` grupperer på `dbGrupper.filter(g => g.category === "brukergrupper")`.
Variabelen heter `brukerGrupperListe`. **DB-kategorien er `brukergrupper`.**
**UI-et sier «Tilgangsgrupper» og «+ Ny tilgangsgruppe».**

🔴 **To navn på samme ting.** Blir gruppen en egen flate med eget kort, **er navnet det første
brukeren leser** — og det bør ikke være et navn koden er uenig i.

| Kandidat | Beskriver |
|---|---|
| **Tilgangsgruppe** | Hva den styrer — moduler og domener |
| **Brukergruppe** | Hva den inneholder — og det koden/DB sier |
| **Kontaktgruppe** | Det siden heter |

**Kenneth eier valget.** 🟢 **Men du kan gi en anbefaling** — dette er delvis et UX-spørsmål, og du
har sett hvordan ordet leses i sammenheng.

---

## Hva cowork trenger fra deg

**1. Designforslag på de tre nivåene** (§ 3), med hva som vises hvor.
**2. Provenans på flyt-listen** (§ 2 + § 4): hvordan skiller kortet «personlig» fra «fordi du er i
Byggherre» — **uten å bli teknisk?**
**3. Forslagslaget** (§ 5): hva ser brukeren etter hver av de tre handlingene? 🔴 **Det skal ikke
være en blokkerende dialog** — Kenneths poeng er at man skal kunne bygge tilknytningen gradvis, ikke
tvinges gjennom alt.
**4. Din vurdering av gap 2** (e-post-vei i flyten).
**5. Anbefaling på navnet** (§ 6) — Kenneth avgjør, men si hva du ville valgt.

## Ikke i denne bestillingen

- 🔴 **Faggruppe som egen flate.** Vedtatt: den er en egenskap ved personen.
- Kode. **Ingenting bygges før du har svart og Kenneth har gatet.**
- Terminologi utover § 6. [terminologi.md](../claude/terminologi.md) står.
- Mobil. **Kontakt- og gruppeadministrasjon er kontorarbeid** — web-flate.
