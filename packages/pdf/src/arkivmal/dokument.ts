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

export function byggArkivDokument(input: ArkivDokumentInput): string {
  const innst = tolkInnstillinger(input.innstillinger, {
    eksport: input.eksport,
    visSidenummer: input.visSidenummer,
  });

  const body = [
    byggTopptekst(input.firma, input.meta, innst),
    byggProsjektblokk(input.prosjektblokk, innst),
    byggStatusblokk(input.statusCeller, input.logg.sistEndret, (iso) => formaterDatoKort(iso)),
    input.innholdHtml,
    byggMangelMerknad(input.manglendeVedlegg ?? []),
    byggLoggseksjon(input.logg, input.taMedEndringslogg ?? true),
    byggSignaturblokk(input.signaturer),
    // Sidetall settes per side av containeren (Stage 4) — utelates i body.
    byggBunntekst(input.meta, input.generertTekst, null),
  ]
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="nb"><head><meta charset="UTF-8"><style>${hentArkivCss()}</style></head>
<body><div class="ark-side">${body}</div></body></html>`;
}
