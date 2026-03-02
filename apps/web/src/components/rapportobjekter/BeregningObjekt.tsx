import type { RapportObjektProps } from "./typer";

export function BeregningObjekt({ objekt, verdi }: RapportObjektProps) {
  const visVerdi = verdi != null ? String(verdi) : "—";
  const enhet = typeof objekt.config.unit === "string" ? objekt.config.unit : "";

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-600">{visVerdi}</span>
      {enhet && <span className="text-sm text-gray-400">{enhet}</span>}
    </div>
  );
}
