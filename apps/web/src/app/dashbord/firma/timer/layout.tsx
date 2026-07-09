"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { useFirma } from "@/kontekst/firma-kontekst";

export default function FirmaTimerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const { data: status, isLoading } = trpc.timer.onboarding.status.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );

  const sub = [
    { href: "/dashbord/firma/timer/onboarding", label: t("firma.timer.fane.onboarding") },
    { href: "/dashbord/firma/timer/oppsett", label: t("firma.timer.fane.oppsett") },
    { href: "/dashbord/firma/timer/lonnsarter", label: t("firma.timer.fane.lonnsarter") },
    { href: "/dashbord/firma/timer/aktiviteter", label: t("firma.timer.fane.aktiviteter") },
    { href: "/dashbord/firma/timer/tillegg", label: t("firma.timer.fane.tillegg") },
    { href: "/dashbord/firma/timer/attestering", label: t("firma.timer.fane.attestering") },
  ];

  // Før aktivering: vis kun onboarding + oppsett-veiviseren (steg 1 aktiverer)
  const filtrert = status?.harTimerModul ? sub : sub.slice(0, 2);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {t("firma.timer.tittel")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t("firma.timer.beskrivelse")}
        </p>
      </div>

      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {filtrert.map((fane) => {
            const aktiv = pathname === fane.href || pathname.startsWith(fane.href + "/");
            return (
              <Link
                key={fane.href}
                href={fane.href}
                className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                  aktiv
                    ? "border-sitedoc-primary text-sitedoc-primary"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {fane.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
