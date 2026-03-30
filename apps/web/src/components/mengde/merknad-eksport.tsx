"use client";

import { useState } from "react";
import { Printer, Mail, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface MerknadPost {
  postnr: string | null;
  beskrivelse: string | null;
  eksternNotat: string | null;
  enhet: string | null;
  mengdeAnbud: unknown;
  enhetspris: unknown;
  sumAnbud: unknown;
  document?: { notaNr: number | null; docType: string | null; notaType?: string | null } | null;
}

interface MerknadEksportProps {
  poster: MerknadPost[];
  kontraktNavn: string | null;
  kontraktId: string | null;
  prosjektId: string;
  notaType: string | null;
  notaNr: number | null;
  brukerNavn: string | null;
  entreprenorEpost?: string | null;
}

function fmt(v: unknown): string {
  const n = Number(v);
  if (isNaN(n) || v === null || v === undefined) return "—";
  return n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function genererHtml(
  tittel: string,
  undertittel: string,
  brukerNavn: string | null,
  poster: MerknadPost[],
  grupperPerNota?: boolean,
): string {
  const posterMedMerknad = poster.filter((p) => p.eksternNotat?.trim());
  if (posterMedMerknad.length === 0) return "";

  let innhold = "";

  if (grupperPerNota) {
    // Grupper per nota
    const perNota = new Map<string, MerknadPost[]>();
    for (const p of posterMedMerknad) {
      const notaKey = p.document?.notaType === "Sluttnota"
        ? "Sluttnota"
        : p.document?.docType === "anbudsgrunnlag"
          ? "Anbudsgrunnlag"
          : `A-Nota ${p.document?.notaNr ?? "?"}`;
      if (!perNota.has(notaKey)) perNota.set(notaKey, []);
      perNota.get(notaKey)!.push(p);
    }
    for (const [nota, notas] of perNota) {
      innhold += `<h2 style="font-size:12pt;margin:20px 0 8px;color:#1e40af;border-bottom:1px solid #ccc;padding-bottom:4px;">${nota} (${notas.length} merknad${notas.length !== 1 ? "er" : ""})</h2>`;
      innhold += notas.map((p) => postHtml(p)).join("");
    }
  } else {
    innhold = posterMedMerknad.map((p) => postHtml(p)).join("");
  }

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${tittel}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; max-width: 800px; margin: 40px auto; color: #1a1a1a; }
  h1 { font-size: 14pt; margin-bottom: 2px; }
  h2 { page-break-before: auto; }
  .undertittel { font-size: 11pt; color: #333; margin-bottom: 4px; }
  .meta { font-size: 9pt; color: #666; margin-bottom: 24px; }
  .post { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #ddd; }
  .postnr { font-weight: bold; font-size: 11pt; }
  .beskrivelse { font-size: 9pt; color: #555; margin: 2px 0 6px; }
  .verdier { font-size: 9pt; color: #444; margin-bottom: 6px; }
  .merknad { background: #f8f8f0; padding: 8px 12px; border-left: 3px solid #1e40af; font-size: 10pt; white-space: pre-wrap; }
  @media print { body { margin: 20px; } }
</style>
</head><body>
<h1>${tittel}</h1>
${undertittel ? `<div class="undertittel">${undertittel}</div>` : ""}
<div class="meta">Utarbeidet av: ${brukerNavn ?? "—"} | Dato: ${new Date().toLocaleDateString("nb-NO")} | Antall merknader: ${posterMedMerknad.length}</div>
${innhold}
</body></html>`;
}

function postHtml(p: MerknadPost): string {
  return `<div class="post">
  <div class="postnr">Post ${p.postnr}</div>
  <div class="beskrivelse">${(p.beskrivelse ?? "").slice(0, 120)}</div>
  ${p.enhet ? `<div class="verdier">Enhet: ${p.enhet} | Mengde: ${fmt(p.mengdeAnbud)} | Enhetspris: ${fmt(p.enhetspris)} | Sum: ${fmt(p.sumAnbud)}</div>` : ""}
  <div class="merknad">${(p.eksternNotat ?? "").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>
</div>`;
}

function genererTekst(tittel: string, brukerNavn: string | null, poster: MerknadPost[]): string {
  const posterMedMerknad = poster.filter((p) => p.eksternNotat?.trim());
  const linjer: string[] = [
    tittel,
    `Utarbeidet av: ${brukerNavn ?? "—"}`,
    `Dato: ${new Date().toLocaleDateString("nb-NO")}`,
    "", "---", "",
  ];
  for (const p of posterMedMerknad) {
    linjer.push(`Post ${p.postnr}`);
    linjer.push(`Beskrivelse: ${(p.beskrivelse ?? "").slice(0, 100)}`);
    if (p.enhet) linjer.push(`Enhet: ${p.enhet} | Mengde: ${fmt(p.mengdeAnbud)} | Enhetspris: ${fmt(p.enhetspris)} | Sum: ${fmt(p.sumAnbud)}`);
    linjer.push("", `Merknad: ${p.eksternNotat}`, "", "---", "");
  }
  return linjer.join("\n");
}

function åpneUtskrift(html: string) {
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export function MerknadEksport({
  poster,
  kontraktNavn,
  kontraktId,
  prosjektId,
  notaType,
  notaNr,
  brukerNavn,
  entreprenorEpost,
}: MerknadEksportProps) {
  const [henterAlle, setHenterAlle] = useState(false);
  const posterMedMerknad = poster.filter((p) => p.eksternNotat?.trim());

  const allePosterQuery = trpc.mengde.hentSpecPoster.useQuery(
    { projectId: prosjektId, kontraktId: kontraktId ?? undefined },
    { enabled: false }, // Kun manuelt
  );

  const notaLabel = notaType === "Sluttnota" ? "Sluttnota" : `${notaType ?? "A-Nota"} ${notaNr ?? ""}`.trim();
  const kontrakt = kontraktNavn ?? "Kontrakt";
  const emneDenne = `${kontrakt} - Kommentar til ${notaLabel}`;
  const emneAlle = `${kontrakt} - Alle merknader`;

  function skrivUtDenne() {
    const html = genererHtml(emneDenne, "", brukerNavn, poster);
    if (html) åpneUtskrift(html);
  }

  function sendEpostDenne() {
    const tekst = genererTekst(emneDenne, brukerNavn, poster);
    window.open(`mailto:${entreprenorEpost ?? ""}?subject=${encodeURIComponent(emneDenne)}&body=${encodeURIComponent(tekst)}`, "_self");
  }

  async function skrivUtAlle() {
    setHenterAlle(true);
    try {
      const data = await allePosterQuery.refetch();
      const alle = (data.data ?? []) as MerknadPost[];
      const html = genererHtml(emneAlle, kontrakt, brukerNavn, alle, true);
      if (html) åpneUtskrift(html);
      else alert("Ingen merknader funnet for denne kontrakten.");
    } finally {
      setHenterAlle(false);
    }
  }

  if (posterMedMerknad.length === 0 && !kontraktId) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-2 mt-2">
      {posterMedMerknad.length > 0 && (
        <>
          <span className="text-xs text-gray-400">{posterMedMerknad.length} merknad{posterMedMerknad.length !== 1 ? "er" : ""}</span>
          <button onClick={skrivUtDenne} className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50" title="Skriv ut merknader for denne nota">
            <Printer className="h-3 w-3" /> Skriv ut
          </button>
          <button onClick={sendEpostDenne} className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50" title="Send merknader på e-post">
            <Mail className="h-3 w-3" /> E-post
          </button>
        </>
      )}
      {kontraktId && (
        <button
          onClick={skrivUtAlle}
          disabled={henterAlle}
          className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          title="Skriv ut alle merknader for kontrakten (alle notas)"
        >
          <FileText className="h-3 w-3" />
          {henterAlle ? "Henter..." : "Alle merknader"}
        </button>
      )}
    </div>
  );
}
