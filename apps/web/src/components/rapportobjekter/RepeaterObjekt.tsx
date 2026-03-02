import { Plus, Trash2 } from "lucide-react";
import type { RapportObjektProps, FeltVerdi } from "./typer";

type RepeaterVerdi = Array<Record<string, FeltVerdi>>;

export function RepeaterObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const rader = Array.isArray(verdi) ? (verdi as RepeaterVerdi) : [];
  const barneObjekter = (objekt.config.children as Array<{ id: string; type: string; label: string }>) ?? [];

  const leggTilRad = () => {
    const nyRad: Record<string, FeltVerdi> = {};
    for (const barn of barneObjekter) {
      nyRad[barn.id] = { verdi: null, kommentar: "", vedlegg: [] };
    }
    onEndreVerdi([...rader, nyRad]);
  };

  const fjernRad = (indeks: number) => {
    onEndreVerdi(rader.filter((_, i) => i !== indeks));
  };

  return (
    <div className="flex flex-col gap-3">
      {rader.map((rad, indeks) => (
        <div key={indeks} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Rad {indeks + 1}</span>
            {!leseModus && (
              <button
                type="button"
                onClick={() => fjernRad(indeks)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          {barneObjekter.map((barn) => (
            <div key={barn.id} className="mb-2">
              <p className="mb-1 text-xs text-gray-600">{barn.label}</p>
              <p className="text-sm text-gray-400">
                {String(rad[barn.id]?.verdi ?? "\u2014")}
              </p>
            </div>
          ))}
        </div>
      ))}

      {!leseModus && (
        <button
          type="button"
          onClick={leggTilRad}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-3 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700"
        >
          <Plus size={16} />
          Legg til rad
        </button>
      )}
    </div>
  );
}
