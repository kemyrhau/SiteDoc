"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { Button, Input, Select, Spinner } from "@sitedoc/ui";
import { MapPin, Pencil, Spline, ImageDown, Trash2 } from "lucide-react";
import { GEOFENCE_GRENSER, polygonArealM2, type Polygon } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";

const KartTegnerDynamic = dynamic(
  () => import("@/components/KartTegner").then((m) => m.KartTegner),
  { ssr: false, loading: () => <div className="h-[320px] rounded-lg bg-gray-100" /> },
);

type GpsPunkt = { lat: number; lng: number };

/*
 * V17-B / Leveranse D — sone-panelet i geofence-modalen («Soner»-formen).
 *
 * Lar admin tegne byggeplassens soner på kart (polygon eller linje→korridor via
 * geoman + server-buffer), hente geometri fra en georeferert tegning, og fjerne
 * geometri. Origo (reise-anker, B2) vises og kan flyttes (flytting → `manuell`).
 * Radius-UI er borte her (B9: sirkel ELLER soner, aldri begge) — det bor i
 * «Sirkel»-formen. Prosjektisolering: alle mutasjoner er admin-gatet på serveren.
 */

interface SoneEditorProps {
  byggeplassId: string;
  projectId: string;
  origo: GpsPunkt | null;
  /** Byggeplassens nåværende radius — bevares når origo flyttes manuelt. */
  radiusM: number | null;
  onEndret: () => void;
}

/** Areal (polygon) eller punkt-tall til sone-radens etikett. */
function geometriEtikett(
  t: (k: string, v?: Record<string, unknown>) => string,
  punkter: GpsPunkt[],
): string {
  if (punkter.length < 3) return t("lokasjoner.soner.ingenGeometri");
  const p = { form: "polygon", id: "", lat: punkter[0]!.lat, lng: punkter[0]!.lng, punkter, omradeId: "", omradeNavn: "" } as Polygon;
  const m2 = polygonArealM2(p);
  const daa = m2 / 1000;
  return t("lokasjoner.soner.areal", {
    verdi: daa >= 1 ? `${daa.toFixed(1)} daa` : `${m2} m²`,
    punkter: punkter.length,
  });
}

export function SoneEditor({ byggeplassId, projectId, origo, radiusM, onEndret }: SoneEditorProps) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: omrader, isLoading } = trpc.omrade.hentForByggeplass.useQuery({ byggeplassId });

  const [nyNavn, setNyNavn] = useState("");
  const [nyType, setNyType] = useState<"sone" | "trase">("sone");
  const [tegneForOmradeId, setTegneForOmradeId] = useState<string | null>(null);
  const [tegneModus, setTegneModus] = useState<"polygon" | "linje" | null>(null);
  const [korridorBredde, setKorridorBredde] = useState(String(GEOFENCE_GRENSER.traseKorridorBreddeM));
  const [feil, setFeil] = useState<string | null>(null);

  function nullstillTegning() {
    setTegneModus(null);
    setTegneForOmradeId(null);
  }
  function etterEndring() {
    utils.omrade.hentForByggeplass.invalidate({ byggeplassId });
    utils.bygning.hentForProsjekt.invalidate({ projectId });
    onEndret();
  }

  const opprettMutation = trpc.omrade.opprett.useMutation({
    onSuccess: () => {
      setNyNavn("");
      setNyType("sone");
      utils.omrade.hentForByggeplass.invalidate({ byggeplassId });
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });
  const settGeometriMutation = trpc.omrade.settGeometri.useMutation({
    onSuccess: () => {
      setFeil(null);
      nullstillTegning();
      etterEndring();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });
  const utledMutation = trpc.omrade.utledGeometriFraTegning.useMutation({
    onSuccess: () => {
      setFeil(null);
      etterEndring();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });
  const fjernMutation = trpc.omrade.fjernGeometri.useMutation({
    onSuccess: () => etterEndring(),
    onError: (e: { message: string }) => setFeil(e.message),
  });
  const flyttOrigoMutation = trpc.bygning.settGeofence.useMutation({
    onSuccess: () => etterEndring(),
    onError: (e: { message: string }) => setFeil(e.message),
  });

  // Soner med geometri → lesevisning på kartet.
  const sonerMedGeo = useMemo(
    () =>
      (omrader ?? [])
        .map((o) => ({
          id: o.id,
          navn: o.navn,
          punkter: Array.isArray(o.geoPolygon) ? (o.geoPolygon as GpsPunkt[]) : [],
        }))
        .filter((s) => s.punkter.length >= 3),
    [omrader],
  );

  function tegnetPolygon(punkter: GpsPunkt[]) {
    if (!tegneForOmradeId) return;
    settGeometriMutation.mutate({ omradeId: tegneForOmradeId, polygon: punkter });
  }
  function tegnetLinje(punkter: GpsPunkt[]) {
    if (!tegneForOmradeId) return;
    const bredde = Number(korridorBredde);
    settGeometriMutation.mutate({
      omradeId: tegneForOmradeId,
      linje: punkter,
      korridorBreddeM: Number.isFinite(bredde) && bredde > 0 ? bredde : undefined,
    });
  }

  function startTegning(omradeId: string, modus: "polygon" | "linje") {
    setFeil(null);
    setTegneForOmradeId(omradeId);
    setTegneModus(modus);
  }

  return (
    <div className="flex flex-col">
      <p className="mb-2 text-xs text-gray-500">{t("lokasjoner.soner.beskrivelse")}</p>

      <div className="mb-3">
        <KartTegnerDynamic
          origo={origo}
          soner={sonerMedGeo}
          tegneModus={tegneModus}
          onTegnetPolygon={tegnetPolygon}
          onTegnetLinje={tegnetLinje}
          onFlyttOrigo={(lat, lng) =>
            flyttOrigoMutation.mutate({ byggeplassId, latitude: lat, longitude: lng, radiusM })
          }
          hoyde="300px"
        />
        <p className="mt-1 text-xs text-gray-400">
          {tegneModus
            ? t("lokasjoner.soner.tegnerNaa")
            : t("lokasjoner.soner.kartHjelp")}
        </p>
      </div>

      {tegneModus === "linje" && (
        <div className="mb-3 flex items-end gap-2">
          <div className="w-40">
            <Input
              type="number"
              label={t("lokasjoner.soner.korridorbredde")}
              value={korridorBredde}
              onChange={(e) => setKorridorBredde(e.target.value)}
            />
          </div>
          <Button type="button" variant="secondary" onClick={nullstillTegning}>
            {t("handling.avbryt")}
          </Button>
        </div>
      )}

      {/* Sone-liste */}
      <div className="mb-3">
        <h4 className="mb-1 text-sm font-medium text-gray-700">
          {t("lokasjoner.soner.liste")}
        </h4>
        {isLoading ? (
          <Spinner />
        ) : (omrader?.length ?? 0) === 0 ? (
          <p className="text-xs text-gray-400">{t("lokasjoner.soner.tom")}</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {omrader!.map((o) => {
              const punkter = Array.isArray(o.geoPolygon) ? (o.geoPolygon as GpsPunkt[]) : [];
              const harGeo = punkter.length >= 3;
              const kanHenteFraTegning =
                o.tegningId != null &&
                Array.isArray(o.polygon) &&
                (o.polygon as unknown[]).length >= GEOFENCE_GRENSER.polygonMinPunkter;
              return (
                <li key={o.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-800">
                      {o.navn}
                      <span className="ml-1.5 text-xs text-gray-400">
                        {o.type === "trase" ? t("lokasjoner.soner.typeTrase") : t("lokasjoner.soner.typeSone")}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">{geometriEtikett(t, punkter)}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      title={t("lokasjoner.soner.tegnPolygon")}
                      onClick={() => startTegning(o.id, "polygon")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      title={t("lokasjoner.soner.tegnLinje")}
                      onClick={() => startTegning(o.id, "linje")}
                    >
                      <Spline className="h-4 w-4" />
                    </Button>
                    {kanHenteFraTegning && (
                      <Button
                        type="button"
                        variant="ghost"
                        title={t("lokasjoner.soner.hentFraTegning")}
                        disabled={utledMutation.isPending}
                        onClick={() => utledMutation.mutate({ omradeId: o.id })}
                      >
                        <ImageDown className="h-4 w-4" />
                      </Button>
                    )}
                    {harGeo && (
                      <Button
                        type="button"
                        variant="ghost"
                        title={t("lokasjoner.soner.fjernGeometri")}
                        disabled={fjernMutation.isPending}
                        onClick={() => fjernMutation.mutate({ omradeId: o.id })}
                      >
                        <Trash2 className="h-4 w-4 text-sitedoc-error" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Ny sone */}
      <div className="mb-3 flex items-end gap-2">
        <div className="flex-1">
          <Input
            label={t("lokasjoner.soner.nyNavn")}
            value={nyNavn}
            onChange={(e) => setNyNavn(e.target.value)}
            placeholder={t("lokasjoner.soner.nyNavnPlaceholder")}
          />
        </div>
        <div className="w-36">
          <Select
            label={t("lokasjoner.soner.nyType")}
            value={nyType}
            onChange={(e) => setNyType(e.target.value as "sone" | "trase")}
            options={[
              { value: "sone", label: t("lokasjoner.soner.typeSone") },
              { value: "trase", label: t("lokasjoner.soner.typeTrase") },
            ]}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={nyNavn.trim().length === 0 || opprettMutation.isPending}
          onClick={() =>
            opprettMutation.mutate({ projectId, byggeplassId, navn: nyNavn.trim(), type: nyType })
          }
        >
          {t("lokasjoner.soner.leggTil")}
        </Button>
      </div>

      {feil && <p className="mb-2 flex items-center gap-1 text-xs text-sitedoc-error">
        <MapPin className="h-3 w-3" />{feil}
      </p>}
    </div>
  );
}
