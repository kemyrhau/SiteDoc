import type { RapportObjektProps } from "./typer";

export function UndertittelObjekt({ objekt }: RapportObjektProps) {
  return <h4 className="py-1 text-base font-semibold text-gray-600">{objekt.label}</h4>;
}
