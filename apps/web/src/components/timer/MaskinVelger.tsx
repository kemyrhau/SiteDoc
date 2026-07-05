"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Truck, Wrench, Hammer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SearchInput } from "@sitedoc/ui";
import type { MaskinKategori } from "@/lib/maskin-typer";

/**
 * Delt maskin-/utstyrsvelger for dagsseddel-maskinmodalene (MaskinRadDialog,
 * KompaktMaskinRad, RedigerMaskinRad). Erstatter flate <select> uten søk.
 *
 * - Fritekst-søk (SearchInput) over merke/modell/internNavn/internNummer/regnr
 * - Kategori-filter som enkel-select chips (Alle/Kjøretøy/Anleggsmaskin/
 *   Småutstyr) — labels + ikoner speiler /dashbord/maskin
 * - Sortering: brukt-på-seddelen først → internNummer (numerisk) → navn
 */
export type MaskinVelgerUtstyr = {
  id: string;
  merke: string | null;
  modell: string | null;
  internNavn: string | null;
  internNummer: string | null;
  kategori: string | null;
};

const KATEGORIER: ReadonlyArray<MaskinKategori> = [
  "kjoretoy",
  "anleggsmaskin",
  "smautstyr",
];

const KATEGORI_IKON: Record<MaskinKategori, React.ReactNode> = {
  kjoretoy: <Truck className="h-3.5 w-3.5" />,
  anleggsmaskin: <Wrench className="h-3.5 w-3.5" />,
  smautstyr: <Hammer className="h-3.5 w-3.5" />,
};

function etikett(u: MaskinVelgerUtstyr): string {
  const hoved = `${u.merke ?? ""} ${u.modell ?? ""}`.trim() || (u.internNavn ?? "");
  return (
    hoved +
    (u.internNavn && `${u.merke ?? ""} ${u.modell ?? ""}`.trim()
      ? ` (${u.internNavn})`
      : "") +
    (u.internNummer ? ` — #${u.internNummer}` : "")
  );
}

/** Numerisk-aware sammenligning av internNummer (tomme sist). */
function sammenlignInternNummer(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const na = Number(a);
  const nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.localeCompare(b, "nb");
}

export function MaskinVelger({
  utstyr,
  valgtId,
  onVelg,
  bruktPaaSeddel = [],
  disabled = false,
  id,
}: {
  utstyr: MaskinVelgerUtstyr[];
  valgtId: string;
  onVelg: (id: string) => void;
  /** vehicleId-er allerede i bruk på denne seddelen — løftes øverst. */
  bruktPaaSeddel?: string[];
  disabled?: boolean;
  id?: string;
}) {
  const { t } = useTranslation();
  const [apen, setApen] = useState(false);
  const [sok, setSok] = useState("");
  const [kategori, setKategori] = useState<MaskinKategori | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function klikkUtenfor(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setApen(false);
    }
    if (apen) document.addEventListener("mousedown", klikkUtenfor);
    return () => document.removeEventListener("mousedown", klikkUtenfor);
  }, [apen]);

  const bruktSet = useMemo(() => new Set(bruktPaaSeddel), [bruktPaaSeddel]);

  const antallPerKategori = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of utstyr)
      if (u.kategori) m.set(u.kategori, (m.get(u.kategori) ?? 0) + 1);
    return m;
  }, [utstyr]);

  const synlige = useMemo(() => {
    const q = sok.toLowerCase().trim();
    const filtrert = utstyr.filter((u) => {
      if (kategori && u.kategori !== kategori) return false;
      if (!q) return true;
      return [u.merke, u.modell, u.internNavn, u.internNummer]
        .some((f) => (f ?? "").toLowerCase().includes(q));
    });
    return filtrert.sort((a, b) => {
      const aBrukt = bruktSet.has(a.id);
      const bBrukt = bruktSet.has(b.id);
      if (aBrukt !== bBrukt) return aBrukt ? -1 : 1;
      const nr = sammenlignInternNummer(a.internNummer, b.internNummer);
      if (nr !== 0) return nr;
      return etikett(a).localeCompare(etikett(b), "nb");
    });
  }, [utstyr, sok, kategori, bruktSet]);

  const valgt = utstyr.find((u) => u.id === valgtId);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setApen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded border border-gray-300 px-3 py-2 text-left text-sm ${
          disabled
            ? "bg-gray-100 text-gray-400"
            : "bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        <span className={`truncate ${valgt ? "" : "text-gray-400"}`}>
          {valgt ? etikett(valgt) : t("timer.velgUtstyr")}
        </span>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
      </button>

      {apen && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="space-y-2 border-b border-gray-100 p-2">
            <SearchInput verdi={sok} onChange={setSok} />
            <div className="flex flex-wrap gap-1">
              <KategoriChip
                label={t("maskin.filter.alle")}
                aktiv={kategori === null}
                onClick={() => setKategori(null)}
              />
              {KATEGORIER.map((k) => (
                <KategoriChip
                  key={k}
                  label={`${t(
                    `maskin.kategori${k.charAt(0).toUpperCase() + k.slice(1)}`,
                  )} (${antallPerKategori.get(k) ?? 0})`}
                  ikon={KATEGORI_IKON[k]}
                  aktiv={kategori === k}
                  onClick={() => setKategori(kategori === k ? null : k)}
                />
              ))}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {synlige.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">—</div>
            ) : (
              synlige.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    onVelg(u.id);
                    setApen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    u.id === valgtId ? "bg-sitedoc-primary/5" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="flex-1 truncate text-gray-900">
                    {etikett(u)}
                    {bruktSet.has(u.id) && (
                      <span className="ml-2 text-xs text-sitedoc-primary">
                        · {t("timer.maskin.bruktPaaSeddel")}
                      </span>
                    )}
                  </span>
                  {u.id === valgtId && (
                    <Check className="h-4 w-4 flex-shrink-0 text-sitedoc-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KategoriChip({
  label,
  ikon,
  aktiv,
  onClick,
}: {
  label: string;
  ikon?: React.ReactNode;
  aktiv: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        aktiv
          ? "bg-sitedoc-primary text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {ikon}
      {label}
    </button>
  );
}
