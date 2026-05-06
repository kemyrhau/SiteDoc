"use client";

import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";

export function ImpersoneringBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, isLoading } = trpc.admin.hentImpersoneringStatus.useQuery(
    undefined,
    {
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
    },
  );

  const stopp = trpc.admin.stoppImpersonering.useMutation({
    onSuccess: () => {
      router.refresh();
      // Hard reload sikrer at tRPC-cache resettes og admin-UI kommer tilbake
      if (typeof window !== "undefined") window.location.href = "/dashbord";
    },
  });

  if (isLoading || !data || !data.aktiv) return null;

  const navn = data.target?.name ?? data.target?.email ?? "ukjent";
  const firma = data.target?.organization?.name;

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 flex-shrink-0" />
        <span>
          <strong>{t("impersonering.banner.tittel")}:</strong>{" "}
          {t("impersonering.banner.melding", { navn, firma: firma ?? "—" })}
        </span>
      </div>
      <button
        onClick={() => stopp.mutate()}
        disabled={stopp.isPending}
        className="rounded-md border border-amber-700 bg-white px-3 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-50 disabled:opacity-50"
      >
        {stopp.isPending ? t("impersonering.banner.stopper") : t("impersonering.banner.stopp")}
      </button>
    </div>
  );
}
