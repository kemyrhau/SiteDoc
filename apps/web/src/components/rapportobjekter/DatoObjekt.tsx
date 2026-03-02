import type { RapportObjektProps } from "./typer";

export function DatoObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const datoVerdi = typeof verdi === "string" ? new Date(verdi) : null;

  // Konverter til YYYY-MM-DD for input[type=date]
  const inputVerdi = datoVerdi
    ? datoVerdi.toISOString().split("T")[0]
    : "";

  const erIDag = (dato: Date) => {
    const iDag = new Date();
    return (
      dato.getDate() === iDag.getDate() &&
      dato.getMonth() === iDag.getMonth() &&
      dato.getFullYear() === iDag.getFullYear()
    );
  };

  const settIDag = () => {
    onEndreVerdi(new Date().toISOString());
  };

  const fjernVerdi = () => {
    onEndreVerdi(null);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={inputVerdi}
          onChange={(e) => {
            if (e.target.value) {
              onEndreVerdi(new Date(e.target.value).toISOString());
            } else {
              onEndreVerdi(null);
            }
          }}
          disabled={leseModus}
          className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"
          }`}
        />
        {datoVerdi && !leseModus && (
          <button
            type="button"
            onClick={fjernVerdi}
            className="shrink-0 text-gray-400 hover:text-gray-600"
            title="Tøm"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {datoVerdi && !leseModus && !erIDag(datoVerdi) && (
        <button
          type="button"
          onClick={settIDag}
          className="mt-1 ml-1 text-sm text-blue-600 hover:text-blue-800"
        >
          I dag
        </button>
      )}
    </div>
  );
}
