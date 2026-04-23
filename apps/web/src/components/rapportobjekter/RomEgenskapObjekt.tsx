import { trpc } from "@/lib/trpc";
import type { RapportObjektProps } from "./typer";

interface OmradeItem {
  id: string;
  navn: string;
  type: string;
  byggeplass: { id: string; name: string };
}

export function RomEgenskapObjekt({ verdi, onEndreVerdi, leseModus, prosjektId }: RapportObjektProps) {
  const valgtId = typeof verdi === "string" ? verdi : "";

  const { data } = trpc.omrade.hentForProsjekt.useQuery(
    { projectId: prosjektId!, type: "rom" },
    { enabled: !!prosjektId },
  );
  const omrader = data as OmradeItem[] | undefined;

  return (
    <select
      value={valgtId}
      onChange={(e) => onEndreVerdi(e.target.value || null)}
      disabled={leseModus}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
        leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"
      }`}
    >
      <option value="">Velg rom...</option>
      {omrader?.map((o) => (
        <option key={o.id} value={o.id}>
          {o.byggeplass.name} — {o.navn}
        </option>
      ))}
    </select>
  );
}
