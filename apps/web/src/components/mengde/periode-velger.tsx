"use client";

import { trpc } from "@/lib/trpc";

interface PeriodeVelgerProps {
  projectId: string;
  enterpriseId: string | null;
  value: string | null;
  onChange: (id: string | null) => void;
}

export function PeriodeVelger({
  projectId,
  enterpriseId,
  value,
  onChange,
}: PeriodeVelgerProps) {
  const { data: perioder } = trpc.mengde.hentPerioder.useQuery(
    {
      projectId,
      enterpriseId: enterpriseId ?? undefined,
    },
    { enabled: !!projectId },
  );

  return (
    <select
      className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">Velg periode...</option>
      {perioder?.map((p) => (
        <option key={p.id} value={p.id}>
          {p.type === "a_nota" ? "A-nota" : "T-nota"} #{p.periodeNr}
          {p.enterprise ? ` — ${p.enterprise.name}` : ""}
        </option>
      ))}
    </select>
  );
}
