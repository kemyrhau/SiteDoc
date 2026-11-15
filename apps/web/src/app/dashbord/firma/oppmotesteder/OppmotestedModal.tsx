"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal } from "@sitedoc/ui";
import { Search } from "lucide-react";
import { AdresseTreffliste, type AdresseTreff } from "@/components/AdresseTreffliste";

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

export type OppmotestedRad = {
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

/**
 * Opprett/rediger oppmøtested (firmaadmin). Flyttet ut av page.tsx for test
 * (Next-page kan ikke ha vilkårlige named exports) — TILLEGG 2026-11-15 (13) L2 del C.
 */
export function OppmotestedModal({
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
  const [adresseTreff, setAdresseTreff] = useState<AdresseTreff[]>([]);

  const { data: avdelinger } = trpc.avdeling.hentAlle.useQuery({ organizationId: orgId });

  // TILLEGG 2026-11-15 (13) L2 del C: samme adressesøk + treffliste som
  // byggeplass. Valgt treff setter punkt + adressetekst. 0 treff sperrer ikke
  // lagring — punktet kan settes på kartet.
  const velgTreff = (treff: AdresseTreff) => {
    setLat(String(treff.lat));
    setLng(String(treff.lng));
    setAdresse(treff.label);
    setAdresseTreff([]);
    setGeokodMelding(null);
  };
  const geokod = trpc.oppmotested.geokod.useMutation({
    onSuccess: (treff: AdresseTreff[]) => {
      if (treff.length === 0) {
        setAdresseTreff([]);
        setGeokodMelding(t("firma.oppmotested.geokodIngen"));
      } else if (treff.length === 1) {
        velgTreff(treff[0]!); // ett treff → sett direkte
      } else {
        setAdresseTreff(treff); // flere → klikkbar treffliste
        setGeokodMelding(null);
      }
    },
    onError: (e: { message: string }) => {
      setAdresseTreff([]);
      setGeokodMelding(e.message);
    },
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
                  setAdresseTreff([]);
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
          <AdresseTreffliste treff={adresseTreff} onVelg={velgTreff} />
          {geokodMelding && (
            <p className="mt-1 text-xs text-sitedoc-error">{geokodMelding}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">{t("georef.attribusjonKartverket")}</p>
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
