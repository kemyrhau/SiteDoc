import { trpc } from "@/lib/trpc";
import type { RapportObjektProps } from "./typer";

export function FirmaObjekt({ verdi, onEndreVerdi, leseModus, prosjektId }: RapportObjektProps) {
  const valgtId = typeof verdi === "string" ? verdi : "";

  const { data: faggrupper } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  return (
    <select
      value={valgtId}
      onChange={(e) => onEndreVerdi(e.target.value || null)}
      disabled={leseModus}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
        leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"
      }`}
    >
      <option value="">Velg firma...</option>
      {faggrupper?.map((e) => (
        <option key={e.id} value={e.id}>
          {e.faggruppeNummer ? `${e.faggruppeNummer} ` : ""}{e.name}
          {e.companyName ? `, ${e.companyName}` : ""}
        </option>
      ))}
    </select>
  );
}
