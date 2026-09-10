"use client";

import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";

interface FaggruppeVelgerProps {
  projectId: string;
  value: string | null;
  onChange: (id: string | null) => void;
}

export function FaggruppeVelger({
  projectId,
  value,
  onChange,
}: FaggruppeVelgerProps) {
  const { t } = useTranslation();
  const { data: faggrupper } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId },
    { enabled: !!projectId },
  );

  return (
    <select
      className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{t("mengde.faggruppe.alle")}</option>
      {faggrupper?.map((e) => (
        <option key={e.id} value={e.id}>
          {e.faggruppeNummer ? `${e.faggruppeNummer} ` : ""}
          {e.name}
        </option>
      ))}
    </select>
  );
}
