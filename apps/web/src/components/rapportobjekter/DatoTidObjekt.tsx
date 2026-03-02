import type { RapportObjektProps } from "./typer";

export function DatoTidObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const datoVerdi = typeof verdi === "string" ? new Date(verdi) : null;

  // Konverter til YYYY-MM-DD og HH:MM for native inputs
  const datoInput = datoVerdi ? datoVerdi.toISOString().split("T")[0] : "";
  const tidInput = datoVerdi
    ? `${String(datoVerdi.getHours()).padStart(2, "0")}:${String(datoVerdi.getMinutes()).padStart(2, "0")}`
    : "";

  const oppdaterDato = (nyDato: string) => {
    if (!nyDato) {
      onEndreVerdi(null);
      return;
    }
    const base = datoVerdi ?? new Date();
    const [år, måned, dag] = nyDato.split("-").map(Number);
    const ny = new Date(base);
    ny.setFullYear(år!, måned! - 1, dag);
    onEndreVerdi(ny.toISOString());
  };

  const oppdaterTid = (nyTid: string) => {
    if (!nyTid) return;
    const base = datoVerdi ?? new Date();
    const [timer, minutter] = nyTid.split(":").map(Number);
    const ny = new Date(base);
    ny.setHours(timer!, minutter!, 0, 0);
    onEndreVerdi(ny.toISOString());
  };

  const settNå = () => {
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
          value={datoInput}
          onChange={(e) => oppdaterDato(e.target.value)}
          disabled={leseModus}
          className={`flex-[2] rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"
          }`}
        />
        <input
          type="time"
          value={tidInput}
          onChange={(e) => oppdaterTid(e.target.value)}
          disabled={leseModus}
          className={`flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
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

      {!leseModus && (
        <button
          type="button"
          onClick={settNå}
          className="mt-1 ml-1 text-sm text-blue-600 hover:text-blue-800"
        >
          Nå
        </button>
      )}
    </div>
  );
}
