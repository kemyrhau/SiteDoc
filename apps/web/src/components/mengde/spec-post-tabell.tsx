"use client";

import { trpc } from "@/lib/trpc";

interface SpecPostTabellProps {
  projectId: string;
  periodId: string | null;
  onVelgPost: (postId: string) => void;
  valgtPostId: string | null;
}

export function SpecPostTabell({
  projectId,
  periodId,
  onVelgPost,
  valgtPostId,
}: SpecPostTabellProps) {
  const { data: poster, isLoading } = trpc.mengde.hentSpecPoster.useQuery(
    { projectId, periodId: periodId ?? undefined },
    { enabled: !!projectId },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        Laster poster...
      </div>
    );
  }

  if (!poster || poster.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        Ingen poster funnet. Importer budsjett eller A-nota for å komme i gang.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs font-medium uppercase text-gray-500">
            <th className="px-3 py-2">Nr</th>
            <th className="px-3 py-2">Beskrivelse</th>
            <th className="px-3 py-2">Enhet</th>
            <th className="px-3 py-2 text-right">Mengde anbud</th>
            <th className="px-3 py-2 text-right">Enhetspris</th>
            <th className="px-3 py-2 text-right">Sum anbud</th>
            {periodId && (
              <>
                <th className="px-3 py-2 text-right">Mengde denne</th>
                <th className="px-3 py-2 text-right">Verdi denne</th>
                <th className="px-3 py-2 text-right">% ferdig</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {poster.map((post) => {
            const notaPost =
              post.notaPoster && post.notaPoster.length > 0
                ? post.notaPoster[0]
                : null;
            return (
              <tr
                key={post.id}
                onClick={() => onVelgPost(post.id)}
                className={`cursor-pointer border-b transition-colors hover:bg-gray-50 ${
                  valgtPostId === post.id ? "bg-blue-50" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs">
                  {post.postnr ?? "—"}
                </td>
                <td className="max-w-xs truncate px-3 py-2">
                  {post.beskrivelse ?? "—"}
                </td>
                <td className="px-3 py-2">{post.enhet ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {formaterTall(post.mengdeAnbud)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formaterTall(post.enhetspris)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formaterTall(post.sumAnbud)}
                </td>
                {periodId && notaPost && (
                  <>
                    <td className="px-3 py-2 text-right font-mono">
                      {formaterTall(notaPost.mengdeDenne)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formaterTall(notaPost.verdiDenne)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {notaPost.prosentFerdig
                        ? `${Number(notaPost.prosentFerdig).toFixed(0)}%`
                        : "—"}
                    </td>
                  </>
                )}
                {periodId && !notaPost && (
                  <>
                    <td className="px-3 py-2 text-right text-gray-300">—</td>
                    <td className="px-3 py-2 text-right text-gray-300">—</td>
                    <td className="px-3 py-2 text-right text-gray-300">—</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formaterTall(verdi: unknown): string {
  if (verdi === null || verdi === undefined) return "—";
  const num = Number(verdi);
  if (isNaN(num)) return "—";
  return num.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
}
