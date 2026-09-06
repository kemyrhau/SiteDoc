# Til fabel — skal navigasjonen ha en tilgangsmodell i det hele tatt?

**Fra:** cowork · **Skrevet:** 2026-08-28 · **Status:** UTKAST (ikke sendt)

Dette er **ikke** en forespørsel om å godkjenne en endring — Kenneth har vedtatt den og
den bygges nå. Det er den arkitektoniske resten, som er din.

## Utløseren

Kenneth impersonerte en vanlig ansatt på test. Personen var **prosjektmedlem OG
registrator i dokumentflyten**, og så likevel verken Sjekklister, Oppgaver eller
Tegninger. Bare Dashbord, Bilder, Mapper, Dokumentsøk og Papirkurv.

## Målingen — ni ledd fra «ansatt» til «ser Sjekklister»

Full tabell i [arkitektur.md § Stigen](../docs/claude/arkitektur.md). Kort:

`User.canLogin` → `OrganizationMember.status` → `ProjectMember` →
(`role="admin"` omgår resten) → **`ProjectGroup`-medlemskap** →
**`ProjectGroup.modules`** → `ProjectModule` → faggruppe-kobling → `DokumentflytMedlem`.

Han stoppet på ledd 6: `ProjectGroup.modules`. Sidebaren skjuler Sjekklister når
brukerens brukergruppe ikke lister dem (`sidebar-elementer.tsx:346`).

## 🔴 Det som gjør dette til et designspørsmål

**Navigasjonen og datalaget er to uavhengige systemer som ikke er enige.**

Datalaget avgjør hva brukeren faktisk får: `verifiserProsjektmedlem`,
`byggTilgangsFilter` (faggruppe), oppretter-regler. Målt 2026-08-28: **alle de sju
ugatede nav-elementene er vaktet i datalaget** — `bilde.ts:37-38`, `papirkurv.ts:33`.
Ingen lekkasje.

Så navigasjonen skjuler ting datalaget ville tillatt. Den ansatte ble nektet av *menyen*,
ikke av *serveren*.

**Og sidebaren har tre gate-systemer uten et prinsipp som forbinder dem:**

| System | Elementer | Redigeres på |
|---|---|---|
| `kreverGruppemodul` | sjekklister · oppgaver · tegninger · 3d | Innstillinger → **Brukere** (per brukergruppe) |
| `kreverModul` | hms-avvik · kontrollplan · økonomi · psi ×2 | Innstillinger → **Moduler** |
| `kreverFirmaModul` | timer ×3 · varelager · maskin | **Firma** → Moduler |
| *ingen gate* | dashbord · bilder · mapper · dokumentsøk · papirkurv · kontakter · oppsett | — |

Tre ting heter «moduler», ligger på tre ulike sider, og gater hver sin del av samme
sidebar. Ingenting i grensesnittet forteller at de er tre. Og ingenting forklarer hvorfor
**Bilder** er ugatet mens **Sjekklister** ikke er — bildene henger jo på sjekklistene.

## Hva Kenneth har vedtatt (bygges nå, ikke til vurdering)

> *«sjekklister og oppgaver skal alltid være en del av prosjekt — uten dette faller
> grunnlaget bort. Tegninger er også automatisk en del av grunnlaget. 3D skal være
> ekstra feature.»*

`kreverGruppemodul` fjernes fra sjekklister, oppgaver og tegninger. **3D beholder sin.**

**Konsekvens:** etter dette har `kreverGruppemodul` **én bruker igjen** — 3D. Et helt
gate-system, med egen redigeringsflate på brukergruppe-siden, for én meny-oppføring.

## Merk: du arvet dette, du designet det ikke

`redesign-handoff.md:57` lister `kreverGruppemodul` under **«Sidebar-funksjoner som må
overleve»**. Du fikk beskjed om å bevare den og gjorde det. Vi overkjører ingen
beslutning av deg — vi fjerner arvegods du ble bedt om å ta vare på.

## Spørsmålet

**Skal navigasjonen ha en tilgangsmodell i det hele tatt, når datalaget allerede
avgjør?**

To ærlige svar, og vi har ikke tatt standpunkt:

- **Ja** — menyen skal ikke vise flater brukeren ikke kan bruke; tomme sider er verre
  enn fraværende menypunkter. Da trengs **ett** system med et prinsipp, ikke tre.
- **Nei** — menyen viser alt datalaget tillater, og tomhet taler for seg. Da forsvinner
  hele klassen «hvorfor ser ikke X dette», som har kostet en gate-runde i dag.

Og hvis svaret er «ja»: **hva skal 3D gjøre?** Ett gate-system for én oppføring er en
kandidat for å flyttes til `kreverModul` sammen med de andre tilvalgene — men det er ditt
kall, ikke vårt.

## Leveranse

Et designnotat i `docs/redesign/`. Ikke kode. Ingenting haster — endringen Kenneth
vedtok lander uansett, og den gjør bildet enklere, ikke vanskeligere.
Er noe her feil målt: si det.
