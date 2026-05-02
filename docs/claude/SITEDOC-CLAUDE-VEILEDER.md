# SiteDoc — Veileder for Claude

Denne filen gis til Claude ved start av ny sesjon for å gjenopprette
kontekst. Les den før du gjør noe.

---

## Hva er SiteDoc?
Norsk byggeprosjekt-styringssystem. Monorepo:
- `apps/web` — Next.js (sitedoc.no / test.sitedoc.no)
- `apps/api` — tRPC/Node.js
- `apps/mobile` — React Native/Expo
- `packages/db` — Prisma/PostgreSQL

Kenneth = sole developer. Claude = QA + strategisk rådgiver.
Opus = implementasjon.

---

## Miljøer
| Navn | URL | Bruk |
|---|---|---|
| test | test.sitedoc.no | Alltid test her først |
| prod | sitedoc.no | Kun etter verifisert test |

Branching: feature-branch → develop (auto-deploy til test) →
main (manuell deploy til prod).
**Aldri deploy til prod uten Kenneths eksplisitte godkjenning.**

---

## Roller og tilgang
| User.role | Tilgang |
|---|---|
| sitedoc_admin | Alt — Kenneth (kemyrhau@gmail.com) |
| company_admin | Firma-admin — Kari (kemy.rhau@gmail.com) |
| user | Vanlig bruker |

| ProjectMember.role | Tilgang |
|---|---|
| admin | Full prosjekt-admin + attestering |
| member | Vanlig medlem |

**kanAttestere** (Boolean på ProjectMember) — kan attestere timer
uavhengig av rolle. Backfill: alle admin-rader har kanAttestere=true.

---

## Testbrukere (test-DB)
| Navn | E-post | Role | PM.role |
|---|---|---|---|
| Ola Tømrer | k.emyrhau@gmail.com | user | member |
| Per Prosjektadmin | ke.myrhau@gmail.com | user | admin |
| Kari Firmaadmin | kemy.rhau@gmail.com | company_admin | — |
| Tore SiteDocAdmin | kemyr.hau@gmail.com | sitedoc_admin | — |

Alle logger inn via Google OAuth med Gmail-dot-triks
(alle leveres til kemyrhau@gmail.com).
Prosjekt: «Test redigert mal Kenneth Myrhaug»
(ID: 2bd15f09-8fbc-4de9-a826-3d2e5462bb23)
Firma: Byggeleder (f1000001-0000-0000-0000-000000000002)

---

## Testprosjekt for funksjonell testing
**«Markussen Boligfelt B12»** på test.sitedoc.no
- Prosjekt-ID: f6dcb81f-802c-415b-a6c6-a8fdf7f9710f
- Faggrupper: A.Markussen AS, Byggherre Boligfelt B12
- Dokumentflyt: A.Markussen Ansatte (Reg→Godk), Endringmelding (Reg→Best→Godk)
- Brukergrupper: A.Markussen Ansatte (Ola), A.Markussen Ledelse (Kenneth+Per), Byggherre (Kenneth)
- Maler koblet: KB2, KB4, KB6
- Lokasjon: Bygg B12 → 1. etasje → georeferert tegning

---

## Nøkkel-konsepter

### Faggruppe ≠ Brukergruppe
- **Faggruppe** = firma-part i dokumentflyten («A.Markussen AS»)
- **Brukergruppe** = ansatte med samme rolle («A.Markussen Ansatte»)

### Dokumentflyt
- Tilgang er **gruppe-basert, firma-uavhengig**
- Status settes av brukerhandling, ikke automatisk
- Overgang: draft→sent→received→in_progress→responded→approved/rejected→closed

### Maltyper
- Kun to kategorier: **sjekkliste** og **oppgave**
- HMS-avvik = oppgavemal med domain="hms"
- Godkjenning = egen Prisma-modell, ingen UI/builder ennå

### Terminologi (viktig)
- **Attestering** = leder godkjenner lønn/timer (Timer-modul)
- **Godkjenning** = byggherre aksepterer kostnad (Dokumentflyt)
- Disse er FORSKJELLIGE — ikke bland dem

---

## Viktige URL-er (test)
| Side | URL |
|---|---|
| Dashbord | /dashbord |
| Nytt prosjekt | /dashbord/nytt-prosjekt |
| Faggrupper CRUD | /dashbord/prosjekter/[id]/faggrupper |
| Faggrupper (read-only) | /dashbord/[id]/faggrupper |
| Dokumentflyt | /dashbord/oppsett/produksjon/kontakter |
| Brukere/grupper | /dashbord/oppsett/brukere |
| Sjekklisemaler | /dashbord/oppsett/produksjon/sjekklistemaler |
| Oppgavemaler | /dashbord/oppsett/produksjon/oppgavemaler |
| Lokasjoner | /dashbord/oppsett/lokasjoner |
| Timer-attestering | /dashbord/[id]/timer/attestering |
| Firma timer-oppsett | /dashbord/firma/timer/onboarding |

---

## Deploy-sekvens (lær av feil)
```bash
# Test-deploy
ssh sitedoc "cd ~/programmering/sitedoc-test &&
git reset --hard origin/develop &&
pnpm install --frozen-lockfile &&
pnpm --filter @sitedoc/db exec prisma generate &&
pnpm --filter @sitedoc/db exec prisma migrate deploy &&
pnpm build --filter @sitedoc/web &&
pm2 restart sitedoc-test-web"

# Prod-deploy (kun med Kenneths godkjenning)
# Samme men med origin/main og sitedoc-web
```
**prisma generate MÅ kjøres før migrate deploy** — lærdom fra
kan-attestere-deploy.

---

## Prosessregler
1. Plan med ord FØR koding
2. Test-deploy → verifiser → prod-deploy (aldri hopp over)
3. Verifiser alltid som innlogget bruker — HTTP 200 er ikke nok
4. Aldri deploy til prod uten Kenneths eksplisitte «ja»
5. Instrukser til Opus merkes «OPUS-INSTRUKS»
6. Spør Opus om kodebasen — ikke gjett
7. STATUS-AKTUELT.md og CLAUDE.md oppdateres i samme commit som
   funksjonsendringer

---

## Åpne tråder per 2026-05-02
- EAS Build 19 → TestFlight: feilet, må diagnostiseres via expo.dev
- Timer-modul ikke aktivert på prod-firma ennå
- Firma-nivå bruker/rettighets-UI (Steg 2+3 i onboarding-plan)
- Godkjenning-UI (Prisma-modell klar, ingen tRPC/UI)
- Modul-gateway-refaktor (harTimerModul → OrganizationModule)

---

## Nyttige filer i kodebasen
- `docs/claude/STATUS-AKTUELT.md` — nåværende status alt arbeid
- `docs/claude/fase-0-beslutninger.md` — låste arkitektur-beslutninger
- `docs/claude/prosjektoppsett-veileder.md` — steg-for-steg prosjektoppsett
- `docs/claude/dagsseddel-design.md` — Timer-modul design
- `docs/claude/dokumentflyt.md` — Dokumentflyt-arkitektur
- `CLAUDE.md` — Regler og pågående arbeid (rotfil)
