"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";

type Bruker = {
  id: string;
  ansattRolle: string;
  firmaRoller: string[];
  user: { id: string; name: string | null; email: string; role: string } | null;
};

export function BrukereFane({ brukere }: { brukere: Bruker[] }) {
  const { t } = useTranslation();

  if (brukere.length === 0) {
    return <EmptyState title={t("admin.firmaDetalj.ingenBrukereTittel")} description={t("admin.firmaDetalj.ingenBrukereBeskrivelse")} />;
  }

  return (
    <div className="space-y-1.5">
      {brukere.map((m) => {
        const u = m.user;
        return (
          <div
            key={m.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-4 py-2.5 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-gray-900">{u?.name ?? u?.email ?? "—"}</div>
              {u?.name && <div className="truncate text-xs text-gray-500">{u.email}</div>}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{m.ansattRolle}</span>
              {/* Fase 2: badge leser medlemsradens firmaRoller (ny kilde), ikke
                  User.role — badgen skal aldri si «admin» når firma-gatingen sier
                  nei. Spør «er DENNE brukeren firma-admin», derfor kilden direkte
                  og ikke kanAdministrereFirma (som svarer «kan JEG administrere»). */}
              {m.firmaRoller.includes("firma_admin") && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                  {t("admin.firmaDetalj.rolleAdmin")}
                </span>
              )}
              {u?.role === "sitedoc_admin" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  {t("admin.firmaDetalj.rolleSitedocAdmin")}
                </span>
              )}
              {u && u.role !== "sitedoc_admin" && <ImperserKnapp targetUserId={u.id} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ImperserKnapp({ targetUserId }: { targetUserId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const start = trpc.admin.startImpersonering.useMutation({
    onSuccess: () => {
      if (typeof window !== "undefined") window.location.href = "/dashbord";
      router.refresh();
    },
  });
  return (
    <button
      type="button"
      onClick={() => start.mutate({ targetUserId })}
      disabled={start.isPending}
      title={t("admin.firmaDetalj.imperserHint")}
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-amber-50 hover:text-amber-900 disabled:opacity-50"
    >
      {start.isPending ? "..." : t("admin.firmaDetalj.imperser")}
    </button>
  );
}
