import { trpc } from "@/lib/trpc";
import type { RapportObjektProps } from "./typer";

export function FirmaObjekt({ verdi, onEndreVerdi, leseModus, prosjektId, tillatteFaggruppeIder }: RapportObjektProps) {
  const valgtId = typeof verdi === "string" ? verdi : "";

  const { data: faggrupper } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  // 4b (dokumentflyten er nøkkelen): begrens valgene til faggrupper som er MEDLEM av dokumentets
  // flyt. `tillatteFaggruppeIder == null` = flyt-løst dokument (gyldig) → vis alle + mikrotekst.
  const scopet = tillatteFaggruppeIder != null;
  const tillatt = scopet ? new Set(tillatteFaggruppeIder) : null;
  const alle = faggrupper ?? [];
  // Vis de tillatte + ALLTID den lagrede verdien (selv om den er utenfor flyten) — data forsvinner
  // aldri stille (funn 6-prinsippet); den utenfor-verdien merkes READ-ONLY nedenfor.
  const synlige = tillatt ? alle.filter((e) => tillatt.has(e.id) || e.id === valgtId) : alle;
  const valgtErUtenfor = !!tillatt && !!valgtId && !tillatt.has(valgtId);

  return (
    <div>
      <select
        value={valgtId}
        onChange={(e) => onEndreVerdi(e.target.value || null)}
        disabled={leseModus}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          leseModus ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"
        }`}
      >
        <option value="">Velg firma...</option>
        {synlige.map((e) => {
          const utenfor = !!tillatt && !tillatt.has(e.id);
          return (
            <option key={e.id} value={e.id} disabled={utenfor && e.id !== valgtId}>
              {e.faggruppeNummer ? `${e.faggruppeNummer} ` : ""}{e.name}
              {e.companyName ? `, ${e.companyName}` : ""}
              {utenfor ? " (utenfor flyten)" : ""}
            </option>
          );
        })}
      </select>
      {!scopet && (
        <p className="mt-1 text-xs text-gray-400">
          Dokumentet har ingen dokumentflyt — viser alle faggrupper.
        </p>
      )}
      {valgtErUtenfor && (
        <p className="mt-1 text-xs text-amber-600">
          Valgt faggruppe er ikke medlem av dokumentflyten. Behold eller velg en fra flyten.
        </p>
      )}
    </div>
  );
}
