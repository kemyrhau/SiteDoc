"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import { Plus, Pencil, Trash2, MapPin, HelpCircle } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";
import { AvstanderFane } from "./AvstanderFane";
import { OppmotestedModal, type OppmotestedRad } from "./OppmotestedModal";

type Fane = "steder" | "avstander";

export default function OppmotesterSide() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const [redigerRad, setRedigerRad] = useState<OppmotestedRad | null>(null);
  const [visOpprett, setVisOpprett] = useState(false);
  const [visHjelp, setVisHjelp] = useState(false);
  // POST (10) B: fanen «Avstander». `?fane=avstander` lar «Dette må være på
  // plass» i firmainnstillinger lenke rett hit (leses i effekt — ingen
  // Suspense-grense for useSearchParams).
  const [fane, setFane] = useState<Fane>("steder");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("fane") === "avstander") {
      setFane("avstander");
    }
  }, []);
  function velgFane(f: Fane) {
    setFane(f);
    const url = new URL(window.location.href);
    if (f === "avstander") url.searchParams.set("fane", "avstander");
    else url.searchParams.delete("fane");
    window.history.replaceState(null, "", url.toString());
  }

  const { data: rader, isLoading } = trpc.oppmotested.hentAlle.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );

  const slett = trpc.oppmotested.slett.useMutation({
    onSuccess: () => utils.oppmotested.hentAlle.invalidate(),
    onError: (e) => alert(e.message),
  });

  const [slettRad, setSlettRad] = useState<OppmotestedRad | null>(null);

  if (!orgId) {
    return (
      <p className="text-sm text-gray-500">{t("firma.oppmotested.velgFirma")}</p>
    );
  }

  return (
    <div>
      <SonetonetSidehode sone="firma" className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-gray-600">
            {t("firma.oppmotested.beskrivelse")}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVisHjelp(true)}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title={t("hjelp.tittel")}
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            {fane === "steder" && (
              <Button onClick={() => setVisOpprett(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t("firma.oppmotested.leggTil")}
              </Button>
            )}
          </div>
        </div>
      </SonetonetSidehode>

      <Modal
        open={visHjelp}
        onClose={() => setVisHjelp(false)}
        title={
          fane === "avstander"
            ? t("firma.avstander.hjelp.tittel")
            : t("firma.oppmotested.hjelp.tittel")
        }
      >
        {fane === "avstander" ? (
          <div className="space-y-2 text-sm text-gray-600">
            <p>{t("firma.avstander.hjelp.hva")}</p>
            <p>{t("firma.avstander.hjelp.enhet")}</p>
            <p>{t("firma.avstander.hjelp.manuell")}</p>
            <p>{t("firma.avstander.hjelp.status")}</p>
            <p>{t("firma.avstander.hjelp.kontor")}</p>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-gray-600">
            <p>{t("firma.oppmotested.hjelp.hva")}</p>
            <p>{t("firma.oppmotested.hjelp.adresse")}</p>
            <p>{t("firma.oppmotested.hjelp.gps")}</p>
            <p>{t("firma.oppmotested.hjelp.personvern")}</p>
          </div>
        )}
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={() => setVisHjelp(false)}>
            {t("handling.lukk")}
          </Button>
        </div>
      </Modal>

      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {(["steder", "avstander"] as const).map((f) => (
          <button
            key={f}
            onClick={() => velgFane(f)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              fane === f
                ? "border-sitedoc-primary text-sitedoc-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {f === "steder" ? t("firma.avstander.faneSteder") : t("firma.avstander.fane")}
          </button>
        ))}
      </div>

      {fane === "avstander" ? (
        <AvstanderFane orgId={orgId} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !rader || rader.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">{t("firma.oppmotested.ingen")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">{t("firma.oppmotested.felt.navn")}</th>
                <th className="px-3 py-3">{t("firma.oppmotested.felt.adresse")}</th>
                <th className="px-3 py-3 text-right">{t("firma.oppmotested.felt.koordinat")}</th>
                <th className="px-3 py-3 text-right">{t("firma.oppmotested.felt.radius")}</th>
                <th className="px-3 py-3">{t("firma.oppmotested.felt.avdeling")}</th>
                <th className="px-3 py-3">{t("firma.timer.felt.status")}</th>
                <th className="px-3 py-3 text-right">{t("handling.handlinger")}</th>
              </tr>
            </thead>
            <tbody>
              {(rader as OppmotestedRad[]).map((rad) => (
                <tr key={rad.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-3 font-medium text-gray-900">{rad.navn}</td>
                  <td className="px-3 py-3 text-gray-600">{rad.adresse ?? "—"}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-gray-500">
                    {rad.lat.toFixed(5)}, {rad.lng.toFixed(5)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-600">{rad.radiusM} m</td>
                  <td className="px-3 py-3 text-gray-600">{rad.avdeling?.navn ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        rad.aktiv
                          ? "rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"
                          : "rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                      }
                    >
                      {rad.aktiv ? t("status.aktiv") : t("status.inaktiv")}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setRedigerRad(rad)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title={t("handling.rediger")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setSlettRad(rad)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title={t("handling.slett")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(visOpprett || redigerRad) && (
        <OppmotestedModal
          orgId={orgId}
          rad={redigerRad}
          onLukk={() => {
            setVisOpprett(false);
            setRedigerRad(null);
          }}
        />
      )}

      <Modal
        open={!!slettRad}
        onClose={() => setSlettRad(null)}
        title={t("firma.oppmotested.slettTittel")}
      >
        <p className="text-sm text-gray-600">
          {t("firma.oppmotested.slettBekreft", { navn: slettRad?.navn ?? "" })}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSlettRad(null)}>
            {t("handling.avbryt")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (slettRad) slett.mutate({ id: slettRad.id, organizationId: orgId });
              setSlettRad(null);
            }}
          >
            {t("handling.slett")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
