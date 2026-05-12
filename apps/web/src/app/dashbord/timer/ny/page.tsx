"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Spinner } from "@sitedoc/ui";
import { ArrowLeft, MapPin } from "lucide-react";
import { ProsjektRadVelger } from "@/components/timer/ProsjektRadVelger";

function nyUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function iDag(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Haversine-avstand i meter mellom to GPS-punkter. */
function avstandMeter(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Jordens radius i meter
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const GEO_RADIUS_METER = 500;

export default function NyDagsseddelSide() {
  const { t } = useTranslation();
  const router = useRouter();

  const [clientUuid] = useState(() => nyUuid());

  const [dato, setDato] = useState(iDag());
  const [aktivitetId, setAktivitetId] = useState<string>("");
  const [pauseMin, setPauseMin] = useState(0);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [valgtProsjektId, setValgtProsjektId] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [geoForslagId, setGeoForslagId] = useState<string | null>(null);
  const [geoSjekket, setGeoSjekket] = useState(false);

  const { data: aktiviteter, isLoading: aktiviteterLaster } =
    trpc.timer.aktivitet.list.useQuery();
  const { data: prosjekterRaw, isLoading: prosjekterLaster } =
    trpc.prosjekt.hentMine.useQuery();

  type ProsjektMedGps = {
    id: string;
    name: string;
    projectNumber: string;
    latitude: number | null;
    longitude: number | null;
  };

  const prosjekter = useMemo<ProsjektMedGps[]>(
    () =>
      (prosjekterRaw ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        projectNumber: p.projectNumber,
        latitude: (p as unknown as { latitude: number | null }).latitude ?? null,
        longitude:
          (p as unknown as { longitude: number | null }).longitude ?? null,
      })),
    [prosjekterRaw],
  );

  // Geo-forslag: ved mount, spør om posisjon og finn nærmeste prosjekt
  // innenfor GEO_RADIUS_METER. Forhåndsvelg hvis ingen valgt fra før.
  useEffect(() => {
    if (geoSjekket) return;
    if (prosjekterLaster || prosjekter.length === 0) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoSjekket(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let beste: { id: string; avstand: number } | null = null;
        for (const p of prosjekter) {
          if (p.latitude === null || p.longitude === null) continue;
          const a = avstandMeter(lat, lng, p.latitude, p.longitude);
          if (a > GEO_RADIUS_METER) continue;
          if (!beste || a < beste.avstand) {
            beste = { id: p.id, avstand: a };
          }
        }
        if (beste) {
          setGeoForslagId(beste.id);
          // Forhåndsvelg kun hvis brukeren ikke har valgt selv
          setValgtProsjektId((v) => v ?? beste.id);
        }
        setGeoSjekket(true);
      },
      () => {
        setGeoSjekket(true);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [prosjekter, prosjekterLaster, geoSjekket]);

  const opprett = trpc.timer.dagsseddel.opprett.useMutation({
    onSuccess: (sheet) => {
      router.push(`/dashbord/timer/${sheet.id}`);
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const defaultAktivitetId = useMemo(() => {
    if (!aktiviteter || aktiviteter.length === 0) return "";
    const anleggsarbeid = aktiviteter.find(
      (a) => a.navn === "Anleggsarbeid" && a.aktiv,
    );
    if (anleggsarbeid) return anleggsarbeid.id;
    const forsteAktiv = aktiviteter.find((a) => a.aktiv);
    if (forsteAktiv) return forsteAktiv.id;
    const forsteHvilkenSomHelst = aktiviteter[0];
    return forsteHvilkenSomHelst ? forsteHvilkenSomHelst.id : "";
  }, [aktiviteter]);

  const valgtAktivitetId = aktivitetId || defaultAktivitetId;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);

    if (!valgtProsjektId) {
      setFeil(t("timer.feil.prosjektPaakrevd"));
      return;
    }
    if (!valgtAktivitetId) {
      setFeil(t("timer.feil.ingenAktivitet"));
      return;
    }

    function tilstartAt(verdi: string): string | null {
      if (!verdi) return null;
      return new Date(`${dato}T${verdi}:00`).toISOString();
    }

    opprett.mutate({
      clientUuid,
      projectId: valgtProsjektId,
      aktivitetId: valgtAktivitetId,
      dato,
      startAt: tilstartAt(startAt),
      endAt: tilstartAt(endAt),
      pauseMin,
      beskrivelse: beskrivelse.trim() || null,
    });
  }

  if (aktiviteterLaster || prosjekterLaster) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const geoForslag = geoForslagId
    ? prosjekter.find((p) => p.id === geoForslagId)
    : null;
  const visIngenGeoForslag = geoSjekket && !geoForslagId;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link
        href="/dashbord/timer/mine"
        className="mb-3 inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("timer.tilbake")}
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-gray-900">
        {t("timer.nyDagsseddel")}
      </h1>
      <p className="mb-6 text-sm text-gray-600">{t("timer.nyBeskrivelse")}</p>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-lg border border-gray-200 bg-white p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.prosjekt")}
          </label>
          <ProsjektRadVelger
            valgtId={valgtProsjektId}
            onVelg={setValgtProsjektId}
            prosjekter={prosjekter}
          />
          {geoForslag && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700">
              <MapPin className="h-3 w-3" />
              {t("timer.geoForslag")}: {geoForslag.name}
              {geoForslag.projectNumber ? ` (${geoForslag.projectNumber})` : ""}
            </p>
          )}
          {visIngenGeoForslag && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="h-3 w-3" />
              {t("timer.ingenGeoForslag")}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.dato")}
          </label>
          <Input
            type="date"
            value={dato}
            onChange={(e) => setDato(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.aktivitet")}
          </label>
          <select
            value={valgtAktivitetId}
            onChange={(e) => setAktivitetId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">{t("timer.velgAktivitet")}</option>
            {aktiviteter?.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.aktiv}>
                {a.navn}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-md border border-gray-200 p-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("timer.arbeidstidIDag")}
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            {t("timer.arbeidstidIDagBeskrivelse")}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("timer.felt.startTid")}
              </label>
              <Input
                type="time"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("timer.felt.sluttTid")}
              </label>
              <Input
                type="time"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("timer.felt.pauseMin")}
              </label>
              <Input
                type="number"
                min={0}
                value={pauseMin}
                onChange={(e) => setPauseMin(parseInt(e.target.value || "0"))}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.beskrivelse")}
            <span className="ml-1 text-xs text-gray-400">
              ({t("label.valgfritt")})
            </span>
          </label>
          <textarea
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
            rows={3}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {feil && <p className="text-sm text-red-600">{feil}</p>}

        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500">{t("timer.nyHjelpetekst")}</p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/dashbord/timer/mine")}
            >
              {t("handling.avbryt")}
            </Button>
            <Button type="submit" disabled={opprett.isPending || !valgtProsjektId}>
              {opprett.isPending ? t("handling.lagrer") : t("timer.opprett")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
