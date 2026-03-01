import type { ReactNode } from "react";

interface KolonneDef<T> {
  id: string;
  header: string;
  celle: (rad: T) => ReactNode;
  bredde?: string;
}

interface TableProps<T> {
  kolonner: KolonneDef<T>[];
  data: T[];
  radNokkel: (rad: T) => string;
  onRadKlikk?: (rad: T) => void;
  tomMelding?: string;
}

export function Table<T>({
  kolonner,
  data,
  radNokkel,
  onRadKlikk,
  tomMelding = "Ingen data å vise",
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        {tomMelding}
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 border-b border-gray-200 bg-gray-50">
          <tr>
            {kolonner.map((kol) => (
              <th
                key={kol.id}
                className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                style={kol.bredde ? { width: kol.bredde } : undefined}
              >
                {kol.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((rad) => (
            <tr
              key={radNokkel(rad)}
              onClick={() => onRadKlikk?.(rad)}
              className={`transition-colors ${
                onRadKlikk
                  ? "cursor-pointer hover:bg-blue-50"
                  : ""
              }`}
            >
              {kolonner.map((kol) => (
                <td key={kol.id} className="px-4 py-3">
                  {kol.celle(rad)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
