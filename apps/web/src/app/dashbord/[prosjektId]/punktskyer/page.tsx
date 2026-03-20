"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Spinner } from "@sitedoc/ui";
import {
  Upload,
  Waypoints,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  Palette,
  ChevronDown,
  Trash2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Klassifiseringskoder og farger (ASPRS)                              */
/* ------------------------------------------------------------------ */

const KLASSE_FARGER: Record<number, string> = {
  0: "#999999", // Aldri klassifisert
  1: "#cccccc", // Uklassifisert
  2: "#8B4513", // Bakke
  3: "#90EE90", // Lav vegetasjon
  4: "#32CD32", // Middels vegetasjon
  5: "#006400", // Høy vegetasjon
  6: "#FF0000", // Bygning
  7: "#FF69B4", // Støy
  8: "#FFD700", // Nøkkelpunkt
  9: "#0000FF", // Vann
  10: "#808080", // Jernbane
  11: "#A9A9A9", // Vei
  12: "#DDA0DD", // Overlapp
  13: "#FFA500", // Ledning (vern)
  14: "#FF8C00", // Ledning (leder)
  15: "#8B0000", // Mast
  16: "#FF4500", // Ledningskobling
  17: "#696969", // Bro
  18: "#FF1493", // Høy støy
};

const KLASSE_NAVN: Record<number, string> = {
  0: "Aldri klassifisert",
  1: "Uklassifisert",
  2: "Bakke",
  3: "Lav vegetasjon",
  4: "Middels vegetasjon",
  5: "Høy vegetasjon",
  6: "Bygning",
  7: "Støy (lav)",
  8: "Nøkkelpunkt",
  9: "Vann",
  10: "Jernbane",
  11: "Veioverflate",
  12: "Overlapp",
  13: "Ledning (vern)",
  14: "Ledning (leder)",
  15: "Sendemast",
  16: "Ledningskobling",
  17: "Bro",
  18: "Støy (høy)",
};

type Fargemodus = "klassifisering" | "rgb" | "intensitet" | "hoyde";

interface PunktSkyRad {
  id: string;
  name: string;
  fileType: string;
  pointCount: number | null;
  conversionStatus: string;
  conversionError: string | null;
  potreeUrl: string | null;
  hasClassification: boolean;
  hasRgb: boolean;
  classifications: unknown;
  boundingBox: unknown;
  building: { id: string; name: string } | null;
}

interface KlassifiseringRad {
  kode: number;
  navn: string;
  antall: number;
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function PunktSkyerSide() {
  const { prosjektId } = useParams<{ prosjektId: string }>();
  const utils = trpc.useUtils();

  const { data: _punktskyer, isLoading } = trpc.punktsky.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const punktskyer = _punktskyer as PunktSkyRad[] | undefined;

  const [valgtId, setValgtId] = useState<string | null>(null);
  const [lasterOpp, setLasterOpp] = useState(false);

  const opprettMutation = trpc.punktsky.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      utils.punktsky.hentForProsjekt.invalidate({ projectId: prosjektId! });
      const ny = _data as { id: string };
      setValgtId(ny.id);
    },
  });

  const slettMutation = trpc.punktsky.slett.useMutation({
    onSuccess: () => {
      utils.punktsky.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setValgtId(null);
    },
  });

  async function handleFilValgt(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0];
    if (!fil || !prosjektId) return;

    setLasterOpp(true);
    try {
      const formData = new FormData();
      formData.append("file", fil);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Opplasting feilet");
        return;
      }
      const data = await res.json();
      opprettMutation.mutate({
        projectId: prosjektId,
        name: fil.name.replace(/\.[^.]+$/, ""),
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize,
      });
    } catch {
      alert("Kunne ikke laste opp filen");
    } finally {
      setLasterOpp(false);
      e.target.value = "";
    }
  }

  const valgt = punktskyer?.find((ps) => ps.id === valgtId) ?? null;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1">
      {/* Sidepanel: liste + opplasting */}
      <div className="flex w-[280px] flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Punktskyer</h2>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".las,.laz,.e57,.ply"
              onChange={handleFilValgt}
              className="hidden"
              disabled={lasterOpp}
            />
            <span className="flex items-center gap-1 rounded bg-sitedoc-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90">
              {lasterOpp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Last opp
            </span>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto">
          {(!punktskyer || punktskyer.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Waypoints className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">Ingen punktskyer</p>
              <p className="text-xs text-gray-400">Last opp LAS, LAZ, E57 eller PLY</p>
            </div>
          )}

          {punktskyer?.map((ps) => (
            <button
              key={ps.id}
              onClick={() => setValgtId(ps.id)}
              className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                valgtId === ps.id ? "bg-blue-50" : ""
              }`}
            >
              <Waypoints className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{ps.name}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="uppercase">{ps.fileType}</span>
                  {ps.pointCount && (
                    <span>{(ps.pointCount / 1_000_000).toFixed(1)}M pkt</span>
                  )}
                  {ps.conversionStatus === "pending" && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Loader2 className="h-3 w-3 animate-spin" /> Konverterer
                    </span>
                  )}
                  {ps.conversionStatus === "failed" && (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-3 w-3" /> Feilet
                    </span>
                  )}
                  {ps.hasClassification && (
                    <span className="rounded bg-green-100 px-1 text-green-700">Klassifisert</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Hovedinnhold: viewer */}
      <div className="flex flex-1 flex-col bg-gray-100">
        {!valgt ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-gray-400">
              <Waypoints className="mx-auto mb-2 h-12 w-12 text-gray-300" />
              <p className="text-sm">Velg en punktsky fra listen</p>
            </div>
          </div>
        ) : valgt.conversionStatus === "pending" || valgt.conversionStatus === "converting" ? (
          <KonverteringsStatus id={valgt.id} />
        ) : valgt.conversionStatus === "failed" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <AlertTriangle className="h-10 w-10 text-red-400" />
            <p className="text-sm font-medium text-red-600">Konvertering feilet</p>
            <p className="text-xs text-gray-500">{valgt.conversionError}</p>
          </div>
        ) : valgt.potreeUrl ? (
          <PunktSkyViewer punktsky={valgt} onSlett={() => slettMutation.mutate({ id: valgt.id })} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
            Venter på konvertering...
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Konverteringsstatus med polling                                     */
/* ------------------------------------------------------------------ */

function KonverteringsStatus({ id }: { id: string }) {
  const { data } = trpc.punktsky.hentKonverteringsStatus.useQuery(
    { id },
    { refetchInterval: 3000 },
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <Loader2 className="h-10 w-10 animate-spin text-sitedoc-primary" />
      <p className="text-sm font-medium text-gray-700">Konverterer punktsky...</p>
      <p className="text-xs text-gray-500">
        {data?.conversionStatus === "converting"
          ? "PotreeConverter kjører. Dette kan ta noen minutter for store filer."
          : "Venter på oppstart..."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Punktsky-viewer (Potree)                                           */
/* ------------------------------------------------------------------ */

interface PunktSkyViewerProps {
  punktsky: {
    id: string;
    name: string;
    potreeUrl: string | null;
    hasClassification: boolean;
    hasRgb: boolean;
    classifications: unknown;
    pointCount: number | null;
    boundingBox: unknown;
  };
  onSlett: () => void;
}

function PunktSkyViewer({ punktsky, onSlett }: PunktSkyViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fargemodus, setFargemodus] = useState<Fargemodus>(
    punktsky.hasClassification ? "klassifisering" : punktsky.hasRgb ? "rgb" : "hoyde",
  );
  const [synligeKlasser, setSynligeKlasser] = useState<Set<number>>(() => {
    const klasser = (punktsky.classifications as KlassifiseringRad[] | null) ?? [];
    return new Set(klasser.map((k) => k.kode));
  });
  const [visKlasseListe, setVisKlasseListe] = useState(true);

  const klasser = (punktsky.classifications as KlassifiseringRad[] | null) ?? [];

  function toggleKlasse(kode: number) {
    setSynligeKlasser((prev) => {
      const ny = new Set(prev);
      if (ny.has(kode)) ny.delete(kode);
      else ny.add(kode);
      return ny;
    });
  }

  function velgAlleKlasser() {
    setSynligeKlasser(new Set(klasser.map((k) => k.kode)));
  }

  function fjernAlleKlasser() {
    setSynligeKlasser(new Set());
  }

  // Fargemodus-alternativer basert på tilgjengelige data
  const tilgjengeligeModuser: { id: Fargemodus; label: string }[] = [];
  if (punktsky.hasClassification) tilgjengeligeModuser.push({ id: "klassifisering", label: "Klassifisering" });
  if (punktsky.hasRgb) tilgjengeligeModuser.push({ id: "rgb", label: "RGB-farger" });
  tilgjengeligeModuser.push({ id: "intensitet", label: "Intensitet" });
  tilgjengeligeModuser.push({ id: "hoyde", label: "Høyde (Z)" });

  return (
    <div className="flex h-full flex-col">
      {/* Verktøylinje */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <Waypoints className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-900">{punktsky.name}</span>
        {punktsky.pointCount && (
          <span className="text-xs text-gray-500">
            {(punktsky.pointCount / 1_000_000).toFixed(1)}M punkter
          </span>
        )}

        <div className="flex-1" />

        {/* Fargemodus-velger */}
        <div className="flex items-center gap-1">
          <Palette className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={fargemodus}
            onChange={(e) => setFargemodus(e.target.value as Fargemodus)}
            className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
          >
            {tilgjengeligeModuser.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Slett-knapp */}
        <button
          onClick={onSlett}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
          title="Slett punktsky"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 3D-viewer */}
        <div ref={containerRef} className="flex-1 bg-gray-900">
          <PotreeCanvas
            containerRef={containerRef}
            potreeUrl={punktsky.potreeUrl!}
            fargemodus={fargemodus}
            synligeKlasser={synligeKlasser}
          />
        </div>

        {/* Klassifisering-panel (høyre side) */}
        {fargemodus === "klassifisering" && klasser.length > 0 && (
          <div className="w-[220px] overflow-y-auto border-l border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">Klasser</span>
              <div className="flex gap-1">
                <button
                  onClick={velgAlleKlasser}
                  className="rounded px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100"
                >
                  Alle
                </button>
                <button
                  onClick={fjernAlleKlasser}
                  className="rounded px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100"
                >
                  Ingen
                </button>
              </div>
            </div>

            {klasser
              .filter((k) => k.antall > 0)
              .map((k) => (
                <button
                  key={k.kode}
                  onClick={() => toggleKlasse(k.kode)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm border"
                    style={{
                      backgroundColor: synligeKlasser.has(k.kode)
                        ? KLASSE_FARGER[k.kode] ?? "#999"
                        : "transparent",
                      borderColor: KLASSE_FARGER[k.kode] ?? "#999",
                    }}
                  />
                  <span className="flex-1 truncate text-xs text-gray-700">
                    {KLASSE_NAVN[k.kode] ?? `Klasse ${k.kode}`}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {k.antall > 1_000_000
                      ? `${(k.antall / 1_000_000).toFixed(1)}M`
                      : k.antall > 1000
                        ? `${(k.antall / 1000).toFixed(0)}K`
                        : k.antall}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Potree Canvas — Three.js + potree-core                             */
/* ------------------------------------------------------------------ */

interface PotreeCanvasProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  potreeUrl: string;
  fargemodus: Fargemodus;
  synligeKlasser: Set<number>;
}

function PotreeCanvas({ containerRef, potreeUrl, fargemodus, synligeKlasser }: PotreeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<unknown>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renset = false;

    // Dynamic import for SSR-kompatibilitet
    Promise.all([
      import("three"),
      import("potree-core"),
    ]).then(([THREE, Potree]) => {
      if (renset) return;

      const bredde = container.clientWidth;
      const hoyde = container.clientHeight;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);

      // Kamera
      const kamera = new THREE.PerspectiveCamera(60, bredde / hoyde, 0.1, 100000);
      kamera.position.set(0, 0, 100);

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(bredde, hoyde);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Orbit-kontroller (enkel implementasjon)
      let isDragging = false;
      let prevX = 0;
      let prevY = 0;
      let rotX = 0;
      let rotY = 0;
      let avstand = 100;

      function oppdaterKamera() {
        kamera.position.x = avstand * Math.sin(rotY) * Math.cos(rotX);
        kamera.position.y = avstand * Math.sin(rotX);
        kamera.position.z = avstand * Math.cos(rotY) * Math.cos(rotX);
        kamera.lookAt(0, 0, 0);
      }

      renderer.domElement.addEventListener("mousedown", (e) => {
        isDragging = true;
        prevX = e.clientX;
        prevY = e.clientY;
      });

      renderer.domElement.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        rotY += dx * 0.005;
        rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX + dy * 0.005));
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

      // Last punktsky
      const fullUrl = `/api${potreeUrl}`;

      // Vis placeholder-tekst
      const infoDiv = document.createElement("div");
      infoDiv.style.cssText = "position:absolute;bottom:16px;left:16px;color:#888;font-size:12px;font-family:sans-serif;pointer-events:none";
      infoDiv.textContent = "Laster punktsky...";
      container.style.position = "relative";
      container.appendChild(infoDiv);

      // Last via potree-core
      const potreeInstans = new Potree.Potree();
      potreeInstans.loadPointCloud(fullUrl, "")
        .then((pco) => {
          if (renset) return;

          scene.add(pco as unknown as InstanceType<typeof THREE.Object3D>);

          // Sentrer kamera på punktskyen
          const bbox = new THREE.Box3().setFromObject(pco as unknown as InstanceType<typeof THREE.Object3D>);
          const senter = bbox.getCenter(new THREE.Vector3());
          const størrelse = bbox.getSize(new THREE.Vector3());
          avstand = størrelse.length() * 1.5;

          kamera.lookAt(senter);
          oppdaterKamera();

          infoDiv.textContent = "";
        })
        .catch(() => {
          infoDiv.textContent = "Kunne ikke laste punktsky. Sjekk at PotreeConverter er kjørt.";
        });

      // Render-løkke
      let animId: number;
      function animate() {
        animId = requestAnimationFrame(animate);
        renderer.render(scene, kamera);
      }
      animate();

      // Resize
      const resizeObserver = new ResizeObserver(() => {
        const b = container.clientWidth;
        const h = container.clientHeight;
        kamera.aspect = b / h;
        kamera.updateProjectionMatrix();
        renderer.setSize(b, h);
      });
      resizeObserver.observe(container);

      // Cleanup
      return () => {
        renset = true;
        cancelAnimationFrame(animId);
        resizeObserver.disconnect();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        if (container.contains(infoDiv)) {
          container.removeChild(infoDiv);
        }
      };
    });

    return () => {
      renset = true;
    };
  }, [potreeUrl, containerRef]);

  return null;
}
