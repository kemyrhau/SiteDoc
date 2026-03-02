"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { RapportObjektProps } from "./typer";

export function SignaturObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const [redigerer, settRedigerer] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tegnerRef = useRef(false);
  const harSignatur = typeof verdi === "string" && verdi.length > 0;

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
    onEndreVerdi(dataUrl);
    settRedigerer(false);
  }, [onEndreVerdi]);

  // Initialiser canvas-størrelse
  useEffect(() => {
    if (!redigerer && !(!harSignatur && !leseModus)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = 200;
  }, [redigerer, harSignatur, leseModus]);

  if (leseModus && !harSignatur) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 py-6">
        <p className="text-sm text-gray-400">Ingen signatur</p>
      </div>
    );
  }

  if (!redigerer && harSignatur) {
    return (
      <div>
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2">
          <img src={verdi as string} alt="Signatur" className="max-h-[120px]" />
        </div>
        {!leseModus && (
          <button
            type="button"
            onClick={() => {
              onEndreVerdi(null);
              settRedigerer(true);
            }}
            className="mt-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Signer på nytt
          </button>
        )}
      </div>
    );
  }

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
          Tøm
        </button>
        <button
          type="button"
          onClick={lagreSignatur}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Lagre
        </button>
      </div>
    </div>
  );
}
