"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
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
  const { valgtFirma, isLoading: firmaLaster } = useFirma();
  const orgId = valgtFirma?.id;
  const { data: status, isLoading } = trpc.timer.onboarding.status.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );

  const sub = [
    { href: "/dashbord/firma/timer", label: t("firma.timer.fane.oversikt") },
    { href: "/dashbord/firma/timer/oppsett", label: t("firma.timer.fane.oppsett") },
    { href: "/dashbord/firma/timer/lonnsarter", label: t("firma.timer.fane.lonnsarter") },
    { href: "/dashbord/firma/timer/aktiviteter", label: t("firma.timer.fane.aktiviteter") },
    { href: "/dashbord/firma/timer/tillegg", label: t("firma.timer.fane.tillegg") },
    { href: "/dashbord/firma/timer/utleggskategorier", label: t("firma.timer.fane.utleggskategorier") },
    { href: "/dashbord/firma/timer/attestering", label: t("firma.timer.fane.attestering") },
  ];

  // Før aktivering: vis kun onboarding + oppsett-veiviseren (steg 1 aktiverer)
  const filtrert = status?.harTimerModul ? sub : sub.slice(0, 2);

  // Mens firma-konteksten selv laster (henter medlemskap/tilgjengelige firma)
  // er valgtFirma ennå ikke avgjort → spinner, IKKE «ingen firma» (ellers
  // flasher meldingen for en bruker som har et lagret firma).
  if (firmaLaster) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // «Ingen firma valgt» ≠ «laster». Uten orgId er status-spørringen DISABLET
  // (enabled: !!orgId), og en disablet React Query fullfører aldri — barne-
  // sidene henger på `!status` (evig spinner, ingen onboarding.status-kall).
  // Guard her (layouten wrapper alle timer-undersider), så vi viser en tilstand
  // som SIER det + peker til firmavelgeren, i stedet for spinner. isLoading-
  // sjekken under gjelder nå kun når spørringen faktisk kjører (orgId finnes).
  if (!orgId) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            {t("firma.timer.tittel")}
          </h1>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("firma.timer.ingenFirma")}</span>
        </div>
      </div>
    );
  }

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
            // Hjem-fanen (base-ruta) matcher KUN eksakt — ellers ville
            // startsWith("/dashbord/firma/timer/") slått til på alle undersider.
            const aktiv =
              fane.href === "/dashbord/firma/timer"
                ? pathname === fane.href
                : pathname === fane.href || pathname.startsWith(fane.href + "/");
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
