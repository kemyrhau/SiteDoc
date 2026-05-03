"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useFirma } from "@/kontekst/firma-kontekst";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import { Clock, Truck, Award, BarChart3, Package, Check, X } from "lucide-react";
import type { JSX } from "react";

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
    status: "kommer-snart",
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

  const [bekreftDeaktiver, setBekreftDeaktiver] = useState<ModulSlug | null>(null);

  const settModul = trpc.organisasjon.settFirmamodul.useMutation({
    onSuccess: () => {
      utils.organisasjon.hentTilgjengelige.invalidate();
      utils.organisasjon.hentMin.invalidate();
      utils.organisasjon.hentMedId.invalidate();
      setBekreftDeaktiver(null);
    },
  });

  if (!valgtFirma || !orgId) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  function erAktiv(slug: ModulSlug): boolean {
    if (slug === "timer") return valgtFirma!.harTimerModul;
    if (slug === "maskin") return valgtFirma!.harMaskinModul;
    return false;
  }

  function aktiver(slug: ModulSlug) {
    if (slug !== "timer" && slug !== "maskin") return;
    settModul.mutate({ organizationId: orgId!, slug, aktiver: true });
  }

  function bekreftAvslutt() {
    if (!bekreftDeaktiver) return;
    if (bekreftDeaktiver !== "timer" && bekreftDeaktiver !== "maskin") return;
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
    </div>
  );
}
