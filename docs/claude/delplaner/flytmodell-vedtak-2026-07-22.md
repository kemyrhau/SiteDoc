# Flytmodell + rettighetsmatrise-UI — samlet Kenneth-vedtak 2026-07-22

TIL REPO: docs/claude/delplaner/flytmodell-vedtak-2026-07-22.md (cowork plasserer; fabel etterleser).
Fasit-mockup: `P1 Nivåsignal Beslutningskart.dc.html` § 5a (interaktiv matrise + linjevisning) og § 4a (dagens kode, målt).

## Linjemodellen (vedtatt semantikk)
2–4 flytbokser, venstre→høyre; registrator alltid venstre ende. Ikke-endepunkt kan alltid sendes tilbake (kommentar obligatorisk, P2) og videre; endepunkter har én retning. «Videresend» = ADMIN-verktøy på tvers av flyter (bytter dokumentflytId, kan målrettes person) — ikke linjebevegelse.

## Vedtak
1. **Rettigheter blir konfig i admin-UI** (sitedoc_admin): handlingsmatrise per rolle×status, inkl. rad «(nytt)·Opprett» og kolonnene PROSJ.ADMIN (tom default) og ADMINISTRATOR. Statusmaskinen forblir fast kode — matrisen kan kun slå av/på handlinger som finnes, aldri skape overganger.
2. **Én ny overgang i maskinen:** rejected → sent («Send på nytt», venstre ende retter og resender). Default: registrator/bestiller/admin. Lukker regresjonen fra registrator-fiksen (avvik 4).
3. **Videresend-innstramming:** flyttes fra utfører/godkjenner til administrator (avvik 2) — via matrise-defaults, ikke hardkodefjerning.
4. **Matrisen gjelder per firma** nå; per flyt senere ved behov. Endringslogg på justeringer.
5. **Lese/rediger-fane** i samme UI: VISER eksisterende egenskaper (les + task_edit/checklist_edit per kategori oppgave/sjekkliste + DokumentflytMedlem.kanRedigere — flytRolle.ts:155-199). Ingen ny modell. Forbehold til måling ved bygging: oppgave-redigering skal være append (historikk bevares).
6. **HMS = eget synlighets-UI**, blandes ikke i flytmatrisen: RUH + HMS-avvik privat (HMS-admin + innsender), SJA alle — vedtatt. Vernerunde (alle) + bedriftstilpassede: udrøftet, står. Nå bygges kun: mal lagret under HMS + default HMS-dokumentflyt auto-opprettes når HMS aktiveres for et prosjekt. Presiserer sak 3 (privat = D4/F1-A-stien i avgjorDokumentTilgang).

## Sikkerhetsrammer (ikke konfigurerbare)
Server håndhever matrisen (delt kilde, dagens Sets som fallback) · P2-kravene er lov, ikke config · «oppretter ser alltid sitt eget dokument»-invarianten · endringslogg.

## Konsekvenser for pågående saker
- Registrator-fiksen: kompletteres med rejected→sent-oppføringen; deretter merge (regresjonen lukket).
- forwarded-egen-sak: løses av vedtak 3 — føres i flytmodell-saken, ikke separat.
- A-3b 1c: perspektivmatrise-nå-rapport måles ETTER at registrator-fiks + vedtak 2/3 er landet.
- Admin-UI-matrisene = ny delplan (design ferdig i § 5a); ordre skrives etter at flytmodell-endringene over er verifisert.

---


1. **«Lukk · trukket» mid-flow (6a kort 1):** eies av BESTILLER + ADMIN, alltid med kommentar (+ bekreftelsesdialog, «Farlig sone» i menyen). rejected → closed forblir kun admin. Matrise-defaults: draft/received/in_progress → cancelled = bestiller, admin.
2. **Død overgang received → in_progress (6a kort 3):** GJENOPPLIVES som automatikk — «Pågår» settes automatisk når utfører først åpner dokumentet, levert AV lesekvittering-mekanismen. Ingen «Start arbeid»-knapp. Overgangen beholdes i statusmaskinen; ingen manuell rolle-oppføring i matrisen.
3. **Lesekvittering (kø-post 7): JA — vedtatt.** Nytte: (a) driver automatisk received → in_progress; (b) grunnlag for e-postvarsel ved MANGLENDE handling (dokument åpnet/ikke åpnet + tid → purring). Personvernvurderingen fra lesekvittering.md gjelder fortsatt for VISNING av «Lest av …» til andre brukere — det som er vedtatt nå er mekanismen + varsling, ikke nødvendigvis synlige lest-markører. Egen delplan: lesekvittering + varselregler (terskler, hvem varsles) designes før ordre.

## Kø-konsekvens
- A-3b Fase A-rutingen («Lest»-etiketten → lesekvittering.md) er nå ublokkert som sak — designes i lesekvittering-delplanen.
- Alle 6a/7a-spørsmål er nå lukket. Flytmodell-vedtaket er komplett; admin-UI-matrise-ordren kan skrives når overgangene (rejected→sent, closed→draft) og registrator-fiksen er landet.
