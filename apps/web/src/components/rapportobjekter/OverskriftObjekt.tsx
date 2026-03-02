import type { RapportObjektProps } from "./typer";

export function OverskriftObjekt({ objekt }: RapportObjektProps) {
  return <h3 className="py-2 text-lg font-bold text-gray-900">{objekt.label}</h3>;
}
