import type { RapportObjektProps } from "./typer";

export function RomEgenskapObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const tekstVerdi = typeof verdi === "string" ? verdi : "";
  const egenskapsnavn = typeof objekt.config.propertyName === "string" ? objekt.config.propertyName : "";

  return (
    <div>
      {egenskapsnavn && (
        <p className="mb-1 text-xs text-gray-500">Rom-egenskap: {egenskapsnavn}</p>
      )}
      <input
        type="text"
        value={tekstVerdi}
        onChange={(e) => onEndreVerdi(e.target.value || null)}
        placeholder="Verdi..."
        disabled={leseModus}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"
        }`}
      />
    </div>
  );
}
