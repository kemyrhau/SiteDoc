"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface UkeVelgerProps {
  uke: number | null;
  aar: number | null;
  onChange: (uke: number, aar: number) => void;
  placeholder?: string;
}

const DAGNAVN = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];
const MAANEDNAVN = [
  "Januar", "Februar", "Mars", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Desember",
];

// ISO 8601 ukenummer
function hentUkenummer(dato: Date): number {
  const d = new Date(Date.UTC(dato.getFullYear(), dato.getMonth(), dato.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const aarStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - aarStart.getTime()) / 86400000 + 1) / 7);
}

// Finn mandag i uke N, år Y (ISO 8601)
function mandagIUke(uke: number, aar: number): Date {
  const jan4 = new Date(aar, 0, 4);
  const mandagUke1 = new Date(jan4);
  mandagUke1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const resultat = new Date(mandagUke1);
  resultat.setDate(mandagUke1.getDate() + (uke - 1) * 7);
  return resultat;
}

// Bygg kalender-uker for en måned
function byggKalenderUker(aar: number, maaned: number) {
  // Finn første mandag som vises (kan være i forrige måned)
  const foerste = new Date(aar, maaned, 1);
  const start = new Date(foerste);
  start.setDate(foerste.getDate() - ((foerste.getDay() + 6) % 7));

  const uker: { ukenr: number; ukeAar: number; dager: Date[] }[] = [];
  const current = new Date(start);

  for (let u = 0; u < 6; u++) {
    const dager: Date[] = [];
    for (let d = 0; d < 7; d++) {
      dager.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    const torsdag = dager[3]!;
    const mandag = dager[0]!;
    const ukenr = hentUkenummer(torsdag); // Torsdag bestemmer ukenr (ISO 8601)
    const ukeAar = torsdag.getFullYear();
    uker.push({ ukenr, ukeAar, dager });
    // Stopp hvis vi har passert denne måneden
    if (mandag.getMonth() > maaned && mandag.getFullYear() >= aar) break;
    if (mandag.getFullYear() > aar) break;
  }

  return uker;
}

export function UkeVelger({ uke, aar, onChange, placeholder }: UkeVelgerProps) {
  const [aapen, setAapen] = useState(false);
  const naa = new Date();
  const [visMaaned, setVisMaaned] = useState(naa.getMonth());
  const [visAar, setVisAar] = useState(aar ?? naa.getFullYear());
  const ref = useRef<HTMLDivElement>(null);

  // Lukk ved klikk utenfor
  useEffect(() => {
    function handleClickUtenfor(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAapen(false);
      }
    }
    if (aapen) document.addEventListener("mousedown", handleClickUtenfor);
    return () => document.removeEventListener("mousedown", handleClickUtenfor);
  }, [aapen]);

  const uker = useMemo(() => byggKalenderUker(visAar, visMaaned), [visAar, visMaaned]);

  const naaUke = hentUkenummer(naa);
  const naaAar = naa.getFullYear();

  function forrigeMaaned() {
    if (visMaaned === 0) { setVisMaaned(11); setVisAar(visAar - 1); }
    else setVisMaaned(visMaaned - 1);
  }

  function nesteMaaned() {
    if (visMaaned === 11) { setVisMaaned(0); setVisAar(visAar + 1); }
    else setVisMaaned(visMaaned + 1);
  }

  function velgUke(ukenr: number, ukeAar: number) {
    onChange(ukenr, ukeAar);
    setAapen(false);
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger-knapp */}
      <button
        type="button"
        onClick={() => setAapen(!aapen)}
        className="w-full flex items-center justify-between border rounded px-2 py-1.5 text-sm bg-white hover:border-gray-400 transition"
      >
        <span className={uke ? "text-gray-900" : "text-gray-400"}>
          {uke ? `U${uke} / ${aar}` : placeholder ?? "Velg uke..."}
        </span>
        <Calendar className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {/* Dropdown-kalender */}
      {aapen && (
        <div className="absolute z-50 mt-1 bg-white border rounded-lg shadow-lg p-3 w-[300px]">
          {/* Måned-navigasjon */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={forrigeMaaned} className="p-1 hover:bg-gray-100 rounded">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">
              {MAANEDNAVN[visMaaned]} {visAar}
            </span>
            <button type="button" onClick={nesteMaaned} className="p-1 hover:bg-gray-100 rounded">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Dag-header */}
          <div className="grid grid-cols-8 gap-0 text-[10px] text-gray-400 font-medium mb-1">
            <div className="text-center">Uke</div>
            {DAGNAVN.map((d) => (
              <div key={d} className="text-center">{d}</div>
            ))}
          </div>

          {/* Uker */}
          {uker.map((u) => {
            const erValgt = uke === u.ukenr && aar === u.ukeAar;
            const erNaaUke = naaUke === u.ukenr && naaAar === u.ukeAar;

            return (
              <button
                key={`${u.ukeAar}-${u.ukenr}`}
                type="button"
                onClick={() => velgUke(u.ukenr, u.ukeAar)}
                className={`grid grid-cols-8 gap-0 w-full rounded py-0.5 transition text-xs ${
                  erValgt
                    ? "bg-sitedoc-primary text-white"
                    : erNaaUke
                      ? "bg-blue-50 hover:bg-blue-100"
                      : "hover:bg-gray-50"
                }`}
              >
                {/* Ukenummer */}
                <div className={`text-center font-semibold ${erValgt ? "text-white" : "text-sitedoc-primary"}`}>
                  {u.ukenr}
                </div>
                {/* Dager */}
                {u.dager.map((dag, i) => {
                  const erDenneMaaned = dag.getMonth() === visMaaned;
                  return (
                    <div
                      key={i}
                      className={`text-center ${
                        erValgt
                          ? erDenneMaaned ? "text-white" : "text-white/50"
                          : erDenneMaaned ? "text-gray-700" : "text-gray-300"
                      }`}
                    >
                      {dag.getDate()}
                    </div>
                  );
                })}
              </button>
            );
          })}

          {/* Idag-knapp */}
          <div className="mt-2 pt-2 border-t flex justify-between items-center">
            <button
              type="button"
              onClick={() => { setVisMaaned(naa.getMonth()); setVisAar(naa.getFullYear()); }}
              className="text-[10px] text-sitedoc-secondary hover:underline"
            >
              I dag (U{naaUke})
            </button>
            {uke && (
              <button
                type="button"
                onClick={() => { onChange(0, 0); setAapen(false); }}
                className="text-[10px] text-gray-400 hover:text-gray-600"
              >
                Fjern
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
