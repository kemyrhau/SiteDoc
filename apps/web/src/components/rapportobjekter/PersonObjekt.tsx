import { trpc } from "@/lib/trpc";
import type { RapportObjektProps } from "./typer";

interface Medlem {
  id: string;
  user: { id: string; name: string | null; email: string };
}

export function PersonObjekt({ verdi, onEndreVerdi, leseModus, prosjektId }: RapportObjektProps) {
  const valgtId = typeof verdi === "string" ? verdi : "";

  const { data: råMedlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const medlemmer = råMedlemmer as Medlem[] | undefined;

  return (
    <select
      value={valgtId}
      onChange={(e) => onEndreVerdi(e.target.value || null)}
      disabled={leseModus}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
        leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"
      }`}
    >
      <option value="">Velg person...</option>
      {medlemmer?.map((m) => (
        <option key={m.user.id} value={m.user.id}>
          {m.user.name ?? m.user.email}
        </option>
      ))}
    </select>
  );
}
