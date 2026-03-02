"use client";

import { useState, useRef, useEffect } from "react";

interface TreprikkMenyProps {
  onRediger: () => void;
  onSlett: () => void;
  onTilfoyjBetingelse?: () => void;
  onFjernBetingelse?: () => void;
  kanHaBetingelse: boolean;
  erBarnFelt: boolean;
}

export function TreprikkMeny({
  onRediger,
  onSlett,
  onTilfoyjBetingelse,
  onFjernBetingelse,
  kanHaBetingelse,
  erBarnFelt,
}: TreprikkMenyProps) {
  const [åpen, setÅpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setÅpen(false);
      }
    }
    if (åpen) {
      document.addEventListener("mousedown", handleKlikk);
      return () => document.removeEventListener("mousedown", handleKlikk);
    }
  }, [åpen]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setÅpen(!åpen);
        }}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        title="Handlinger"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {åpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            onClick={(e) => {
              e.stopPropagation();
              setÅpen(false);
              onRediger();
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Rediger
          </button>

          {kanHaBetingelse && onTilfoyjBetingelse && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50"
              onClick={(e) => {
                e.stopPropagation();
                setÅpen(false);
                onTilfoyjBetingelse();
              }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Tilføy betingelse
            </button>
          )}

          {erBarnFelt && onFjernBetingelse && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-orange-700 hover:bg-orange-50"
              onClick={(e) => {
                e.stopPropagation();
                setÅpen(false);
                onFjernBetingelse();
              }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Fjern betingelse
            </button>
          )}

          <div className="my-1 border-t border-gray-100" />

          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              setÅpen(false);
              onSlett();
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Slett
          </button>
        </div>
      )}
    </div>
  );
}
