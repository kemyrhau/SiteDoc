"use client";

import { type ReactNode } from "react";
import { Search } from "lucide-react";

/**
 * Delte trakt-primitiver (P4b) — hevet UT av `layout/KontekstChip.tsx` til
 * felles kilde slik at både header-KontekstChippen OG den nye dokument-
 * kontekst-chip-linja (`DokumentKontekstChipLinje`) bruker SAMME markup.
 * Ikke kopier disse — importer herfra (fabel-vedtak P4b, delt kilde).
 *
 * P4c (timer ett-trykk) arver de samme primitivene når den bygger sin
 * kontekst-chip-linje.
 */

/** Sammenfoldet nivårad: farget etikett + valgt verdi + «Endre»-lenke. */
export function NivåRad({
  etikett,
  etikettKlasse,
  verdi,
  kanEndre,
  endreTekst,
  onEndre,
  sisteRad = false,
}: {
  etikett: string;
  etikettKlasse: string;
  verdi: string;
  kanEndre: boolean;
  endreTekst: string;
  onEndre: () => void;
  sisteRad?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 ${sisteRad ? "" : "border-b border-gray-100"}`}
    >
      <span
        className={`w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide ${etikettKlasse}`}
      >
        {etikett}
      </span>
      <span className="flex-1 truncate text-sm font-medium text-gray-900">{verdi}</span>
      {kanEndre && (
        <button
          type="button"
          onClick={onEndre}
          className="shrink-0 text-xs font-medium text-sitedoc-secondary hover:underline"
        >
          {endreTekst}
        </button>
      )}
    </div>
  );
}

/** Valgbar rad i en åpen liste (firma/prosjekt/byggeplass/faggruppe/mal). */
export function TraktRad({
  tittel,
  undertekst,
  valgt,
  onVelg,
}: {
  tittel: string;
  undertekst?: string;
  valgt: boolean;
  onVelg: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onVelg}
      // ≥44px hit-target (min-h-11) — feltarbeideren treffer med tommel.
      className={`flex min-h-11 w-full flex-col justify-center px-3 py-2 text-left transition-colors hover:bg-blue-50 ${
        valgt ? "bg-blue-50" : ""
      }`}
    >
      <span
        className={`text-sm ${valgt ? "font-semibold text-sitedoc-primary" : "font-medium text-gray-900"}`}
      >
        {tittel}
      </span>
      {undertekst && <span className="text-xs text-gray-400">{undertekst}</span>}
    </button>
  );
}

export function SeksjonsLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </p>
  );
}

export function SøkeFelt({
  verdi,
  onEndre,
  placeholder,
}: {
  verdi: string;
  onEndre: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="px-3 pb-1 pt-1">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={verdi}
          onChange={(e) => onEndre(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
