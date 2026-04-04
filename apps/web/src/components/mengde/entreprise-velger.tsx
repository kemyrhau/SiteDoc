"use client";

import { trpc } from "@/lib/trpc";

interface EntrepriseVelgerProps {
  projectId: string;
  value: string | null;
  onChange: (id: string | null) => void;
}

export function EntrepriseVelger({
  projectId,
  value,
  onChange,
}: EntrepriseVelgerProps) {
  const { data: entrepriser } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId },
    { enabled: !!projectId },
  );

  return (
    <select
      className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">Alle entrepriser</option>
      {entrepriser?.map((e) => (
        <option key={e.id} value={e.id}>
          {e.enterpriseNumber ? `${e.enterpriseNumber} ` : ""}
          {e.name}
        </option>
      ))}
    </select>
  );
}
