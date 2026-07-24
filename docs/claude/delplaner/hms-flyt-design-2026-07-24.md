---
name: hms-flyt-design
status: 🟡 DESIGNRETNING 2026-07-24 — HMS-modellen (Kenneth-diskusjon) målt mot kode. Synlighet finnes; gap = svar-løpet. Cowork måler nå-tilstand før ordre.
eier: fabel (design) · cowork (kode-måling) · Kenneth (vedtak H3)
TIL REPO: docs/claude/delplaner/hms-flyt-design-2026-07-24.md
---

# HMS-flyten — Kenneths modell mot koden

Visuelt kart: designprosjektet, «Flyt-binding Beslutningskart.dc.html» (2a).
Kenneth-krav (RUH, 2026-07-24): alle kan sende · oppretter leser og kan tilføye informasjon etterpå · HMS-admin leser og besvarer med begrunnelse · ingen andre kan lese · ingen godkjenningsløp · synlighet varierer per mal.

## H1 — Dette FINNES allerede (kodemålt, develop)

- **Synlighet per mal:** `hmsSynlighet: "privat" | "apen"` (mal.ts:104), radio-innstilling per HMS-mal i mal-admin (MalListe.tsx), default privat.
- **Privat = RUH-kravet:** `byggHmsSynlighetsFilter` (hms.ts:18) gir lesetilgang kun til oppretter (`bestillerUserId`), mottaker, HMS-gruppe-medlem, firma-`hms_ansvarlig`, admin.
- **Alle kan sende:** HMS-opprettelse krever kun prosjektmedlemskap (sjekkliste.ts:170) — ingen faggruppe.
- **Auto-ruting** til prosjektets HMS-gruppe; **ingen godkjenningsløp** (HMS står utenfor dokumentflyt/rolle-matrisen).

→ Trenger kun klikktest-verifisering (privat mal ende-til-ende med ikke-admin), ikke bygging.

## H2 — Gapet: svar-løpet (melding → svar, ikke flyt)

Kenneths modell er en to-parts meldingssløyfe:
1. **Sendt** — oppretter kan «Tilføy informasjon» (kommentar/vedlegg, aldri redigere det sendte).
2. **Besvart** — HMS-admin svarer med **obligatorisk begrunnelse**; oppretter varsles.

**Ikke kodemålt — cowork måler før ordre:** finnes «tilføy informasjon»-mekanikk og et besvar-steg med begrunnelse for HMS-dokumenter i dag, eller går HMS gjennom den generelle sjekkliste-statusmaskinen? Hvilke statuser/handlinger tilbys et HMS-dokument nå?

## H3 — Konsekvens for F1 (B1) + pilot-innstilling

- **Vedtak A bekreftes:** HMS skal ikke inn i dokumentflyt; `dokumentflytId` påkrevd kun i standard-grenen. Detaljer i flyt-binding-design-2026-07-24.md § B1.
- **Pilot-innstilling (fabels kall, Kenneth delegerte):** F1/B1–B4 låses og kodes NÅ (grunnmur for rolle-for-rolle-testen). HMS-sporet kjøres parallelt som eget, mindre løp: (1) klikktest privat-synlighet, (2) cowork måler svar-løpets nå-tilstand, (3) evt. liten ordre på «Besvar med begrunnelse» / «Tilføy informasjon». HMS skal ikke forsinke F1→F4.

## Åpent

- Kenneth: vedta H3 (pilot-sekvensering) + bekrefte H2-retningen.
- cowork: mål HMS-svar-løpets nå-tilstand (statuser, handlinger, kommentar-mekanikk) + klikktest-plan for privat-synlighet.
