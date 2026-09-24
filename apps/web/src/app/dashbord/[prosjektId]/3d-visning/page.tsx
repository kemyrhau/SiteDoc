"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import {
  Upload,
  Box,
  Waypoints,
  Loader2,
  Mountain,
  FileUp,
  BarChart3,
  Layers,
  Scissors,
  Trash2,
} from "lucide-react";
import { useTreDViewer } from "@/kontekst/tred-viewer-kontekst";
import { EgenskapsPopup } from "./komponenter/EgenskapsPopup";
import { FilterChipBar } from "./komponenter/FilterChipBar";
import { rammeEtikett } from "./hjelpefunksjoner";
import type {
  Fane,
  OverflateData,
  LagretOverflate,
  KuttFyllResultatType,
} from "./typer";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";

/**
 * Minimal form på tRPC-utils for overflate-kallene. Ny overflate-router dyttet
 * AppRouter-unionen over TS2589-grensen når man driller ned i den fulle
 * utils-proxyen — denne grunne casten bryter den (CLAUDE.md tRPC-fallgruve).
 */
type OverflateUtils = {
  overflate: {
    hentForProsjekt: { invalidate: () => Promise<void> };
    hentForSammenligning: {
      fetch: (input: { projectId: string; toppId: string; bunnId: string }) => Promise<{
        topp: { id: string; filUrl: string };
        bunn: { id: string; filUrl: string };
        ramme: string;
      }>;
    };
  };
};

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function TreDVisning() {
  useToppbarFiltre({ byggeplass: false });
  const { t } = useTranslation();
  const { prosjektId } = useParams<{ prosjektId: string }>();
  const [aktivFane, setAktivFane] = useState<Fane>("3d-modell");

  // Overflater bor nå på server (overlever reload) — hver fane henter dem selv.
  const faner: { id: Fane; label: string; ikon: JSX.Element }[] = [
    { id: "3d-modell", label: t("3d.modell"), ikon: <Box className="h-4 w-4" /> },
    { id: "overflater", label: t("3d.overflater"), ikon: <Mountain className="h-4 w-4" /> },
    { id: "kutt-fyll", label: t("3d.kuttFyll"), ikon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Fane-bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-4">
        {faner.map((fane) => (
          <button
            key={fane.id}
            onClick={() => setAktivFane(fane.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              aktivFane === fane.id
                ? "border-sitedoc-primary text-sitedoc-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {fane.ikon}
            {fane.label}
          </button>
        ))}
      </div>

      {/* Fane-innhold — 3D-modell holdes montert for å bevare Three.js-scene */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className={`flex flex-1 overflow-hidden ${aktivFane !== "3d-modell" ? "pointer-events-none invisible absolute inset-0" : ""}`}>
          <Fane3DModell />
        </div>
        {aktivFane === "overflater" && <FaneOverflater prosjektId={prosjektId!} />}
        {aktivFane === "kutt-fyll" && <FaneKuttFyll prosjektId={prosjektId!} />}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  FANE 1: 3D-modell — bruker kontekst for persistent viewer          */
/* ================================================================== */

function Fane3DModell() {
  const { t } = useTranslation();
  const {
    tegninger,
    punktskyer,
    modellStatuser,
    valgtObjekt,
    skjulteObjekter,
    aktiveFiltre,
    klippModus,
    lasterTegninger,
    lasterPunktskyer,
    viewerRef,
    setValgtObjekt,
    setKlippModus,
    toggleSynlighet,
    soloModell,
    skjulObjektOgLeggTil,
    leggTilFilter,
    fjernFilter,
    fjernSkjultObjekt,
    nullstillAlt,
    lastOppIfc,
    lasterOpp,
  } = useTreDViewer();

  if (lasterTegninger || lasterPunktskyer) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const harModeller = tegninger.length > 0;

  return (
    <div className="flex h-full flex-1">
      {/* Sidepanel — pointer-events-auto fordi layout setter pointer-events-none på children-wrapperen */}
      <div className="pointer-events-auto flex w-[280px] flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{t("3d.modeller")}</h2>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".ifc"
              onChange={lastOppIfc}
              className="hidden"
              disabled={lasterOpp}
            />
            <span className="flex items-center gap-1 rounded bg-sitedoc-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90">
              {lasterOpp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {t("handling.lastOpp")}
            </span>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!harModeller && (!punktskyer || punktskyer.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Layers className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">{t("3d.ingen3dData")}</p>
              <p className="text-xs text-gray-400">{t("3d.lastOppIfcKort")}</p>
            </div>
          )}

          {/* IFC-modeller med avkrysning */}
          {tegninger.map((teg) => {
            const status = modellStatuser.find((m) => m.id === teg.id);
            return (
              <label
                key={teg.id}
                className="flex w-full cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-2.5 transition-colors hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={status?.synlig ?? true}
                  onChange={() => toggleSynlighet(teg.id)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                />
                <Box className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{teg.name}</p>
                  <p className="text-xs text-gray-500">
                    {status?.laster ? (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Loader2 className="h-3 w-3 animate-spin" /> {t("handling.laster")}
                      </span>
                    ) : status?.feil ? (
                      <span className="text-red-500" title={status.feil}>{t("status.feilet")}</span>
                    ) : (
                      "IFC"
                    )}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); soloModell(teg.id); }}
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                  title={t("3d.soloTittel")}
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
              </label>
            );
          })}

          {/* Punktskyer */}
          {punktskyer && punktskyer.length > 0 && (
            <>
              <div className="border-t border-gray-200 px-4 py-2">
                <span className="text-xs font-semibold uppercase text-gray-500">Punktskyer</span>
              </div>
              {punktskyer.map((ps) => (
                <div
                  key={ps.id}
                  className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-2 text-left"
                >
                  <Waypoints className="h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-700">{ps.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {ps.pointCount ? `${(ps.pointCount / 1_000_000).toFixed(1)}M pkt` : ps.fileType}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Hovedinnhold: vieweren rendres i layout bak dette laget */}
      <div className="relative flex flex-1 flex-col">
        {/* Verktøylinje for 3D (snitt etc.) */}
        <div className="pointer-events-auto flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
          <Layers className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">
            {t("3d.modellAntall", { antall: tegninger.length })}
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-1 border-r border-gray-200 pr-3">
            <button
              onClick={() => {
                const nyModus = !klippModus;
                setKlippModus(nyModus);
                if (nyModus) viewerRef.current?.settKlipperSynlig(true);
              }}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                klippModus ? "bg-sitedoc-primary text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
              title={t("3d.snitt")}
            >
              <Scissors className="h-3.5 w-3.5" />
              {t("3d.snitt")}
            </button>
            {klippModus && (
              <button
                onClick={() => {
                  viewerRef.current?.fjernAlleKlippeplan();
                  setKlippModus(false);
                }}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
              >
                {t("3d.fjernAlle")}
              </button>
            )}
          </div>
        </div>

        {/* Filter-chip-bar */}
        {(aktiveFiltre.length > 0 || skjulteObjekter.length > 0) && (
          <div className="pointer-events-auto">
            <FilterChipBar
              aktiveFiltre={aktiveFiltre}
              skjulteObjekter={skjulteObjekter}
              onFjernFilter={fjernFilter}
              onFjernSkjultObjekt={fjernSkjultObjekt}
              onNullstillAlt={nullstillAlt}
            />
          </div>
        )}

        {!harModeller && (
          <div className="pointer-events-auto flex flex-1 items-center justify-center bg-gray-100">
            <div className="text-center text-gray-400">
              <Box className="mx-auto mb-2 h-12 w-12 text-gray-300" />
              <p className="text-sm">{t("3d.lastOppIfcBeskrivelse")}</p>
            </div>
          </div>
        )}

        {/* Flytende egenskapspanel */}
        {valgtObjekt && (
          <div className="pointer-events-auto">
            <EgenskapsPopup
              objekt={valgtObjekt}
              onLukk={() => setValgtObjekt(null)}
              onSkjul={() => skjulObjektOgLeggTil(valgtObjekt)}
              onFilterKategori={async (kategori: string) => {
                await leggTilFilter({ type: "kategori", verdi: kategori });
              }}
              onFilterLag={async (lag: string) => {
                await leggTilFilter({ type: "lag", verdi: lag });
              }}
              onFilterSystem={async (system: string) => {
                await leggTilFilter({ type: "system", verdi: system });
              }}
            />
          </div>
        )}

        {/* Transparent flex-spacer — lar klikk treffe vieweren under */}
        <div className="flex-1" />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  FANE 2: Overflatemodeller                                          */
/* ================================================================== */

function FaneOverflater({ prosjektId }: { prosjektId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils() as unknown as OverflateUtils;
  const [valgtOverflateId, setValgtOverflateId] = useState<string | null>(null);
  const [lasterInn, setLasterInn] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [valgtPunktskyId, setValgtPunktskyId] = useState<string>("");

  const overflateQuery = trpc.overflate.hentForProsjekt.useQuery({ projectId: prosjektId });
  const overflater = (overflateQuery.data ?? []) as LagretOverflate[];
  // Konkret cast bryter tRPC-ens dype union (TS2589) før .filter — CLAUDE.md-fallgruve.
  const punktskyQuery = trpc.punktsky.hentForProsjekt.useQuery({ projectId: prosjektId });
  const punktskyer = (punktskyQuery.data ?? []) as Array<{ id: string; name: string; fileType: string }>;
  const lasPunktskyer = punktskyer.filter((p) => p.fileType?.toLowerCase() === "las");

  // _data: unknown i mutation-callbacks unngår TS2589 (CLAUDE.md tRPC-fallgruve).
  const lagreLandXML = trpc.overflate.lagreLandXML.useMutation({
    onSuccess: (o: unknown) => {
      utils.overflate.hentForProsjekt.invalidate();
      setValgtOverflateId((o as { id: string }).id);
    },
    onError: (e: unknown) => setFeil(e instanceof Error ? e.message : t("3d.beregningFeilet")),
  });
  const opprettFraPunktsky = trpc.overflate.opprettFraPunktsky.useMutation({
    onSuccess: (o: unknown) => {
      utils.overflate.hentForProsjekt.invalidate();
      setValgtOverflateId((o as { id: string }).id);
    },
    onError: (e: unknown) => setFeil(e instanceof Error ? e.message : t("3d.beregningFeilet")),
  });
  const slettMutation = trpc.overflate.slett.useMutation({
    onSuccess: () => utils.overflate.hentForProsjekt.invalidate(),
  });

  async function handleLandXMLValgt(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0];
    if (!fil) return;
    setLasterInn(true);
    setFeil(null);
    try {
      const formData = new FormData();
      formData.append("file", fil);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).error ?? t("3d.beregningFeilet"));
      const data = await res.json();
      await lagreLandXML.mutateAsync({
        projectId: prosjektId,
        navn: fil.name.replace(/\.[^.]+$/, ""),
        fileUrl: data.fileUrl,
      });
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Kunne ikke lagre LandXML");
    } finally {
      setLasterInn(false);
      e.target.value = "";
    }
  }

  function overflateberegn() {
    if (!valgtPunktskyId) return;
    setFeil(null);
    const sky = lasPunktskyer.find((p) => p.id === valgtPunktskyId);
    opprettFraPunktsky.mutate({
      projectId: prosjektId,
      pointCloudId: valgtPunktskyId,
      navn: sky?.name ?? t("3d.overflater"),
    });
  }

  function fjernOverflate(id: string) {
    slettMutation.mutate({ id });
    if (valgtOverflateId === id) setValgtOverflateId(null);
  }

  const valgt = overflater.find((o) => o.id === valgtOverflateId) ?? null;
  const beregner = opprettFraPunktsky.isPending;

  return (
    <div className="flex h-full flex-1">
      {/* Sidepanel */}
      <div className="flex w-[280px] flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{t("3d.overflater")}</h2>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xml,.landxml"
              onChange={handleLandXMLValgt}
              className="hidden"
              disabled={lasterInn}
            />
            <span className="flex items-center gap-1 rounded bg-sitedoc-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90">
              {lasterInn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              LandXML
            </span>
          </label>
        </div>

        {/* Punktsky → overflate */}
        <div className="border-b border-gray-200 px-4 py-3">
          <label className="text-xs font-medium text-gray-500">{t("3d.overflateberegnPunktsky")}</label>
          <select
            value={valgtPunktskyId}
            onChange={(e) => setValgtPunktskyId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
            disabled={lasPunktskyer.length === 0}
          >
            <option value="">
              {lasPunktskyer.length === 0 ? t("3d.ingenLasPunktsky") : t("3d.velgLasPunktsky")}
            </option>
            {lasPunktskyer.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={overflateberegn}
            disabled={!valgtPunktskyId || beregner}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-sitedoc-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
          >
            {beregner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mountain className="h-3.5 w-3.5" />}
            {beregner ? t("3d.lagrerOverflate") : t("3d.overflateberegnPunktsky")}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {overflater.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Mountain className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">{t("3d.ingenLagredeOverflater")}</p>
            </div>
          )}

          {overflater.map((o) => (
            <button
              key={o.id}
              onClick={() => setValgtOverflateId(o.id)}
              className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                valgtOverflateId === o.id ? "bg-blue-50" : ""
              }`}
            >
              <Mountain className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{o.navn}</p>
                <p className="text-xs text-gray-500">
                  {o.kilde === "landxml" ? t("3d.rammeLandxml") : t("3d.punktsky")}
                  {o.punktAntall != null ? ` — ${o.punktAntall.toLocaleString()} pkt` : ""}
                </p>
                <p className="text-[10px] text-gray-400">
                  {t("3d.koordinatramme")}: {rammeEtikett(o.ramme, t)}
                </p>
              </div>
              <span
                onClick={(e) => { e.stopPropagation(); fjernOverflate(o.id); }}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>

        {feil && (
          <div className="border-t border-gray-200 px-4 py-3">
            <p className="text-xs text-red-500">{feil}</p>
          </div>
        )}
      </div>

      {/* 3D-visning */}
      <div className="flex flex-1 flex-col bg-gray-100">
        {!valgt ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-gray-400">
              <Mountain className="mx-auto mb-2 h-12 w-12 text-gray-300" />
              <p className="text-sm">{t("handling.lastOpp")} en LandXML-fil eller overflateberegn en punktsky</p>
            </div>
          </div>
        ) : (
          <LagretOverflateViewer overflate={valgt} />
        )}
      </div>
    </div>
  );
}

/**
 * Laster TIN-binæren for en lagret overflate (lazy) og viser den i OverflateViewer.
 * Metadata-lista bærer ikke geometrien — den hentes fra filUrl først ved visning.
 */
function LagretOverflateViewer({ overflate }: { overflate: LagretOverflate }) {
  const { t } = useTranslation();
  const [data, setData] = useState<OverflateData | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  useEffect(() => {
    let avbrutt = false;
    setData(null);
    setFeil(null);
    import("@/lib/tin-fil")
      .then(({ hentTin }) => hentTin(overflate.filUrl))
      .then((tin) => {
        if (avbrutt) return;
        setData({
          id: overflate.id,
          navn: overflate.navn,
          kilde: overflate.kilde === "landxml" ? "landxml" : "punktsky",
          vertices: tin.vertices,
          triangles: tin.triangles,
          bbox: tin.bbox,
          ramme: overflate.ramme,
        });
      })
      .catch((e) => { if (!avbrutt) setFeil(e instanceof Error ? e.message : "Feil"); });
    return () => { avbrutt = true; };
  }, [overflate.id, overflate.filUrl, overflate.navn, overflate.kilde, overflate.ramme]);

  if (feil) {
    return <div className="flex flex-1 items-center justify-center text-sm text-red-500">{feil}</div>;
  }
  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sitedoc-primary" />
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-gray-200 bg-white px-4 py-1.5 text-[11px] text-gray-500">
        {t("3d.koordinatramme")}: <span className="font-medium text-gray-700">{rammeEtikett(overflate.ramme, t)}</span>
      </div>
      <OverflateViewer overflate={data} />
    </div>
  );
}

/* ================================================================== */
/*  FANE 3: Kutt/fyll-analyse                                          */
/* ================================================================== */

function FaneKuttFyll({ prosjektId }: { prosjektId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils() as unknown as OverflateUtils;
  const [toppId, setToppId] = useState<string | null>(null);
  const [bunnId, setBunnId] = useState<string | null>(null);
  const [celleStr, setCelleStr] = useState(1.0);
  const [resultat, setResultat] = useState<KuttFyllResultatType | null>(null);
  const [brukRamme, setBrukRamme] = useState<string | null>(null);
  const [beregner, setBeregner] = useState(false);
  const [lasterInn, setLasterInn] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const overflateQuery = trpc.overflate.hentForProsjekt.useQuery({ projectId: prosjektId });
  const overflater = (overflateQuery.data ?? []) as LagretOverflate[];

  const lagreLandXML = trpc.overflate.lagreLandXML.useMutation({
    onSuccess: () => utils.overflate.hentForProsjekt.invalidate(),
    onError: (e: unknown) => setFeil(e instanceof Error ? e.message : t("3d.beregningFeilet")),
  });

  useEffect(() => {
    if (overflater.length >= 1 && !bunnId) setBunnId(overflater[0]!.id);
    if (overflater.length >= 2 && !toppId) setToppId(overflater[1]!.id);
  }, [overflater, bunnId, toppId]);

  const toppOverflate = overflater.find((o) => o.id === toppId) ?? null;
  const bunnOverflate = overflater.find((o) => o.id === bunnId) ?? null;
  // § F (UI-del): ulik ramme → knapp av + forklaring. Server håndhever i tillegg.
  const rammerUlik = !!toppOverflate && !!bunnOverflate && toppOverflate.ramme !== bunnOverflate.ramme;

  async function handleLandXMLValgt(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0];
    if (!fil) return;
    setLasterInn(true);
    setFeil(null);
    try {
      const formData = new FormData();
      formData.append("file", fil);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).error ?? t("3d.beregningFeilet"));
      const data = await res.json();
      await lagreLandXML.mutateAsync({
        projectId: prosjektId,
        navn: fil.name.replace(/\.[^.]+$/, ""),
        fileUrl: data.fileUrl,
      });
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Kunne ikke lagre LandXML");
    } finally {
      setLasterInn(false);
      e.target.value = "";
    }
  }

  async function beregnAnalyse() {
    if (!toppId || !bunnId) return;
    setBeregner(true);
    setFeil(null);
    try {
      // 🔴 § F: server-ramme-vakt FØR beregning. Ulik ramme → kaster her, og
      // beregnKuttFyll kjøres aldri. (Prosjektisolering håndheves samme sted.)
      const par = await utils.overflate.hentForSammenligning.fetch({
        projectId: prosjektId, toppId, bunnId,
      });
      const { hentTin } = await import("@/lib/tin-fil");
      const [toppTin, bunnTin] = await Promise.all([
        hentTin(par.topp.filUrl),
        hentTin(par.bunn.filUrl),
      ]);
      const { beregnKuttFyll } = await import("@/lib/kutt-fyll");
      const res = beregnKuttFyll(toppTin, bunnTin, celleStr);
      setResultat(res);
      setBrukRamme(par.ramme);
    } catch (err) {
      setFeil(err instanceof Error ? err.message : t("3d.beregningFeilet"));
    } finally {
      setBeregner(false);
    }
  }

  return (
    <div className="flex h-full flex-1">
      {/* Sidepanel */}
      <div className="flex w-[280px] flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{t("3d.kuttFyll")}</h2>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xml,.landxml"
              onChange={handleLandXMLValgt}
              className="hidden"
              disabled={lasterInn}
            />
            <span className="flex items-center gap-1 rounded bg-sitedoc-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90">
              {lasterInn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              LandXML
            </span>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Toppflate (nyeste)</label>
              <select
                value={toppId ?? ""}
                onChange={(e) => setToppId(e.target.value || null)}
                className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
              >
                <option value="">Velg overflate...</option>
                {overflater.map((o) => (
                  <option key={o.id} value={o.id}>{o.navn}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500">Bunnflate (eldste)</label>
              <select
                value={bunnId ?? ""}
                onChange={(e) => setBunnId(e.target.value || null)}
                className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
              >
                <option value="">Velg overflate...</option>
                {overflater.map((o) => (
                  <option key={o.id} value={o.id}>{o.navn}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500">Rutenett-oppløsning</label>
              <select
                value={celleStr}
                onChange={(e) => setCelleStr(parseFloat(e.target.value))}
                className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
              >
                <option value="0.5">0.5m (fin)</option>
                <option value="1">1m (standard)</option>
                <option value="2">2m (grov)</option>
                <option value="5">5m (rask)</option>
              </select>
            </div>

            {/* § F (UI): koordinatramme pr. valgt overflate + blokk ved ulik ramme */}
            {(toppOverflate || bunnOverflate) && (
              <div className="rounded bg-gray-50 px-2 py-1.5 text-[10px] text-gray-500">
                {toppOverflate && (
                  <div>{t("3d.koordinatramme")}: {rammeEtikett(toppOverflate.ramme, t)}</div>
                )}
                {bunnOverflate && bunnOverflate.ramme !== toppOverflate?.ramme && (
                  <div>{t("3d.koordinatramme")}: {rammeEtikett(bunnOverflate.ramme, t)}</div>
                )}
              </div>
            )}
            {rammerUlik && (
              <p className="text-xs text-amber-600">{t("3d.rammeUlik")}</p>
            )}

            <button
              onClick={beregnAnalyse}
              disabled={!toppId || !bunnId || toppId === bunnId || rammerUlik || beregner}
              className="flex w-full items-center justify-center gap-2 rounded bg-sitedoc-primary px-3 py-2 text-xs font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
            >
              {beregner ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BarChart3 className="h-3.5 w-3.5" />
              )}
              Beregn kutt/fyll
            </button>
          </div>

          {resultat && (
            <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
              <h3 className="text-xs font-semibold uppercase text-gray-500">Resultat</h3>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
                    Kutt (fjernet)
                  </span>
                  <span className="text-xs font-semibold text-gray-900">
                    {resultat.kuttVolum.toFixed(1)} m³
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
                    Fyll (tilført)
                  </span>
                  <span className="text-xs font-semibold text-gray-900">
                    {resultat.fyllVolum.toFixed(1)} m³
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
                  <span className="text-xs font-medium text-gray-600">Netto</span>
                  <span className={`text-xs font-semibold ${resultat.netto > 0 ? "text-red-600" : resultat.netto < 0 ? "text-blue-600" : "text-gray-600"}`}>
                    {resultat.netto > 0 ? "+" : ""}{resultat.netto.toFixed(1)} m³
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-[10px] text-gray-400">
                {brukRamme && (
                  <p>{t("3d.koordinatramme")}: {rammeEtikett(brukRamme, t)}</p>
                )}
                <p>Oppløsning: {resultat.celleStr}m × {resultat.celleStr}m</p>
                <p>Rutenett: {resultat.gridBredde} × {resultat.gridHoyde} celler</p>
                <p>ΔZ: {resultat.minDiff.toFixed(2)}m til {resultat.maxDiff.toFixed(2)}m</p>
              </div>
            </div>
          )}

          {feil && (
            <div className="mt-3 rounded bg-red-50 px-3 py-2">
              <p className="text-xs text-red-600">{feil}</p>
            </div>
          )}

          {resultat && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <h3 className="text-xs font-semibold uppercase text-gray-500">Fargeskala</h3>
              <div className="mt-2 flex h-3 w-full rounded overflow-hidden">
                <div className="flex-1 bg-gradient-to-r from-blue-600 to-blue-200" />
                <div className="w-px bg-gray-300" />
                <div className="flex-1 bg-gradient-to-r from-red-200 to-red-600" />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                <span>Kutt</span>
                <span>0</span>
                <span>Fyll</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3D-visning */}
      <div className="flex flex-1 flex-col bg-gray-100">
        {!resultat ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-gray-400">
              <BarChart3 className="mx-auto mb-2 h-12 w-12 text-gray-300" />
              <p className="text-sm">{t("handling.lastOpp")} to overflater og kjør analyse</p>
              <p className="mt-1 text-xs text-gray-400">
                Blå = kutt (terreng fjernet), Rød = fyll (masse tilført)
              </p>
            </div>
          </div>
        ) : (
          <KuttFyllViewer resultat={resultat} />
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Overflate-viewer (Three.js)                                        */
/* ================================================================== */

function OverflateViewer({ overflate }: { overflate: OverflateData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [laster, setLaster] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renset = false;

    import("three").then((THREE) => {
      if (renset) return;

      const bredde = container.clientWidth;
      const hoyde = container.clientHeight;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f0f0);

      const kamera = new THREE.PerspectiveCamera(60, bredde / hoyde, 0.1, 100000);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(bredde, hoyde);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);

      const geometry = new THREE.BufferGeometry();
      const { vertices, triangles, bbox } = overflate;

      const cx = (bbox.minX + bbox.maxX) / 2;
      const cy = (bbox.minY + bbox.maxY) / 2;
      const cz = (bbox.minZ + bbox.maxZ) / 2;

      const positions = new Float32Array(vertices.length);
      for (let i = 0; i < vertices.length / 3; i++) {
        positions[i * 3] = (vertices[i * 3] ?? 0) - cx;
        positions[i * 3 + 1] = (vertices[i * 3 + 2] ?? 0) - cz;
        positions[i * 3 + 2] = (vertices[i * 3 + 1] ?? 0) - cy;
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(triangles), 1));
      geometry.computeVertexNormals();

      const colors = new Float32Array(positions.length);
      const zMin = bbox.minZ;
      const zRange = Math.max(bbox.maxZ - bbox.minZ, 0.01);
      for (let i = 0; i < positions.length / 3; i++) {
        const t = ((vertices[i * 3 + 2] ?? 0) - zMin) / zRange;
        colors[i * 3] = 0.2 + 0.5 * t;
        colors[i * 3 + 1] = 0.6 - 0.3 * t;
        colors[i * 3 + 2] = 0.1;
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const wireframe = new THREE.WireframeGeometry(geometry);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.05, transparent: true });
      scene.add(new THREE.LineSegments(wireframe, lineMat));

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(1, 2, 1);
      scene.add(dirLight);

      const størrelse = new THREE.Vector3(
        bbox.maxX - bbox.minX,
        bbox.maxZ - bbox.minZ,
        bbox.maxY - bbox.minY,
      );
      const maxDim = størrelse.length();
      kamera.position.set(maxDim * 0.5, maxDim * 0.5, maxDim * 0.5);
      kamera.lookAt(0, 0, 0);

      setLaster(false);

      let isDragging = false;
      let prevX = 0;
      let prevY = 0;
      let rotX = Math.PI / 6;
      let rotY = Math.PI / 4;
      let avstand = maxDim * 0.8;
      const lookAt = new THREE.Vector3(0, 0, 0);

      function oppdaterKamera() {
        kamera.position.x = lookAt.x + avstand * Math.sin(rotY) * Math.cos(rotX);
        kamera.position.y = lookAt.y + avstand * Math.sin(rotX);
        kamera.position.z = lookAt.z + avstand * Math.cos(rotY) * Math.cos(rotX);
        kamera.lookAt(lookAt);
      }
      oppdaterKamera();

      renderer.domElement.addEventListener("mousedown", (e) => {
        isDragging = true;
        prevX = e.clientX;
        prevY = e.clientY;
      });

      renderer.domElement.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        rotY += (e.clientX - prevX) * 0.005;
        rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX + (e.clientY - prevY) * 0.005));
        prevX = e.clientX;
        prevY = e.clientY;
        oppdaterKamera();
      });

      window.addEventListener("mouseup", () => { isDragging = false; });

      renderer.domElement.addEventListener("wheel", (e) => {
        e.preventDefault();
        avstand *= e.deltaY > 0 ? 1.1 : 0.9;
        avstand = Math.max(1, Math.min(100000, avstand));
        oppdaterKamera();
      });

      let animId: number;
      function animate() {
        animId = requestAnimationFrame(animate);
        renderer.render(scene, kamera);
      }
      animate();

      const resizeObserver = new ResizeObserver(() => {
        const b = container.clientWidth;
        const h = container.clientHeight;
        kamera.aspect = b / h;
        kamera.updateProjectionMatrix();
        renderer.setSize(b, h);
      });
      resizeObserver.observe(container);

      const cleanup = () => {
        renset = true;
        cancelAnimationFrame(animId);
        resizeObserver.disconnect();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };

      (container as unknown as { _cleanup: () => void })._cleanup = cleanup;
    });

    return () => {
      renset = true;
      const cleanup = (container as unknown as { _cleanup?: () => void })._cleanup;
      if (cleanup) cleanup();
    };
  }, [overflate]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <Mountain className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-900">{overflate.navn}</span>
        <span className="text-xs text-gray-500">
          {(overflate.triangles.length / 3).toLocaleString()} trekanter
        </span>
      </div>
      <div ref={containerRef} className="relative flex-1">
        {laster && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100">
            <Loader2 className="h-8 w-8 animate-spin text-sitedoc-primary" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Kutt/fyll-viewer (Three.js)                                        */
/* ================================================================== */

function KuttFyllViewer({ resultat }: { resultat: KuttFyllResultatType }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [laster, setLaster] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renset = false;

    Promise.all([
      import("three"),
      import("@/lib/kutt-fyll"),
    ]).then(([THREE, { genererDiffMesh }]) => {
      if (renset) return;

      const bredde = container.clientWidth;
      const hoyde = container.clientHeight;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f0f0);

      const kamera = new THREE.PerspectiveCamera(60, bredde / hoyde, 0.1, 100000);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(bredde, hoyde);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);

      const { positions, colors, indices } = genererDiffMesh(resultat);

      const cx = resultat.origoX + (resultat.gridBredde * resultat.celleStr) / 2;
      const cy = resultat.origoY + (resultat.gridHoyde * resultat.celleStr) / 2;

      const centeredPositions = new Float32Array(positions.length);
      for (let i = 0; i < positions.length / 3; i++) {
        centeredPositions[i * 3] = (positions[i * 3] ?? 0) - cx;
        centeredPositions[i * 3 + 1] = positions[i * 3 + 2] ?? 0;
        centeredPositions[i * 3 + 2] = (positions[i * 3 + 1] ?? 0) - cy;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(centeredPositions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();

      const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(1, 2, 1);
      scene.add(dirLight);

      const gridSize = Math.max(
        resultat.gridBredde * resultat.celleStr,
        resultat.gridHoyde * resultat.celleStr,
      );
      const gridHelper = new THREE.GridHelper(gridSize, 20, 0xcccccc, 0xe0e0e0);
      gridHelper.position.y = -0.1;
      scene.add(gridHelper);

      const avstandInit = gridSize * 0.8;
      let avstand = avstandInit;
      let rotX = Math.PI / 5;
      let rotY = Math.PI / 4;
      const lookAt = new THREE.Vector3(0, 0, 0);

      function oppdaterKamera() {
        kamera.position.x = lookAt.x + avstand * Math.sin(rotY) * Math.cos(rotX);
        kamera.position.y = lookAt.y + avstand * Math.sin(rotX);
        kamera.position.z = lookAt.z + avstand * Math.cos(rotY) * Math.cos(rotX);
        kamera.lookAt(lookAt);
      }
      oppdaterKamera();

      setLaster(false);

      let isDragging = false;
      let prevX = 0;
      let prevY = 0;

      renderer.domElement.addEventListener("mousedown", (e) => {
        isDragging = true;
        prevX = e.clientX;
        prevY = e.clientY;
      });

      renderer.domElement.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        rotY += (e.clientX - prevX) * 0.005;
        rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX + (e.clientY - prevY) * 0.005));
        prevX = e.clientX;
        prevY = e.clientY;
        oppdaterKamera();
      });

      window.addEventListener("mouseup", () => { isDragging = false; });

      renderer.domElement.addEventListener("wheel", (e) => {
        e.preventDefault();
        avstand *= e.deltaY > 0 ? 1.1 : 0.9;
        avstand = Math.max(1, Math.min(100000, avstand));
        oppdaterKamera();
      });

      let animId: number;
      function animate() {
        animId = requestAnimationFrame(animate);
        renderer.render(scene, kamera);
      }
      animate();

      const resizeObserver = new ResizeObserver(() => {
        const b = container.clientWidth;
        const h = container.clientHeight;
        kamera.aspect = b / h;
        kamera.updateProjectionMatrix();
        renderer.setSize(b, h);
      });
      resizeObserver.observe(container);

      (container as unknown as { _cleanup: () => void })._cleanup = () => {
        renset = true;
        cancelAnimationFrame(animId);
        resizeObserver.disconnect();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
    });

    return () => {
      renset = true;
      const cleanup = (container as unknown as { _cleanup?: () => void })._cleanup;
      if (cleanup) cleanup();
    };
  }, [resultat]);

  return (
    <div ref={containerRef} className="relative flex-1">
      {laster && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100">
          <Loader2 className="h-8 w-8 animate-spin text-sitedoc-primary" />
        </div>
      )}
    </div>
  );
}
