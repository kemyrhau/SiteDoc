"use client";

import { Printer, Mail } from "lucide-react";

interface MerknadEksportProps {
  poster: Array<{
    postnr: string | null;
    beskrivelse: string | null;
    eksternNotat: string | null;
    enhet: string | null;
    mengdeAnbud: unknown;
    enhetspris: unknown;
    sumAnbud: unknown;
  }>;
  kontraktNavn: string | null;
  notaType: string | null;
  notaNr: number | null;
  brukerNavn: string | null;
  entreprenorEpost?: string | null;
}

export function MerknadEksport({
  poster,
  kontraktNavn,
  notaType,
  notaNr,
  brukerNavn,
  entreprenorEpost,
}: MerknadEksportProps) {
  const posterMedMerknad = poster.filter((p) => p.eksternNotat?.trim());

  if (posterMedMerknad.length === 0) return null;

  const notaLabel = notaType === "Sluttnota" ? "Sluttnota" : `${notaType ?? "A-Nota"} ${notaNr ?? ""}`.trim();
  const emne = `${kontraktNavn ?? "Kontrakt"} - Kommentar til ${notaLabel}`;

  function fmt(v: unknown): string {
    const n = Number(v);
    if (isNaN(n) || v === null || v === undefined) return "—";
    return n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function genererTekst(): string {
    const linjer: string[] = [];
    linjer.push(emne);
    linjer.push(`Utarbeidet av: ${brukerNavn ?? "—"}`);
    linjer.push(`Dato: ${new Date().toLocaleDateString("nb-NO")}`);
    linjer.push("");
    linjer.push("---");
    linjer.push("");

    for (const p of posterMedMerknad) {
      linjer.push(`Post ${p.postnr}`);
      linjer.push(`Beskrivelse: ${(p.beskrivelse ?? "").slice(0, 100)}`);
      if (p.enhet) linjer.push(`Enhet: ${p.enhet} | Mengde: ${fmt(p.mengdeAnbud)} | Enhetspris: ${fmt(p.enhetspris)} | Sum: ${fmt(p.sumAnbud)}`);
      linjer.push("");
      linjer.push(`Merknad: ${p.eksternNotat}`);
      linjer.push("");
      linjer.push("---");
      linjer.push("");
    }

    return linjer.join("\n");
  }

  function skrivUt() {
    const tekst = genererTekst();
    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${emne}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; max-width: 800px; margin: 40px auto; color: #1a1a1a; }
  h1 { font-size: 14pt; margin-bottom: 4px; }
  .meta { font-size: 9pt; color: #666; margin-bottom: 24px; }
  .post { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #ddd; }
  .postnr { font-weight: bold; font-size: 11pt; }
  .beskrivelse { font-size: 9pt; color: #555; margin: 2px 0 6px; }
  .verdier { font-size: 9pt; color: #444; margin-bottom: 6px; }
  .merknad { background: #f8f8f0; padding: 8px 12px; border-left: 3px solid #1e40af; font-size: 10pt; white-space: pre-wrap; }
  @media print { body { margin: 20px; } }
</style>
</head><body>
<h1>${emne}</h1>
<div class="meta">Utarbeidet av: ${brukerNavn ?? "—"} | Dato: ${new Date().toLocaleDateString("nb-NO")} | Antall poster: ${posterMedMerknad.length}</div>
${posterMedMerknad.map((p) => `
<div class="post">
  <div class="postnr">Post ${p.postnr}</div>
  <div class="beskrivelse">${(p.beskrivelse ?? "").slice(0, 120)}</div>
  ${p.enhet ? `<div class="verdier">Enhet: ${p.enhet} | Mengde: ${fmt(p.mengdeAnbud)} | Enhetspris: ${fmt(p.enhetspris)} | Sum: ${fmt(p.sumAnbud)}</div>` : ""}
  <div class="merknad">${(p.eksternNotat ?? "").replace(/\n/g, "<br>")}</div>
</div>`).join("")}
</body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  }

  function sendEpost() {
    const brødtekst = genererTekst();
    const mailto = `mailto:${entreprenorEpost ?? ""}?subject=${encodeURIComponent(emne)}&body=${encodeURIComponent(brødtekst)}`;
    window.open(mailto, "_self");
  }

  return (
    <div className="flex items-center gap-2 border-t pt-2 mt-2">
      <span className="text-xs text-gray-400">{posterMedMerknad.length} merknad{posterMedMerknad.length !== 1 ? "er" : ""}</span>
      <button
        onClick={skrivUt}
        className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        title="Skriv ut merknader som PDF"
      >
        <Printer className="h-3 w-3" />
        Skriv ut
      </button>
      <button
        onClick={sendEpost}
        className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        title="Send merknader på e-post"
      >
        <Mail className="h-3 w-3" />
        E-post
      </button>
    </div>
  );
}
