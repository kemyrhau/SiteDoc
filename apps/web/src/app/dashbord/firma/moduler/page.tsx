"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useFirma } from "@/kontekst/firma-kontekst";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import { Clock, Truck, Award, BarChart3, Package, Check, X, ArrowRight } from "lucide-react";
import type { JSX } from "react";
import {
  MODUL_WIZARD_URL,
  timerOnboardingWizard,
  antallGjenstår,
  erOnboardingFullført,
} from "@/lib/onboarding-wizard";

type ModulSlug = "timer" | "maskin" | "kompetanse" | "fremdrift" | "varelager";
type ModulStatus = "tilgjengelig" | "kommer-snart";

interface ModulDef {
  slug: ModulSlug;
  status: ModulStatus;
  ikon: JSX.Element;
  navnNoekkel: string;
  beskrivelseNoekkel: string;
}

const MODULER: ModulDef[] = [
  {
    slug: "timer",
    status: "tilgjengelig",
    ikon: <Clock className="h-5 w-5" />,
    navnNoekkel: "firma.moduler.timer.navn",
    beskrivelseNoekkel: "firma.moduler.timer.beskrivelse",
  },
  {
    slug: "maskin",
    status: "tilgjengelig",
    ikon: <Truck className="h-5 w-5" />,
    navnNoekkel: "firma.moduler.maskin.navn",
    beskrivelseNoekkel: "firma.moduler.maskin.beskrivelse",
  },
  {
    slug: "kompetanse",
    status: "kommer-snart",
    ikon: <Award className="h-5 w-5" />,
    navnNoekkel: "firma.moduler.kompetanse.navn",
    beskrivelseNoekkel: "firma.moduler.kompetanse.beskrivelse",
  },
  {
    slug: "fremdrift",
    status: "kommer-snart",
    ikon: <BarChart3 className="h-5 w-5" />,
    navnNoekkel: "firma.moduler.fremdrift.navn",
    beskrivelseNoekkel: "firma.moduler.fremdrift.beskrivelse",
  },
  {
    slug: "varelager",
    status: "tilgjengelig",
    ikon: <Package className="h-5 w-5" />,
    navnNoekkel: "firma.moduler.varelager.navn",
    beskrivelseNoekkel: "firma.moduler.varelager.beskrivelse",
  },
];

export default function FirmaModulerSide() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const utils = trpc.useUtils();
  const router = useRouter();

  const [bekreftDeaktiver, setBekreftDeaktiver] = useState<ModulSlug | null>(null);
  const [oppsettModal, setOppsettModal] = useState<ModulSlug | null>(null);

  const timerAktiv = valgtFirma?.aktiveFirmamoduler.includes("timer") ?? false;

  const settModul = trpc.organisasjon.settFirmamodul.useMutation({
    onSuccess: (_data: unknown, variables) => {
      utils.organisasjon.hentTilgjengelige.invalidate();
      utils.organisasjon.hentMin.invalidate();
      utils.organisasjon.hentMedId.invalidate();
      utils.timer.onboarding.status.invalidate();
      setBekreftDeaktiver(null);
      // Auto-trigger oppsett-inngang: kun ved aktivering av modul med wizard.
      if (variables.aktiver && MODUL_WIZARD_URL[variables.slug]) {
        setOppsettModal(variables.slug);
      }
    },
  });

  // Timer-onboarding-status for «Fullfør oppsett»-indikatoren (datadrevet).
  const { data: timerStatus } = trpc.timer.onboarding.status.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId && timerAktiv },
  );

  if (!valgtFirma || !orgId) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  function erAktiv(slug: ModulSlug): boolean {
    return valgtFirma!.aktiveFirmamoduler.includes(slug);
  }

  function aktiver(slug: ModulSlug) {
    const def = MODULER.find((m) => m.slug === slug);
    if (def?.status !== "tilgjengelig") return;
    if (slug === "kompetanse" || slug === "fremdrift") return;
    settModul.mutate({ organizationId: orgId!, slug, aktiver: true });
  }

  function bekreftAvslutt() {
    if (!bekreftDeaktiver) return;
    const def = MODULER.find((m) => m.slug === bekreftDeaktiver);
    if (def?.status !== "tilgjengelig") return;
    if (bekreftDeaktiver === "kompetanse" || bekreftDeaktiver === "fremdrift") return;
    settModul.mutate({ organizationId: orgId!, slug: bekreftDeaktiver, aktiver: false });
  }

  return (
    <div>
      <h1 className="mb-2 text-lg font-semibold text-gray-900">
        {t("firma.moduler.tittel")}
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        {t("firma.moduler.beskrivelse")}
      </p>

      <div className="space-y-3">
        {MODULER.map((m) => {
          const aktiv = erAktiv(m.slug);
          const tilgjengelig = m.status === "tilgjengelig";
          return (
            <div
              key={m.slug}
              className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-5"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  aktiv
                    ? "bg-sitedoc-success/10 text-sitedoc-success"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {m.ikon}
              </div>

              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {t(m.navnNoekkel)}
                  </h2>
                  {!tilgjengelig && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                      {t("firma.moduler.kommerSnart")}
                    </span>
                  )}
                  {tilgjengelig && aktiv && (
                    <span className="inline-flex items-center gap-1 rounded bg-sitedoc-success/10 px-2 py-0.5 text-[11px] font-medium text-sitedoc-success">
                      <Check className="h-3 w-3" />
                      {t("firma.moduler.aktivert")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600">{t(m.beskrivelseNoekkel)}</p>

                {m.slug === "timer" &&
                  aktiv &&
                  timerStatus &&
                  !erOnboardingFullført(timerOnboardingWizard, timerStatus) && (
                    <button
                      type="button"
                      onClick={() => router.push("/dashbord/firma/timer/oppsett")}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
                    >
                      {t("firma.moduler.fullforOppsett", {
                        antall: antallGjenstår(timerOnboardingWizard, timerStatus),
                        totalt: timerOnboardingWizard.steg.length,
                      })}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
              </div>

              <div className="shrink-0">
                {!tilgjengelig ? (
                  <span className="text-xs text-gray-400">—</span>
                ) : aktiv ? (
                  <Button
                    variant="secondary"
                    onClick={() => setBekreftDeaktiver(m.slug)}
                    disabled={settModul.isPending}
                  >
                    {t("firma.moduler.deaktiver")}
                  </Button>
                ) : (
                  <Button
                    onClick={() => aktiver(m.slug)}
                    disabled={settModul.isPending}
                  >
                    {t("firma.moduler.aktiver")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {settModul.isError && (
        <p className="mt-4 text-sm text-sitedoc-error">
          {settModul.error.message}
        </p>
      )}

      <Modal
        open={bekreftDeaktiver !== null}
        onClose={() => setBekreftDeaktiver(null)}
        title={t("firma.moduler.deaktiverTittel")}
      >
        {bekreftDeaktiver && (
          <div>
            <p className="mb-2 text-sm text-gray-700">
              {t("firma.moduler.deaktiverAdvarsel", {
                modul: t(`firma.moduler.${bekreftDeaktiver}.navn`),
                firma: valgtFirma.name,
              })}
            </p>
            <p className="mb-4 text-xs text-gray-500">
              {t("firma.moduler.deaktiverDetaljer")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setBekreftDeaktiver(null)}
                disabled={settModul.isPending}
              >
                <X className="h-4 w-4" />
                {t("handling.avbryt")}
              </Button>
              <Button
                variant="danger"
                onClick={bekreftAvslutt}
                loading={settModul.isPending}
              >
                {t("firma.moduler.bekreftDeaktiver")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Auto-trigger: «{Modul} aktivert. Sett opp nå?» — kun moduler med wizard */}
      <Modal
        open={oppsettModal !== null}
        onClose={() => setOppsettModal(null)}
        title={t("firma.moduler.oppsettModal.tittel", {
          modul: oppsettModal ? t(`firma.moduler.${oppsettModal}.navn`) : "",
        })}
      >
        {oppsettModal && (
          <div>
            <p className="mb-4 text-sm text-gray-700">
              {t("firma.moduler.oppsettModal.tekst", {
                modul: t(`firma.moduler.${oppsettModal}.navn`),
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOppsettModal(null)}>
                {t("firma.moduler.oppsettModal.senere")}
              </Button>
              <Button
                onClick={() => {
                  const url = MODUL_WIZARD_URL[oppsettModal];
                  setOppsettModal(null);
                  if (url) router.push(url);
                }}
              >
                {t("firma.moduler.oppsettModal.start")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
