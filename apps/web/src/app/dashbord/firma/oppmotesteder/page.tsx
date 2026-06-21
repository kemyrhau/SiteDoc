"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal, Spinner } from "@sitedoc/ui";
import { Plus, Pencil, Trash2, MapPin, HelpCircle, Search } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";

// Leaflet krever window — laster dynamisk uten SSR
const KartVelgerDynamic = dynamic(
  () => import("@/components/KartVelger").then((m) => m.KartVelger),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] animate-pulse rounded-lg bg-gray-100" />
    ),
  },
);

type OppmotestedRad = {
  id: string;
  navn: string;
  adresse: string | null;
  lat: number;
  lng: number;
  radiusM: number;
  avdelingId: string | null;
  aktiv: boolean;
  avdeling: { id: string; navn: string } | null;
};

export default function OppmotesterSide() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const [redigerRad, setRedigerRad] = useState<OppmotestedRad | null>(null);
  const [visOpprett, setVisOpprett] = useState(false);
  const [visHjelp, setVisHjelp] = useState(false);

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
      <div className="mb-4 flex items-start justify-between gap-4">
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
          <Button onClick={() => setVisOpprett(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("firma.oppmotested.leggTil")}
          </Button>
        </div>
      </div>

      <Modal
        open={visHjelp}
        onClose={() => setVisHjelp(false)}
        title={t("firma.oppmotested.hjelp.tittel")}
      >
        <div className="space-y-2 text-sm text-gray-600">
          <p>{t("firma.oppmotested.hjelp.hva")}</p>
          <p>{t("firma.oppmotested.hjelp.adresse")}</p>
          <p>{t("firma.oppmotested.hjelp.gps")}</p>
          <p>{t("firma.oppmotested.hjelp.personvern")}</p>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={() => setVisHjelp(false)}>
            {t("handling.lukk")}
          </Button>
        </div>
      </Modal>

      {isLoading ? (
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

function OppmotestedModal({
  orgId,
  rad,
  onLukk,
}: {
  orgId: string;
  rad: OppmotestedRad | null;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const erRediger = !!rad;

  const [navn, setNavn] = useState(rad?.navn ?? "");
  const [adresse, setAdresse] = useState(rad?.adresse ?? "");
  const [lat, setLat] = useState(rad ? String(rad.lat) : "");
  const [lng, setLng] = useState(rad ? String(rad.lng) : "");
  const [radiusM, setRadiusM] = useState(String(rad?.radiusM ?? 150));
  const [avdelingId, setAvdelingId] = useState(rad?.avdelingId ?? "");
  const [geokodMelding, setGeokodMelding] = useState<string | null>(null);

  const { data: avdelinger } = trpc.avdeling.hentAlle.useQuery({ organizationId: orgId });

  const geokod = trpc.oppmotested.geokod.useMutation({
    onSuccess: (treff) => {
      if (treff) {
        setLat(String(treff.lat));
        setLng(String(treff.lng));
        setGeokodMelding(null);
      } else {
        setGeokodMelding(t("firma.oppmotested.geokodIngen"));
      }
    },
    onError: (e) => setGeokodMelding(e.message),
  });

  const ferdig = () => {
    utils.oppmotested.hentAlle.invalidate();
    onLukk();
  };
  const opprett = trpc.oppmotested.opprett.useMutation({ onSuccess: ferdig, onError: (e) => alert(e.message) });
  const oppdater = trpc.oppmotested.oppdater.useMutation({ onSuccess: ferdig, onError: (e) => alert(e.message) });

  const latNum = parseFloat(lat.replace(",", "."));
  const lngNum = parseFloat(lng.replace(",", "."));
  const radiusNum = parseInt(radiusM, 10);
  const gyldig =
    navn.trim().length > 0 &&
    Number.isFinite(latNum) && latNum >= -90 && latNum <= 90 &&
    Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180 &&
    Number.isFinite(radiusNum) && radiusNum >= 10;

  function lagre() {
    if (!gyldig) return;
    const felles = {
      navn: navn.trim(),
      adresse: adresse.trim() || undefined,
      lat: latNum,
      lng: lngNum,
      radiusM: radiusNum,
      avdelingId: avdelingId || null,
      organizationId: orgId,
    };
    if (erRediger && rad) {
      oppdater.mutate({ id: rad.id, ...felles });
    } else {
      opprett.mutate(felles);
    }
  }

  return (
    <Modal
      open
      onClose={onLukk}
      title={erRediger ? t("firma.oppmotested.rediger") : t("firma.oppmotested.nytt")}
    >
      <div className="space-y-3">
        <Input
          label={t("firma.oppmotested.felt.navn")}
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          placeholder={t("firma.oppmotested.navnPlaceholder")}
        />
        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label={t("firma.oppmotested.felt.adresse")}
                value={adresse}
                onChange={(e) => {
                  setAdresse(e.target.value);
                  setGeokodMelding(null);
                }}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                geokod.mutate({ organizationId: orgId, adresse: adresse.trim() })
              }
              disabled={adresse.trim().length === 0 || geokod.isPending}
            >
              <Search className="mr-1.5 h-4 w-4" />
              {geokod.isPending
                ? t("firma.oppmotested.geokodLaster")
                : t("firma.oppmotested.geokod")}
            </Button>
          </div>
          {geokodMelding && (
            <p className="mt-1 text-xs text-sitedoc-error">{geokodMelding}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("firma.oppmotested.felt.lat")}
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="68.4385"
          />
          <Input
            label={t("firma.oppmotested.felt.lng")}
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="17.4272"
          />
        </div>
        <p className="text-xs text-gray-400">{t("firma.oppmotested.koordinatHjelp")}</p>
        <div>
          <KartVelgerDynamic
            latitude={Number.isFinite(latNum) ? latNum : null}
            longitude={Number.isFinite(lngNum) ? lngNum : null}
            radiusM={Number.isFinite(radiusNum) ? radiusNum : null}
            onVelgPosisjon={(nyLat, nyLng) => {
              setLat(String(nyLat));
              setLng(String(nyLng));
            }}
            hoyde="260px"
          />
          <p className="mt-1 text-xs text-gray-400">{t("firma.oppmotested.kartHjelp")}</p>
        </div>
        <Input
          label={t("firma.oppmotested.felt.radius")}
          type="number"
          value={radiusM}
          onChange={(e) => setRadiusM(e.target.value)}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.oppmotested.felt.avdeling")}
          </label>
          <select
            value={avdelingId}
            onChange={(e) => setAvdelingId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t("firma.oppmotested.ingenAvdeling")}</option>
            {(avdelinger ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.navn}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onLukk}>
          {t("handling.avbryt")}
        </Button>
        <Button onClick={lagre} disabled={!gyldig || opprett.isPending || oppdater.isPending}>
          {t("handling.lagre")}
        </Button>
      </div>
    </Modal>
  );
}
