# Flytmodell — siste tre vedtak (Kenneth 2026-07-22, kveld)

TIL REPO: docs/claude/delplaner/flytmodell-vedtak-2026-07-22.md — føyes til som § «Restvedtak» (cowork plasserer; fabel etterleser).

1. **«Lukk · trukket» mid-flow (6a kort 1):** eies av BESTILLER + ADMIN, alltid med kommentar (+ bekreftelsesdialog, «Farlig sone» i menyen). rejected → closed forblir kun admin. Matrise-defaults: draft/received/in_progress → cancelled = bestiller, admin.
2. **Død overgang received → in_progress (6a kort 3):** GJENOPPLIVES som automatikk — «Pågår» settes automatisk når utfører først åpner dokumentet, levert AV lesekvittering-mekanismen. Ingen «Start arbeid»-knapp. Overgangen beholdes i statusmaskinen; ingen manuell rolle-oppføring i matrisen.
3. **Lesekvittering (kø-post 7): JA — vedtatt.** Nytte: (a) driver automatisk received → in_progress; (b) grunnlag for e-postvarsel ved MANGLENDE handling (dokument åpnet/ikke åpnet + tid → purring). Personvernvurderingen fra lesekvittering.md gjelder fortsatt for VISNING av «Lest av …» til andre brukere — det som er vedtatt nå er mekanismen + varsling, ikke nødvendigvis synlige lest-markører. Egen delplan: lesekvittering + varselregler (terskler, hvem varsles) designes før ordre.

## Kø-konsekvens
- A-3b Fase A-rutingen («Lest»-etiketten → lesekvittering.md) er nå ublokkert som sak — designes i lesekvittering-delplanen.
- Alle 6a/7a-spørsmål er nå lukket. Flytmodell-vedtaket er komplett; admin-UI-matrise-ordren kan skrives når overgangene (rejected→sent, closed→draft) og registrator-fiksen er landet.
