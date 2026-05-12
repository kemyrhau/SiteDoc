"use client";

import { useTranslation } from "react-i18next";

const FARGER: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  returned: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        FARGER[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {t(`timer.statusType.${status}`)}
    </span>
  );
}
