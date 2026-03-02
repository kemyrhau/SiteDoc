import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { RapportObjektProps } from "./typer";

interface Medlem {
  id: string;
  user: { id: string; name: string | null; email: string };
}

export function FlerePersonerObjekt({ verdi, onEndreVerdi, leseModus, prosjektId }: RapportObjektProps) {
  const [erÅpen, settErÅpen] = useState(false);
  const valgteIder = Array.isArray(verdi) ? (verdi as string[]) : [];

  const { data: råMedlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const medlemmer = råMedlemmer as Medlem[] | undefined;

  const veksle = (brukerId: string) => {
    if (leseModus) return;
    if (valgteIder.includes(brukerId)) {
      onEndreVerdi(valgteIder.filter((id) => id !== brukerId));
    } else {
      onEndreVerdi([...valgteIder, brukerId]);
    }
  };

  const valgteTekst = valgteIder.length > 0
    ? `${valgteIder.length} valgt`
    : "Velg personer...";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !leseModus && settErÅpen(!erÅpen)}
        disabled={leseModus}
        className={`flex w-full items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm text-left ${
          leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white text-gray-900"
        }`}
      >
        <span className={valgteIder.length === 0 ? "text-gray-400" : ""}>
          {valgteTekst}
        </span>
        <svg className="h-4 w-4 text-gray-400" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {erÅpen && medlemmer && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {medlemmer.map((m) => {
            const erValgt = valgteIder.includes(m.user.id);
            return (
              <button
                key={m.user.id}
                type="button"
                onClick={() => veksle(m.user.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    erValgt ? "border-blue-600 bg-blue-600" : "border-gray-400"
                  }`}
                >
                  {erValgt && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-gray-900">{m.user.name ?? m.user.email}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
