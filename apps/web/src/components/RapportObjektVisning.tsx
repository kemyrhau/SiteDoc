"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { normaliserOpsjon } from "./rapportobjekter/typer";
import type { RapportObjekt } from "./rapportobjekter/typer";
import { formaterDato, formaterDatoTid } from "@sitedoc/pdf";
import type { VaerVerdi } from "@sitedoc/pdf";

// Trafikklys-farge → label + CSS-klasse (web bruker Tailwind-klasser, ikke hex)
const TRAFIKKLYS: Record<string, { label: string; klasse: string }> = {
  green: { label: "Godkjent", klasse: "bg-green-500" },
  yellow: { label: "Anmerkning", klasse: "bg-yellow-400" },
  red: { label: "Avvik", klasse: "bg-red-500" },
  gray: { label: "Ikke relevant", klasse: "bg-gray-400" },
};

interface TreObjekt extends RapportObjekt {
  children: TreObjekt[];
}

export interface TegningPosisjonVerdi {
  drawingId?: string;
  positionX?: number;
  positionY?: number;
  drawingName?: string;
}

/* ------------------------------------------------------------------ */
/*  Felt-label + verdi-wrapper                                         */
/* ------------------------------------------------------------------ */

function FeltRad({
  label,
  children,
  tom,
}: {
  label: string;
  children: React.ReactNode;
  tom?: boolean;
}) {
  if (tom) return null;
  return (
    <div className="print-no-break py-2">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedkomponent                                                     */
/* ------------------------------------------------------------------ */

export function RapportObjektVisning({
  objekt,
  verdi,
  nestingNivå = 0,
  data,
  prosjektAdresse,
}: {
  objekt: TreObjekt;
  verdi: unknown;
  nestingNivå?: number;
  data?: Record<string, { verdi?: unknown }>;
  /** Prosjektadresse — brukes for location-felt som ikke lagres i data */
  prosjektAdresse?: string | null;
}) {
  const marginKlasse =
    nestingNivå === 1
      ? "ml-4"
      : nestingNivå === 2
        ? "ml-8"
        : nestingNivå >= 3
          ? "ml-12"
          : "";

  return (
    <div className={marginKlasse}>
      <ObjektInnhold objekt={objekt} verdi={verdi} data={data} prosjektAdresse={prosjektAdresse} />
      {objekt.children.length > 0 && (
        <div className="mt-1">
          {objekt.children.map((barn) => {
            const barnVerdi = data?.[barn.id]?.verdi ?? null;
            return (
              <RapportObjektVisning
                key={barn.id}
                objekt={barn}
                verdi={barnVerdi}
                nestingNivå={nestingNivå + 1}
                data={data}
                prosjektAdresse={prosjektAdresse}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Vedlegg + kommentar for repeater-barn                               */
/* ------------------------------------------------------------------ */

function vedleggSrc(url: string): string {
  if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/uploads/")) return `/api/uploads${url.replace("/uploads", "")}`;
  return url;
}

function RepeaterBarnVedlegg({
  vedlegg,
  kommentar,
}: {
  vedlegg: Array<{ id: string; type: string; url: string; filnavn: string; opprettet?: string }>;
  kommentar: string;
}) {
  const harVedlegg = vedlegg.length > 0;
  const harKommentar = kommentar.length > 0;
  if (!harVedlegg && !harKommentar) return null;

  const bilder = vedlegg.filter((v) => v.type === "bilde" || /\.(png|jpg|jpeg|gif|webp)$/i.test(v.filnavn));
  const filer = vedlegg.filter((v) => !bilder.includes(v));

  return (
    <div className="mt-1 border-t border-gray-100 pt-1">
      {harKommentar && (
        <p className="text-xs italic text-gray-500">{kommentar}</p>
      )}
      {bilder.length > 0 && (
        <div className="mt-1 grid grid-cols-2 gap-3">
          {bilder.map((bilde) => (
            <div key={bilde.id}>
              <img
                src={vedleggSrc(bilde.url)}
                alt={bilde.filnavn}
                className="w-full rounded border border-gray-200 object-cover"
                style={{ aspectRatio: "5/4" }}
              />
              {bilde.opprettet && (
                <p className="mt-0.5 text-[10px] text-gray-400">
                  {new Date(bilde.opprettet).toLocaleString("nb-NO")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {filer.length > 0 && (
        <p className="mt-1 text-xs text-gray-600">
          Filer: {filer.map((f) => f.filnavn).join(", ")}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Type-spesifikk rendering                                           */
/* ------------------------------------------------------------------ */

function ObjektInnhold({
  objekt,
  verdi,
  data,
  prosjektAdresse,
}: {
  objekt: TreObjekt;
  verdi: unknown;
  data?: Record<string, { verdi?: unknown }>;
  prosjektAdresse?: string | null;
}) {
  const { type, label } = objekt;

  switch (type) {
    case "heading":
      return (
        <h3 className="mt-4 border-b border-gray-200 pb-1 text-base font-semibold text-gray-900">
          {label}
        </h3>
      );

    case "subtitle":
      return (
        <h4 className="mt-2 text-sm font-medium text-gray-700">{label}</h4>
      );

    case "text_field": {
      const tekst = typeof verdi === "string" ? verdi : "";
      return (
        <FeltRad label={label} tom={!tekst}>
          <p className="whitespace-pre-wrap text-sm text-gray-900">{tekst}</p>
        </FeltRad>
      );
    }

    case "list_single": {
      const råOpsjoner = (objekt.config.options as unknown[]) ?? [];
      const alternativer = råOpsjoner.map(normaliserOpsjon);
      const valgt =
        typeof verdi === "string"
          ? alternativer.find((a) => a.value === verdi)?.label ?? verdi
          : null;
      return (
        <FeltRad label={label} tom={!valgt}>
          <p className="text-sm text-gray-900">{valgt}</p>
        </FeltRad>
      );
    }

    case "list_multi": {
      const råOpsjoner = (objekt.config.options as unknown[]) ?? [];
      const alternativer = råOpsjoner.map(normaliserOpsjon);
      const valgte = Array.isArray(verdi)
        ? (verdi as string[])
            .map((v) => alternativer.find((a) => a.value === v)?.label ?? v)
            .join(", ")
        : null;
      return (
        <FeltRad label={label} tom={!valgte}>
          <p className="text-sm text-gray-900">{valgte}</p>
        </FeltRad>
      );
    }

    case "traffic_light": {
      const farge = typeof verdi === "string" ? verdi : null;
      const tl = farge ? TRAFIKKLYS[farge] : null;
      return (
        <FeltRad label={label} tom={!tl}>
          {tl && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-4 w-4 rounded-full ${tl.klasse}`}
              />
              <span className="text-sm text-gray-900">{tl.label}</span>
            </div>
          )}
        </FeltRad>
      );
    }

    case "integer":
    case "decimal": {
      const tall = verdi != null ? String(verdi) : "";
      const enhet = (objekt.config.unit as string) ?? "";
      return (
        <FeltRad label={label} tom={!tall}>
          <p className="text-sm text-gray-900">
            {tall}
            {enhet ? ` ${enhet}` : ""}
          </p>
        </FeltRad>
      );
    }

    case "calculation": {
      const resultat = verdi != null ? String(verdi) : "";
      const enhet = (objekt.config.unit as string) ?? "";
      return (
        <FeltRad label={label} tom={!resultat}>
          <p className="text-sm text-gray-900">
            {resultat}
            {enhet ? ` ${enhet}` : ""}
          </p>
        </FeltRad>
      );
    }

    case "date": {
      return (
        <FeltRad label={label} tom={!verdi}>
          <p className="text-sm text-gray-900">{formaterDato(verdi)}</p>
        </FeltRad>
      );
    }

    case "date_time": {
      return (
        <FeltRad label={label} tom={!verdi}>
          <p className="text-sm text-gray-900">{formaterDatoTid(verdi)}</p>
        </FeltRad>
      );
    }

    case "person": {
      const navn = typeof verdi === "string" ? verdi : "";
      return (
        <FeltRad label={label} tom={!navn}>
          <p className="text-sm text-gray-900">{navn}</p>
        </FeltRad>
      );
    }

    case "persons": {
      const personer = Array.isArray(verdi) ? (verdi as string[]).join(", ") : "";
      return (
        <FeltRad label={label} tom={!personer}>
          <p className="text-sm text-gray-900">{personer}</p>
        </FeltRad>
      );
    }

    case "company": {
      const firma = typeof verdi === "string" ? verdi : "";
      return (
        <FeltRad label={label} tom={!firma}>
          <p className="text-sm text-gray-900">{firma}</p>
        </FeltRad>
      );
    }

    case "attachments": {
      const vedlegg = Array.isArray(verdi) ? (verdi as Array<{ id?: string; url?: string; filnavn?: string; type?: string; opprettet?: string }>) : [];
      const bilder = vedlegg.filter((v) => v.type === "bilde" || /\.(png|jpg|jpeg|gif|webp)$/i.test(v.filnavn ?? ""));
      const filer = vedlegg.filter((v) => !bilder.includes(v));
      return (
        <FeltRad label={label} tom={vedlegg.length === 0}>
          <div>
            {bilder.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {bilder.map((bilde, idx) => {
                  const url = bilde.url ?? "";
                  const src = url.startsWith("/uploads/") ? `/api/uploads${url.replace("/uploads", "")}` : url;
                  return (
                    <div key={bilde.id ?? idx}>
                      <img
                        src={src}
                        alt={bilde.filnavn ?? "Vedlegg"}
                        className="w-full rounded border border-gray-200 object-cover"
                        style={{ aspectRatio: "5/4" }}
                      />
                      {bilde.opprettet && (
                        <p className="mt-0.5 text-[10px] text-gray-400">
                          {new Date(bilde.opprettet).toLocaleString("nb-NO")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {filer.length > 0 && (
              <p className="mt-1 text-sm text-gray-600">
                {filer.map((f) => f.filnavn).join(", ")}
              </p>
            )}
          </div>
        </FeltRad>
      );
    }

    case "weather": {
      const v = (verdi as VaerVerdi) ?? {};
      const deler: string[] = [];
      if (v.temp) deler.push(v.temp);
      if (v.conditions) deler.push(v.conditions);
      if (v.wind) deler.push(`Vind ${v.wind}`);
      if (v.precipitation) deler.push(`Nedbør ${v.precipitation}`);
      const tekst = deler.join(", ");
      return (
        <FeltRad label={label} tom={!tekst}>
          <p className="text-sm text-gray-900">{tekst}</p>
        </FeltRad>
      );
    }

    case "signature": {
      const harSignatur = typeof verdi === "string" && verdi.length > 0;
      return (
        <FeltRad label={label} tom={!harSignatur}>
          {harSignatur ? (
            <img
              src={verdi as string}
              alt="Signatur"
              className="max-h-[80px]"
            />
          ) : null}
        </FeltRad>
      );
    }

    case "location": {
      const tekst = typeof verdi === "string" && verdi ? verdi : (prosjektAdresse ?? "");
      return (
        <FeltRad label={label} tom={!tekst}>
          <p className="text-sm text-gray-900">{tekst}</p>
        </FeltRad>
      );
    }

    case "drawing_position": {
      const pos = verdi as TegningPosisjonVerdi | null;
      if (!pos?.drawingId) {
        return <FeltRad label={label} tom>{null}</FeltRad>;
      }
      return (
        <FeltRad label={label}>
          <TegningPosisjonPrint pos={pos} />
        </FeltRad>
      );
    }

    case "repeater": {
      const repeaterRader = Array.isArray(verdi) ? (verdi as Array<Record<string, { verdi?: unknown; kommentar?: string; vedlegg?: Array<{ id: string; type: string; url: string; filnavn: string; opprettet?: string }> }>>) : [];
      const repeaterBarn = objekt.children ?? [];

      if (repeaterRader.length === 0) {
        return <FeltRad label={label} tom>{null}</FeltRad>;
      }

      return (
        <div className="print-no-break py-2">
          <p className="mb-2 text-xs font-medium text-gray-500">{label}</p>
          <div className="flex flex-col gap-2">
            {repeaterRader.map((rad, radIdx) => (
              <div key={radIdx} className="rounded border border-gray-200 px-3 py-2">
                <p className="mb-1 text-[11px] font-semibold text-gray-400">{radIdx + 1} {label}</p>
                {repeaterBarn.map((barn) => {
                  const feltData = rad[barn.id];
                  const barnVerdi = feltData?.verdi ?? null;
                  const barnVedlegg = feltData?.vedlegg ?? [];
                  const barnKommentar = feltData?.kommentar ?? "";
                  return (
                    <div key={barn.id}>
                      <RapportObjektVisning
                        objekt={barn}
                        verdi={barnVerdi}
                        nestingNivå={0}
                        data={data}
                        prosjektAdresse={prosjektAdresse}
                      />
                      <RepeaterBarnVedlegg vedlegg={barnVedlegg} kommentar={barnKommentar} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      );
    }

    default: {
      const tekstVerdi = verdi != null ? String(verdi) : "";
      return (
        <FeltRad label={label} tom={!tekstVerdi}>
          <p className="text-sm text-gray-900">{tekstVerdi}</p>
        </FeltRad>
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Tegningsposisjon — oversikt + detalj                               */
/* ------------------------------------------------------------------ */

const DETALJ_ZOOM = 4;
const BILDE_TYPER = ["png", "jpg", "jpeg", "gif", "webp"];

/** Rendrer første side av en PDF/bilde til en data-URL via canvas */
function useTegningSomBilde(url: string | null, erPdf: boolean): string | null {
  const [bildeUrl, setBildeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let avbrutt = false;

    if (!erPdf) {
      // Bilde — last inn og konverter til data-URL for pålitelighet
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (avbrutt) return;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        setBildeUrl(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        // Fallback: bruk URL direkte
        if (!avbrutt) setBildeUrl(url);
      };
      img.src = url;
      return () => { avbrutt = true; };
    }

    // PDF — rendre med pdfjs-dist v4
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const pdf = await pdfjsLib.getDocument(url).promise;
        const side = await pdf.getPage(1);
        const viewport = side.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await side.render({ canvasContext: ctx, viewport }).promise;
        if (!avbrutt) {
          setBildeUrl(canvas.toDataURL("image/png"));
        }
      } catch (e) {
        console.error("Kunne ikke rendre PDF til bilde:", e);
        if (!avbrutt) setBildeUrl("error:" + String(e));
      }
    })();

    return () => { avbrutt = true; };
  }, [url, erPdf]);

  return bildeUrl;
}

const DETALJ_UTSNITT = 0.125; // 12.5% av bildet
const DETALJ_TIMEOUT = 3000; // Fallback etter 3s

/** Generer detalj-utsnitt via canvas — med fallback til oversiktsbilde */
function useDetaljCanvas(bildeSrc: string | null, posX: number, posY: number): { url: string | null; klar: boolean } {
  const [detaljUrl, setDetaljUrl] = useState<string | null>(null);
  const [klar, setKlar] = useState(false);

  useEffect(() => {
    if (!bildeSrc || bildeSrc.startsWith("error")) {
      setKlar(true);
      return;
    }
    let avbrutt = false;
    setDetaljUrl(null);
    setKlar(false);

    console.log("[useDetaljCanvas] Starter for bildeSrc lengde:", bildeSrc.length, "posX:", posX, "posY:", posY);

    // Fallback-timer: etter 3s markér som klar uten detalj
    const fallbackTimer = setTimeout(() => {
      if (!avbrutt && !klar) {
        console.warn("[useDetaljCanvas] Timeout — bruker fallback");
        setKlar(true);
      }
    }, DETALJ_TIMEOUT);

    const img = new Image();
    if (bildeSrc.startsWith("http")) img.crossOrigin = "anonymous";

    img.onload = () => {
      if (avbrutt) return;
      console.log("[useDetaljCanvas] Bilde lastet:", img.naturalWidth, "x", img.naturalHeight);
      try {
        const ow = img.naturalWidth;
        const oh = img.naturalHeight;
        if (ow === 0 || oh === 0) { setKlar(true); return; }

        const dw = 800;
        const dh = Math.round(dw / (ow / oh));
        const canvas = document.createElement("canvas");
        canvas.width = dw;
        canvas.height = dh;
        const ctx = canvas.getContext("2d")!;

        const srcW = ow * DETALJ_UTSNITT;
        const srcH = oh * DETALJ_UTSNITT;
        const srcCx = (posX / 100) * ow;
        const srcCy = (posY / 100) * oh;
        const srcX = Math.max(0, Math.min(ow - srcW, srcCx - srcW / 2));
        const srcY = Math.max(0, Math.min(oh - srcH, srcCy - srcH / 2));

        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dw, dh);

        const dpx = ((srcCx - srcX) / srcW) * dw;
        const dpy = ((srcCy - srcY) / srcH) * dh;
        const r = Math.max(8, dw / 60);
        ctx.beginPath(); ctx.arc(dpx, dpy, r + 3, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();
        ctx.beginPath(); ctx.arc(dpx, dpy, r, 0, Math.PI * 2); ctx.fillStyle = "#ef4444"; ctx.fill();

        const resultat = canvas.toDataURL("image/png");
        console.log("[useDetaljCanvas] Generert OK, lengde:", resultat.length);
        if (!avbrutt) { setDetaljUrl(resultat); setKlar(true); }
      } catch (e) {
        console.warn("[useDetaljCanvas] Canvas feilet:", e);
        if (!avbrutt) setKlar(true);
      }
    };

    img.onerror = (e) => {
      console.warn("[useDetaljCanvas] img.onerror:", e);
      if (!avbrutt) setKlar(true);
    };

    img.src = bildeSrc;

    return () => { avbrutt = true; clearTimeout(fallbackTimer); };
  }, [bildeSrc, posX, posY]);

  return { url: detaljUrl, klar };
}

export function TegningPosisjonPrint({ pos }: { pos: TegningPosisjonVerdi }) {
  const { data: tegning } = trpc.tegning.hentMedId.useQuery(
    { id: pos.drawingId! },
    { enabled: !!pos.drawingId },
  );

  const x = pos.positionX ?? 50;
  const y = pos.positionY ?? 50;
  const drawingName = pos.drawingName ?? "";

  const fileUrl = tegning?.fileUrl
    ? tegning.fileUrl.startsWith("/uploads/")
      ? `/api/uploads${tegning.fileUrl.replace("/uploads", "")}`
      : tegning.fileUrl
    : null;

  const fileType = (tegning as { fileType?: string } | undefined)?.fileType?.toLowerCase() ?? "";
  const erPdf = fileType === "pdf";

  // Rendre tegning til data-URL (PDF via pdfjs-dist, bilder via canvas)
  const bildeSrc = useTegningSomBilde(fileUrl, erPdf);

  // Canvas-generert detalj-utsnitt (hook må kalles ALLTID, før tidlige returns)
  const { url: detaljSrc, klar: detaljKlar } = useDetaljCanvas(bildeSrc, x, y);

  const tegningNummer = (tegning as { drawingNumber?: string | null } | undefined)?.drawingNumber;
  const visNavn = tegningNummer ?? drawingName;

  if (!fileUrl) {
    return <p className="text-sm text-gray-900">{visNavn}</p>;
  }

  if (!bildeSrc) {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700">{visNavn}</p>
        <p className="mt-1 text-xs text-gray-400">Laster tegning…</p>
      </div>
    );
  }

  if (bildeSrc?.startsWith("error")) {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700">{visNavn}</p>
        <p className="mt-1 text-xs text-red-400">Kunne ikke laste tegning</p>
        <p className="mt-0.5 text-[10px] text-red-300 break-all">{bildeSrc.replace("error:", "")}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">{visNavn}</p>

      <div className="bilde-grid">
        {/* Oversiktsbilde med markør */}
        <div className="bilde-celle relative rounded border border-gray-200 bg-gray-50" style={{ height: "260px" }}>
          <img
            src={bildeSrc}
            alt={drawingName}
            className="h-full w-full object-contain"
          />
          {/* Rød markør */}
          <div
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow-md"
            style={{ left: `${x}%`, top: `${y}%` }}
          />
          {/* Detalj-ramme */}
          <div
            className="absolute border-2 border-red-400"
            style={{
              width: `${100 / DETALJ_ZOOM}%`,
              height: `${100 / DETALJ_ZOOM}%`,
              left: `${Math.max(0, Math.min(100 - 100 / DETALJ_ZOOM, x - 100 / DETALJ_ZOOM / 2))}%`,
              top: `${Math.max(0, Math.min(100 - 100 / DETALJ_ZOOM, y - 100 / DETALJ_ZOOM / 2))}%`,
            }}
          />
        </div>

        {/* Detaljutsnitt — canvas-generert bilde, fallback til oversikt */}
        <div className="bilde-celle rounded border border-gray-200" style={{ height: "260px" }}>
          <img
            src={detaljSrc ?? bildeSrc}
            alt={`Detalj: ${drawingName}`}
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
