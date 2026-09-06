"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { lesSignaturVerdi, formaterSignaturLinje, signaturTidspunktNaa } from "@sitedoc/shared";
import { PenLine } from "lucide-react";
import type { RapportObjektProps } from "./typer";

export function SignaturObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [redigerer, settRedigerer] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tegnerRef = useRef(false);
  const signatur = lesSignaturVerdi(verdi);
  const metaLinje = signatur ? formaterSignaturLinje(signatur) : null;

  const startTegning = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    tegnerRef.current = true;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  const tegn = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!tegnerRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000000";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }, []);

  const stoppTegning = useCallback(() => {
    tegnerRef.current = false;
  }, []);

  const tømCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const lagreSignatur = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    // Snapshot av hvem/når fanges i signeringsøyeblikket (fabel-vedtak 05.09).
    onEndreVerdi({
      dataUrl,
      brukerId: session?.user?.id ?? null,
      navn: session?.user?.name ?? null,
      tidspunkt: signaturTidspunktNaa(),
    });
    settRedigerer(false);
  }, [onEndreVerdi, session]);

  // Initialiser tegneflaten når den åpnes (mountes kun i redigerer-tilstand).
  useEffect(() => {
    if (!redigerer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = 200;
  }, [redigerer]);

  // Lesemodus uten signatur → ingen tegneflate.
  if (leseModus && !signatur) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 py-6">
        <p className="text-sm text-gray-400">{t("felt.ingenSignatur")}</p>
      </div>
    );
  }

  // Har signatur, ikke i redigering → bildet + meta-linje (uendret bilde-tilstand).
  if (!redigerer && signatur) {
    return (
      <div>
        <div className="flex flex-col items-center rounded-lg border border-gray-200 bg-white p-2">
          <img src={signatur.dataUrl} alt="Signatur" className="max-h-[120px]" />
          {metaLinje && <p className="mt-1 text-xs text-gray-500">{metaLinje}</p>}
        </div>
        {!leseModus && (
          <button
            type="button"
            // Åpner tegneflaten UTEN å slette dagens signatur — avbryt beholder den (krav 2).
            onClick={() => settRedigerer(true)}
            className="mt-2 text-sm text-gray-500 hover:text-gray-700"
          >
            {t("felt.signerPaaNytt")}
          </button>
        )}
      </div>
    );
  }

  // Tredje tilstand: tom og LUKKET → «Signer her»-knapp, ingen tegneflate.
  if (!redigerer && !signatur) {
    return (
      <button
        type="button"
        onClick={() => settRedigerer(true)}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 py-3 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-100"
      >
        <PenLine size={16} />
        {t("felt.signerHer")}
      </button>
    );
  }

  // Redigerer → tegneflaten (Tøm · Avbryt · Lagre).
  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-gray-300">
        <canvas
          ref={canvasRef}
          onMouseDown={startTegning}
          onMouseMove={tegn}
          onMouseUp={stoppTegning}
          onMouseLeave={stoppTegning}
          className="w-full cursor-crosshair bg-white"
          style={{ height: 200 }}
        />
      </div>
      <div className="mt-2 flex justify-end gap-3">
        <button
          type="button"
          onClick={tømCanvas}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          {t("felt.tom")}
        </button>
        <button
          type="button"
          // Lukking lagrer ingenting (avbrytbarhets-regelen). Har feltet en signatur fra før, står den urørt.
          onClick={() => settRedigerer(false)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          {t("handling.avbryt")}
        </button>
        <button
          type="button"
          onClick={lagreSignatur}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t("handling.lagre")}
        </button>
      </div>
    </div>
  );
}
