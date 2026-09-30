"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@sitedoc/ui";
import { timerStatusEtikett } from "@sitedoc/shared";

// Del 7: farge OG ord leses fra den delte kilden (timerStatusEtikett) — ingen
// hardkodet fargetabell her. Badge speiler husets palett (packages/ui/badge.tsx).
export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const { variant, etikettKey } = timerStatusEtikett(status);
  return <Badge variant={variant}>{t(etikettKey)}</Badge>;
}
