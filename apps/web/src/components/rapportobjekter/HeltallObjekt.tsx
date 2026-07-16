import { AlertTriangle } from "lucide-react";
import { normaliserGrense, formaterGrense, grenseStatus } from "@sitedoc/shared";
import type { RapportObjektProps } from "./typer";

export function HeltallObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const tallVerdi = typeof verdi === "number" ? String(verdi) : "";
  const grense = normaliserGrense(objekt.config);
  const status = grenseStatus(verdi, grense);
  const utenfor = status !== null && status !== "ok";
  const grenseTekst = formaterGrense(grense);

  return (
    <div className="flex flex-col gap-1">
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
          className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 ${
            utenfor
              ? "border-amber-500 focus:border-amber-500 focus:ring-amber-500"
              : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          } ${leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"}`}
        />
        {grense.enhet && <span className="shrink-0 text-sm text-gray-500">{grense.enhet}</span>}
      </div>
      {grenseTekst && (
        <span
          className={`flex items-center gap-1 text-xs ${
            utenfor ? "font-medium text-amber-600" : "text-gray-400"
          }`}
        >
          {utenfor && <AlertTriangle className="h-3 w-3 shrink-0" />}
          {grenseTekst}
        </span>
      )}
    </div>
  );
}
