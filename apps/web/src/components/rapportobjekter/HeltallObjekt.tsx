import type { RapportObjektProps } from "./typer";

export function HeltallObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const tallVerdi = typeof verdi === "number" ? String(verdi) : "";
  const enhet = typeof objekt.config.unit === "string" ? objekt.config.unit : "";

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        step="1"
        value={tallVerdi}
        onChange={(e) => {
          const v = e.target.value;
          onEndreVerdi(v === "" ? null : parseInt(v, 10));
        }}
        placeholder="0"
        disabled={leseModus}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"
        }`}
      />
      {enhet && <span className="shrink-0 text-sm text-gray-500">{enhet}</span>}
    </div>
  );
}
