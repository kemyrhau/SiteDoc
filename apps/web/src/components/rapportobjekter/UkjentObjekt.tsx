import type { RapportObjektProps } from "./typer";

export function UkjentObjekt({ objekt }: RapportObjektProps) {
  return (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3">
      <p className="text-sm text-yellow-800">
        Ukjent felttype: <span className="font-mono font-medium">{objekt.type}</span>
      </p>
    </div>
  );
}
