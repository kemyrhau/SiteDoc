"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Check, Undo2 } from "lucide-react";

interface OmradeTegneverktoyProps {
  onFerdig: (polygon: { x: number; y: number }[], navn: string, type: string, farge: string) => void;
  onAvbryt: () => void;
}

const FARGER: string[] = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export function OmradeTegneverktoy({ onFerdig, onAvbryt }: OmradeTegneverktoyProps) {
  const { t } = useTranslation();
  const [punkter, setPunkter] = useState<{ x: number; y: number }[]>([]);
  const [navn, setNavn] = useState("");
  const [type, setType] = useState<"sone" | "rom" | "etasje">("sone");
  const [farge, setFarge] = useState("#3b82f6");
  const [musPosisjon, setMusPosisjon] = useState<{ x: number; y: number } | null>(null);

  const handleKlikk = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 10000) / 100;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 10000) / 100;
    setPunkter((prev) => [...prev, { x, y }]);
  }, []);

  const handleMusBevegelse = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 10000) / 100;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 10000) / 100;
    setMusPosisjon({ x, y });
  }, []);

  const handleDobbeltklikk = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (punkter.length >= 3 && navn.trim()) {
      onFerdig(punkter, navn.trim(), type, farge);
    }
  }, [punkter, navn, type, farge, onFerdig]);

  const angre = () => setPunkter((prev) => prev.slice(0, -1));

  const kanFullfore = punkter.length >= 3 && navn.trim();

  return (
    <>
      {/* SVG-overlay for tegning */}
      <svg
        className="absolute inset-0 w-full h-full cursor-crosshair"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 20 }}
        onClick={handleKlikk}
        onMouseMove={handleMusBevegelse}
        onDoubleClick={handleDobbeltklikk}
      >
        {/* Fylt polygon (preview) */}
        {punkter.length >= 3 && (
          <polygon
            points={punkter.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={farge}
            fillOpacity={0.15}
            stroke={farge}
            strokeWidth={0.2}
            strokeLinejoin="round"
          />
        )}

        {/* Linjer mellom punkter */}
        {punkter.length >= 2 && (
          <polyline
            points={punkter.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={farge}
            strokeWidth={0.3}
            strokeLinejoin="round"
          />
        )}

        {/* Linje til musepeker */}
        {punkter.length > 0 && musPosisjon && (() => {
          const siste = punkter[punkter.length - 1]!;
          return (
          <line
            x1={siste.x}
            y1={siste.y}
            x2={musPosisjon.x}
            y2={musPosisjon.y}
            stroke={farge}
            strokeWidth={0.2}
            strokeDasharray="0.5 0.3"
            opacity={0.6}
          />
          );
        })()}

        {/* Punkter */}
        {punkter.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={0.5}
            fill="white"
            stroke={farge}
            strokeWidth={0.2}
          />
        ))}
      </svg>

      {/* Kontrollpanel */}
      <div className="absolute top-3 left-3 bg-white rounded-lg shadow-lg border p-3 z-30 w-64">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">{t("kontrollplan.opprettOmrade")}</span>
          <button onClick={onAvbryt} className="p-0.5 hover:bg-gray-100 rounded">
            <X className="h-3.5 w-3.5 text-gray-400" />
          </button>
        </div>

        <input
          type="text"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          placeholder={t("kontrollplan.navn")}
          className="w-full border rounded px-2 py-1 text-xs mb-2"
          autoFocus
        />

        <div className="flex gap-2 mb-2">
          {(["sone", "rom", "etasje"] as const).map((tp) => (
            <label key={tp} className="flex items-center gap-1 text-[10px]">
              <input type="radio" checked={type === tp} onChange={() => setType(tp)} className="h-3 w-3" />
              {tp}
            </label>
          ))}
        </div>

        <div className="flex gap-1 mb-2">
          {FARGER.map((f) => (
            <button
              key={f}
              onClick={() => setFarge(f)}
              className={`w-5 h-5 rounded-full border-2 ${farge === f ? "border-gray-800" : "border-transparent"}`}
              style={{ backgroundColor: f }}
            />
          ))}
        </div>

        <div className="text-[10px] text-gray-400 mb-2">
          {punkter.length === 0
            ? "Klikk på tegningen for å starte polygon"
            : punkter.length < 3
              ? `${punkter.length} punkt(er) — minst 3 for å fullføre`
              : `${punkter.length} punkter — dobbeltklikk for å fullføre`}
        </div>

        <div className="flex gap-2">
          {punkter.length > 0 && (
            <button onClick={angre} className="flex items-center gap-1 text-[10px] px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">
              <Undo2 className="h-3 w-3" /> Angre
            </button>
          )}
          {kanFullfore && (
            <button
              onClick={() => onFerdig(punkter, navn.trim(), type, farge)}
              className="flex items-center gap-1 text-[10px] px-2 py-1 bg-sitedoc-primary text-white rounded"
            >
              <Check className="h-3 w-3" /> Fullfør
            </button>
          )}
        </div>
      </div>
    </>
  );
}
