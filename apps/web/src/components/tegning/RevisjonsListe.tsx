"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@sitedoc/ui";
import { byggTegningNedlastingsnavn } from "@sitedoc/shared";
import { History, Download } from "lucide-react";
import { useSignertLenkeApner } from "@/components/SignertLenke";

/**
 * D6b (DWG-2): kompakt liste over TIDLIGERE revisjoner på tegningssiden. Klikk åpner
 * forrige fil skrivebeskyttet i en modal — inkludert DWG-layouts arkivert med revisjonen
 * (`layouter`, D6/Q3). Markører vises IKKE på gamle revisjoner; de hører til gjeldende.
 *
 * Rent lesende: ingen mutasjon, ingen egen spørring. `revisjoner` kommer fra
 * `tegning.hentMedId` (som allerede inkluderer revisjonshistorikken). Ny revisjon lastes
 * opp via `LastOppRevisjonKnapp` (egen flyt).
 */
type ArkivertLayout = { layoutNavn: string | null; fileUrl: string };

export type RevisjonRad = {
  id: string;
  revision: string;
  version: number;
  fileUrl: string;
  createdAt: string | Date;
  uploadedBy?: { name: string | null; email: string | null } | null;
  layouter?: unknown;
};

/** SVG/PNG/JPG vises som bilde, PDF i iframe, annet som nedlastingslenke. */
function erBildeUrl(url: string): boolean {
  return /\.(svg|png|jpe?g|gif|webp)$/i.test(url);
}
function erPdfUrl(url: string): boolean {
  return /\.pdf$/i.test(url);
}

/** Trygt les `layouter`-JSON til en liste (tåler null/ukjent form). */
function lesLayouter(verdi: unknown): ArkivertLayout[] {
  if (!Array.isArray(verdi)) return [];
  return verdi.flatMap((l) =>
    l && typeof l === "object" && typeof (l as { fileUrl?: unknown }).fileUrl === "string"
      ? [{ layoutNavn: (l as { layoutNavn?: string | null }).layoutNavn ?? null, fileUrl: (l as { fileUrl: string }).fileUrl }]
      : [],
  );
}

function FilVisning({ url, alt }: { url: string; alt: string }) {
  if (erBildeUrl(url)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className="max-h-[60vh] w-full object-contain" />;
  }
  if (erPdfUrl(url)) {
    return <iframe src={url} title={alt} className="h-[60vh] w-full border-0" />;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sitedoc-primary underline">
      {alt}
    </a>
  );
}

export function RevisjonsListe({
  revisjoner,
  tegningsnummer,
  tegningNavn,
}: {
  revisjoner: RevisjonRad[];
  /** For nedlastings-filnavnet (tegningsnummer_revX.endelse). */
  tegningsnummer?: string | null;
  tegningNavn?: string;
}) {
  const { t } = useTranslation();
  const [valgt, setValgt] = useState<RevisjonRad | null>(null);
  // Nedlasting av den ARKIVERTE revisjonsfila. For DWG/DXF er dette den konverterte
  // SVG-en (originalen arkiveres ikke pr. revisjon); for PDF/bilde er det selve fila.
  const apneNedlasting = useSignertLenkeApner(valgt?.fileUrl ? [valgt.fileUrl] : []);

  if (!revisjoner || revisjoner.length === 0) return null;

  const arkiverteLayouts = valgt ? lesLayouter(valgt.layouter) : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
        <History className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-gray-500">{t("tegninger.revisjon.tidligere")}:</span>
        {revisjoner.map((r) => (
          <button
            key={r.id}
            onClick={() => setValgt(r)}
            className="rounded border border-gray-300 px-1.5 py-0.5 text-gray-700 hover:bg-gray-100"
            title={t("tegninger.revisjon.visning", { rev: r.revision })}
          >
            {r.revision}
          </button>
        ))}
      </div>

      <Modal
        open={!!valgt}
        onClose={() => setValgt(null)}
        title={valgt ? t("tegninger.revisjon.visning", { rev: valgt.revision }) : ""}
      >
        {valgt && (
          <div className="flex flex-col gap-4">
            {valgt.fileUrl ? (
              <>
                <FilVisning url={valgt.fileUrl} alt={t("tegninger.revisjon.visning", { rev: valgt.revision })} />
                <button
                  onClick={() =>
                    apneNedlasting(valgt.fileUrl, {
                      download: byggTegningNedlastingsnavn({
                        tegningsnummer,
                        navn: tegningNavn ?? t("tegninger.revisjon.visning", { rev: valgt.revision }),
                        revisjon: valgt.revision,
                        fileUrl: valgt.fileUrl,
                      }),
                    })
                  }
                  className="flex items-center gap-1 self-start rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("handling.lastNed")}
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500">{t("tegninger.revisjon.ingenFil")}</p>
            )}

            {arkiverteLayouts.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-gray-200 pt-3">
                <span className="text-xs font-medium text-gray-700">
                  {t("tegninger.revisjon.arkiverteLayouts")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {arkiverteLayouts.map((l, i) => (
                    <a
                      key={`${l.fileUrl}-${i}`}
                      href={l.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-gray-300 px-2 py-1 text-xs text-sitedoc-primary hover:bg-gray-50"
                    >
                      {l.layoutNavn ?? l.fileUrl.split("/").pop()}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
