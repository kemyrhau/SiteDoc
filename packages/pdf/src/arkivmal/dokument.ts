/**
 * Arkivmal — full sammenstilling (Stage 3) for sjekkliste/oppgave/HMS.
 * Rekkefølge (mockup): topptekst → prosjektblokk → statusblokk → innhold →
 * loggseksjon → signaturblokk → bunntekst. Rent standalone HTML-dokument;
 * rendrer-containeren (Stage 4) flytter fortsettelses-header + bunntekst til
 * per-side templates for sporbarhet på hver side.
 *
 * timer/utlegg/kontrollplan sammenstilles i det egne datakilde-steget.
 */

import { formaterDatoKort } from "../hjelpere";
import { hentArkivCss } from "./arkiv-css";
import { tolkInnstillinger } from "./innstillinger";
import { byggTopptekst, byggProsjektblokk, byggStatusblokk, byggBunntekst } from "./ramme";
import { byggLoggseksjon, byggMangelMerknad } from "./loggseksjon";
import { byggSignaturblokk } from "./signatur";
import type { ArkivDokumentInput } from "./typer";

/**
 * Ett dokuments innhold som `.ark-side`-blokk (uten shell/CSS). Skilt fra
 * `byggArkivDokument` slik at flere dokumenter kan slås sammen til ÉN PDF
 * (samleutskrift, N1): hver `.ark-side` starter på ny side (CSS-regel
 * `.ark-side + .ark-side`), og shell + CSS legges på én gang av samleren.
 */
export function byggArkivSide(input: ArkivDokumentInput): string {
  const innst = tolkInnstillinger(input.innstillinger, {
    eksport: input.eksport,
    visSidenummer: input.visSidenummer,
  });

  const body = [
    byggTopptekst(input.firma, input.meta, innst),
    byggProsjektblokk(input.prosjektblokk, innst),
    byggStatusblokk(input.statusCeller, input.logg.sistEndret, (iso) => formaterDatoKort(iso)),
    // D2: dokument-lokasjon (tegningsmarkør) øverst side 1, rett under
    // dokumenthodet — før innholdet. Tom streng filtreres bort av `.filter(Boolean)`.
    input.lokasjonHtml ?? "",
    input.innholdHtml,
    byggMangelMerknad(input.manglendeVedlegg ?? []),
    // D2b (Kenneth-vedtak 2026-08-21): helside(r) tegningsprint I rapportkroppen —
    // innhold → TEGNINGSSIDE(R) → dokumenthistorikk → endringslogg → signatur.
    // `break-before:page` (CSS) gir egen side; historikken fyller arket etterpå
    // (før var arket før tegningssiden halvtomt fordi rapporten sluttet på signatur).
    input.tegningssiderHtml ?? "",
    byggLoggseksjon(input.logg, input.taMedEndringslogg ?? true),
    byggSignaturblokk(input.signaturer),
    // Sidetall settes per side av containeren (Stage 4) — utelates i body.
    byggBunntekst(input.meta, input.generertTekst, null),
  ]
    .filter(Boolean)
    .join("\n");

  return `<div class="ark-side">${body}</div>`;
}

/** HTML-shell (DOCTYPE + CSS) rundt én eller flere `.ark-side`-blokker. */
function medShell(sider: string): string {
  return `<!DOCTYPE html>
<html lang="nb"><head><meta charset="UTF-8"><style>${hentArkivCss()}</style></head>
<body>${sider}</body></html>`;
}

/** Ett standalone dokument (uendret utfall — én `.ark-side` i shell). */
export function byggArkivDokument(input: ArkivDokumentInput): string {
  return medShell(byggArkivSide(input));
}

/**
 * Samleutskrift (N1): flere dokumenters `.ark-side`-blokker i ÉN PDF. Rekkefølge
 * bevares; hver side etter den første tvinges til ny side av CSS-regelen
 * `.ark-side + .ark-side { break-before: page }`. Tom liste → tomt dokument.
 */
export function byggArkivSamling(sider: string[]): string {
  return medShell(sider.join("\n"));
}
