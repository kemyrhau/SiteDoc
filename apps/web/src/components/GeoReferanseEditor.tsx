"use client";

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input } from "@siteflow/ui";
import { MapPin, Trash2, Check } from "lucide-react";
import type { GeoReferanse } from "@siteflow/shared";

interface TegningInfo {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  geoReference?: unknown;
}

interface GeoReferanseEditorProps {
  tegningId: string;
  tegning: TegningInfo | null;
  onLagret: () => void;
}

interface Punkt {
  pixel: { x: number; y: number };
  gps: { lat: string; lng: string };
}

export function GeoReferanseEditor({
  tegningId,
  tegning,
  onLagret,
}: GeoReferanseEditorProps) {
  const utils = trpc.useUtils();
  const bildeRef = useRef<HTMLDivElement>(null);

  // Eksisterende georeferanse
  const eksisterende = tegning?.geoReference as GeoReferanse | null | undefined;

  // Kalibrering-state
  const [punkt1, setPunkt1] = useState<Punkt | null>(
    eksisterende?.point1
      ? {
          pixel: eksisterende.point1.pixel,
          gps: {
            lat: String(eksisterende.point1.gps.lat),
            lng: String(eksisterende.point1.gps.lng),
          },
        }
      : null,
  );
  const [punkt2, setPunkt2] = useState<Punkt | null>(
    eksisterende?.point2
      ? {
          pixel: eksisterende.point2.pixel,
          gps: {
            lat: String(eksisterende.point2.gps.lat),
            lng: String(eksisterende.point2.gps.lng),
          },
        }
      : null,
  );
  const [aktivtPunkt, setAktivtPunkt] = useState<1 | 2 | null>(null);

  const settGeoMutasjon = trpc.tegning.settGeoReferanse.useMutation({
    onSuccess: () => {
      utils.bygning.hentMedId.invalidate();
      utils.tegning.hentMedId.invalidate({ id: tegningId });
      onLagret();
    },
  });

  const fjernGeoMutasjon = trpc.tegning.fjernGeoReferanse.useMutation({
    onSuccess: () => {
      setPunkt1(null);
      setPunkt2(null);
      setAktivtPunkt(null);
      utils.bygning.hentMedId.invalidate();
      utils.tegning.hentMedId.invalidate({ id: tegningId });
      onLagret();
    },
  });

  const handleBildeKlikk = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!aktivtPunkt) return;
      const container = bildeRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const pixel = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };

      if (aktivtPunkt === 1) {
        setPunkt1((prev) => ({ pixel, gps: prev?.gps ?? { lat: "", lng: "" } }));
        setAktivtPunkt(null);
      } else {
        setPunkt2((prev) => ({ pixel, gps: prev?.gps ?? { lat: "", lng: "" } }));
        setAktivtPunkt(null);
      }
    },
    [aktivtPunkt],
  );

  const kanLagre =
    punkt1 &&
    punkt2 &&
    punkt1.gps.lat &&
    punkt1.gps.lng &&
    punkt2.gps.lat &&
    punkt2.gps.lng &&
    !isNaN(Number(punkt1.gps.lat)) &&
    !isNaN(Number(punkt1.gps.lng)) &&
    !isNaN(Number(punkt2.gps.lat)) &&
    !isNaN(Number(punkt2.gps.lng));

  function handleLagre() {
    if (!punkt1 || !punkt2) return;

    settGeoMutasjon.mutate({
      drawingId: tegningId,
      geoReference: {
        point1: {
          pixel: punkt1.pixel,
          gps: { lat: Number(punkt1.gps.lat), lng: Number(punkt1.gps.lng) },
        },
        point2: {
          pixel: punkt2.pixel,
          gps: { lat: Number(punkt2.gps.lat), lng: Number(punkt2.gps.lng) },
        },
      },
    });
  }

  if (!tegning) {
    return (
      <div className="text-center text-gray-400">
        Velg en tegning for å kalibrere georeferanse
      </div>
    );
  }

  const erBilde = ["png", "jpg", "jpeg"].includes(tegning.fileType ?? "");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-1 text-lg font-semibold text-gray-900">
          Georeferanse-kalibrering
        </h3>
        <p className="text-sm text-gray-500">
          Klikk to punkter på tegningen og oppgi GPS-koordinater for hvert punkt.
          Dette lar mobilappen beregne posisjon automatisk fra GPS.
        </p>
      </div>

      {/* Tegning med klikkbare punkter */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">{tegning.name}</p>
            {aktivtPunkt && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Klikk på tegningen for å plassere punkt {aktivtPunkt}
              </span>
            )}
          </div>
        </div>

        <div
          ref={bildeRef}
          onClick={handleBildeKlikk}
          className="relative"
          style={{ cursor: aktivtPunkt ? "crosshair" : "default" }}
        >
          {erBilde ? (
            <img
              src={`/api${tegning.fileUrl}`}
              alt={tegning.name}
              className="w-full"
              draggable={false}
            />
          ) : (
            <div className="relative">
              <iframe
                src={`/api${tegning.fileUrl}`}
                title={tegning.name}
                className="h-[500px] w-full border-0"
              />
              {/* Gjennomsiktig overlay for å fange klikk over PDF-iframe */}
              {aktivtPunkt && (
                <div
                  className="absolute inset-0"
                  style={{ cursor: "crosshair" }}
                />
              )}
            </div>
          )}

          {/* Punkt 1 markør */}
          {punkt1 && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
              style={{ left: `${punkt1.pixel.x}%`, top: `${punkt1.pixel.y}%` }}
            >
              <div className="flex flex-col items-center">
                <span className="mb-0.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  1
                </span>
                <div className="h-4 w-4 rounded-full border-2 border-white bg-red-500 shadow-md" />
              </div>
            </div>
          )}

          {/* Punkt 2 markør */}
          {punkt2 && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
              style={{ left: `${punkt2.pixel.x}%`, top: `${punkt2.pixel.y}%` }}
            >
              <div className="flex flex-col items-center">
                <span className="mb-0.5 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  2
                </span>
                <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-md" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Referansepunkt-skjema */}
      <div className="grid grid-cols-2 gap-6">
        {/* Punkt 1 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                1
              </div>
              <h4 className="text-sm font-semibold text-gray-900">
                Referansepunkt 1
              </h4>
            </div>
            <Button
              size="sm"
              variant={aktivtPunkt === 1 ? "primary" : "secondary"}
              onClick={() => setAktivtPunkt(aktivtPunkt === 1 ? null : 1)}
            >
              <MapPin className="mr-1 h-3 w-3" />
              {punkt1 ? "Flytt" : "Plasser"}
            </Button>
          </div>

          {punkt1 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-400">
                Piksel: {punkt1.pixel.x}%, {punkt1.pixel.y}%
              </p>
              <Input
                label="Breddegrad (lat)"
                value={punkt1.gps.lat}
                onChange={(e) =>
                  setPunkt1((p) =>
                    p ? { ...p, gps: { ...p.gps, lat: e.target.value } } : p,
                  )
                }
                placeholder="f.eks. 59.911"
              />
              <Input
                label="Lengdegrad (lng)"
                value={punkt1.gps.lng}
                onChange={(e) =>
                  setPunkt1((p) =>
                    p ? { ...p, gps: { ...p.gps, lng: e.target.value } } : p,
                  )
                }
                placeholder="f.eks. 10.750"
              />
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Klikk &quot;Plasser&quot; og trykk på tegningen
            </p>
          )}
        </div>

        {/* Punkt 2 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                2
              </div>
              <h4 className="text-sm font-semibold text-gray-900">
                Referansepunkt 2
              </h4>
            </div>
            <Button
              size="sm"
              variant={aktivtPunkt === 2 ? "primary" : "secondary"}
              onClick={() => setAktivtPunkt(aktivtPunkt === 2 ? null : 2)}
            >
              <MapPin className="mr-1 h-3 w-3" />
              {punkt2 ? "Flytt" : "Plasser"}
            </Button>
          </div>

          {punkt2 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-400">
                Piksel: {punkt2.pixel.x}%, {punkt2.pixel.y}%
              </p>
              <Input
                label="Breddegrad (lat)"
                value={punkt2.gps.lat}
                onChange={(e) =>
                  setPunkt2((p) =>
                    p ? { ...p, gps: { ...p.gps, lat: e.target.value } } : p,
                  )
                }
                placeholder="f.eks. 59.912"
              />
              <Input
                label="Lengdegrad (lng)"
                value={punkt2.gps.lng}
                onChange={(e) =>
                  setPunkt2((p) =>
                    p ? { ...p, gps: { ...p.gps, lng: e.target.value } } : p,
                  )
                }
                placeholder="f.eks. 10.760"
              />
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Klikk &quot;Plasser&quot; og trykk på tegningen
            </p>
          )}
        </div>
      </div>

      {/* Handlinger */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleLagre}
          disabled={!kanLagre || settGeoMutasjon.isPending}
        >
          <Check className="mr-1.5 h-4 w-4" />
          {settGeoMutasjon.isPending ? "Lagrer..." : "Lagre kalibrering"}
        </Button>

        {eksisterende && (
          <Button
            variant="danger"
            onClick={() => fjernGeoMutasjon.mutate({ drawingId: tegningId })}
            disabled={fjernGeoMutasjon.isPending}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {fjernGeoMutasjon.isPending ? "Fjerner..." : "Fjern kalibrering"}
          </Button>
        )}
      </div>
    </div>
  );
}
