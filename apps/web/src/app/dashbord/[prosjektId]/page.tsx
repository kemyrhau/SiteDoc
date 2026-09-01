"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MoreVertical, Settings, Printer, Download, Check, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, Spinner, StatusBadge } from "@sitedoc/ui";
import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";
import { DashbordPanel } from "@/components/paneler/DashbordPanel";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";
import { prosjektOnboardingWizard } from "@/lib/onboarding-wizard";

export default function ProsjektOversikt() {
  useToppbarFiltre({ byggeplass: false });
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { data: prosjekt, isLoading } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.prosjektId },
  );
  const { data: onboardingStatus } = trpc.prosjekt.hentOnboardingStatus.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  const [merMenyAapen, setMerMenyAapen] = useState(false);
  const merRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (merRef.current && !merRef.current.contains(e.target as Node)) {
        setMerMenyAapen(false);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  if (isLoading || !prosjekt) {
    return (
      <>
        <SekundaertPanel tittel="Prosjekter">
          <DashbordPanel />
        </SekundaertPanel>
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  const erAdmin = prosjekt.members.some(
    (m) =>
      (m.user?.id === session?.user?.id || m.user?.email === session?.user?.email) &&
      (m.role === "admin" || m.role === "owner"),
  );

  // Prøveperiode: basert på trialExpiresAt, fallback til createdAt + 30 dager
  const harFirma = !!(prosjekt as unknown as { projectOrganizations?: unknown[] }).projectOrganizations?.length;
  const erDeaktivert = prosjekt.status === "deactivated";
  const dagerIgjen = (() => {
    if (harFirma) return null;
    const trialUtloper = (prosjekt as unknown as { trialExpiresAt?: string | null }).trialExpiresAt;
    const utloper = trialUtloper
      ? new Date(trialUtloper)
      : (() => { const d = new Date(prosjekt.createdAt); d.setDate(d.getDate() + 30); return d; })();
    return Math.ceil((utloper.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  })();

  const basePath = `/dashbord/${params.prosjektId}`;

  const kort = [
    {
      label: t("dashbord.faggrupper"),
      verdi: prosjekt.faggrupper.length,
      href: `${basePath}/faggrupper`,
    },
    {
      label: t("dashbord.maler"),
      verdi: prosjekt.templates.length,
      href: `${basePath}/maler`,
    },
    {
      label: t("dashbord.medlemmer"),
      verdi: prosjekt.members.length,
      href: basePath,
    },
  ];

  return (
    <>
      <SekundaertPanel tittel="Prosjekter">
        <DashbordPanel />
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {erDeaktivert && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {t("dashbord.proveperiodeUtlopt")}
          </div>
        )}
        {!erDeaktivert && dagerIgjen !== null && dagerIgjen <= 14 && (
          <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            dagerIgjen <= 0
              ? "border-red-200 bg-red-50 text-red-800"
              : dagerIgjen <= 7
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
          }`}>
            {dagerIgjen <= 0
              ? t("dashbord.proveperiodeDeaktiveres")
              : t("dashbord.proveperiode", { dager: dagerIgjen })
            }
          </div>
        )}
        {erAdmin && onboardingStatus && (() => {
          // Datadrevet fra prosjektOnboardingWizard. Det NYE er forklaringen: hvert
          // steg bærer en hensikt-tekst (HVORFOR steget finnes), ikke bare en avhuking.
          // Modul-steg vises kun når modulen er aktiv (`synlig`). Banneret forsvinner
          // når alle synlige steg er ferdige, og vises kun for admin — uendret.
          const synligeSteg = prosjektOnboardingWizard.steg.filter(
            (s) => !s.synlig || s.synlig(onboardingStatus),
          );
          const alleFerdige = synligeSteg.every((s) => s.ferdig(onboardingStatus));
          if (alleFerdige) return null;
          return (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-700">
                {t("onboarding.bannerTittel")}
              </div>
              <ul className="space-y-1">
                {synligeSteg.map((s) => {
                  const ferdig = s.ferdig(onboardingStatus);
                  const undertekst = s.undertekstKey?.(onboardingStatus) ?? null;
                  const avsnitt = s.beskrivelseKey
                    ? t(s.beskrivelseKey).split("\n\n")
                    : [];
                  const innhold = (
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0">
                        {ferdig ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="inline-block h-4 w-4 rounded-sm border border-gray-400 bg-white" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                          {t(s.tittelKey)}
                          {s.href && <ArrowRight className="h-3.5 w-3.5 text-blue-500" />}
                        </div>
                        {avsnitt.map((avsn, i) => (
                          <p key={i} className="mt-1 text-xs leading-relaxed text-gray-600">
                            {avsn}
                          </p>
                        ))}
                        {undertekst && (
                          <p className="mt-1 text-[11px] font-medium text-amber-700">
                            {t(undertekst)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                  return (
                    <li key={s.id}>
                      {s.href ? (
                        <Link
                          href={s.href}
                          className="-m-2 block rounded-md p-2 transition-colors hover:bg-blue-100/50"
                        >
                          {innhold}
                        </Link>
                      ) : (
                        <div className="-m-2 p-2">{innhold}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })()}
        <SonetonetSidehode sone="prosjekt" className="mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{prosjekt.name}</h2>
          <StatusBadge status={prosjekt.status} />
          <div className="ml-auto" ref={merRef}>
            <div className="relative">
              <button
                onClick={() => setMerMenyAapen(!merMenyAapen)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                title="Mer"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
              {merMenyAapen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
                  <button
                    onClick={() => {
                      setMerMenyAapen(false);
                      router.push("/dashbord/oppsett");
                    }}
                    disabled={!erAdmin}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Settings className="h-4 w-4" />
                    {t("dashbord.prosjektinnstillinger")}
                  </button>
                  <button
                    onClick={() => {
                      setMerMenyAapen(false);
                      window.print();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Printer className="h-4 w-4" />
                    {t("handling.skrivUt")}
                  </button>
                  <button
                    onClick={() => {
                      setMerMenyAapen(false);
                      // TODO: Implementer eksport
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4" />
                    {t("handling.eksporter")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {prosjekt.internalProjectNumber && (
          <p className="mb-1 text-sm text-gray-500">{prosjekt.internalProjectNumber}</p>
        )}
        {prosjekt.address && (
          <p className="mb-6 text-sm text-gray-400">{prosjekt.address}</p>
        )}
        </SonetonetSidehode>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {kort.map((k) => (
            <Link key={k.label} href={k.href}>
              <Card className="text-center transition-shadow hover:shadow-md">
                <p className="text-3xl font-bold text-sitedoc-primary">{k.verdi}</p>
                <p className="text-sm text-gray-500">{k.label}</p>
              </Card>
            </Link>
          ))}
        </div>

        {prosjekt.description && (
          <Card className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-gray-500">{t("dashbord.beskrivelse")}</h3>
            <p className="text-sm text-gray-700">{prosjekt.description}</p>
          </Card>
        )}

        {prosjekt.members.length > 0 && (
          <Card>
            <h3 className="mb-3 text-sm font-medium text-gray-500">{t("dashbord.medlemmer")}</h3>
            <div className="divide-y divide-gray-100">
              {(prosjekt.members as Array<{
                id: string;
                role: string;
                user?: { name?: string | null; email?: string | null } | null;
                faggruppeKoblinger?: Array<{ faggruppe: { name: string } }>;
              }>).map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{m.user?.name ?? m.user?.email ?? "–"}</p>
                    <p className="text-xs text-gray-400">{m.faggruppeKoblinger?.map((me) => me.faggruppe.name).join(", ")}</p>
                  </div>
                  <span className="text-xs text-gray-500">{m.role}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
