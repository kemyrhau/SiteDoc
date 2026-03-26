"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Active,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  REPORT_OBJECT_TYPE_META,
  type ReportObjectType,
  type TemplateZone,
} from "@sitedoc/shared";
import { Modal, Button, Spinner } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import { FeltPalett } from "./FeltPalett";
import { DropSone } from "./DropSone";
import { FeltKonfigurasjon } from "./FeltKonfigurasjon";
import { DragOverlayKomponent } from "./DragOverlay_";
import type { MalObjekt } from "./DraggbartFelt";
import type { TreObjekt } from "./typer";
import { MapPin, Pencil, FileText, Building2, Eye, EyeOff } from "lucide-react";

// Hent streng-verdi fra opsjon (støtter både string og {label, value}-format)
function opsjonTilStreng(opsjon: unknown): string {
  if (typeof opsjon === "string") return opsjon;
  if (typeof opsjon === "object" && opsjon !== null) {
    const obj = opsjon as Record<string, unknown>;
    if (typeof obj.label === "string") return obj.label;
    if (typeof obj.value === "string") return obj.value;
  }
  return String(opsjon);
}

interface MalData {
  id: string;
  name: string;
  description: string | null;
  category?: string;
  subjects?: unknown;
  showSubject?: boolean;
  objects: Array<{
    id: string;
    type: string;
    label: string;
    required: boolean;
    sortOrder: number;
    config: unknown;
    parentId: string | null;
  }>;
}

interface MalByggerProps {
  mal: MalData;
}

function hentZone(config: unknown): TemplateZone {
  if (
    typeof config === "object" &&
    config !== null &&
    "zone" in config &&
    ((config as Record<string, unknown>).zone === "topptekst" ||
      (config as Record<string, unknown>).zone === "datafelter")
  ) {
    return (config as Record<string, unknown>).zone as TemplateZone;
  }
  return "datafelter";
}

function tilMalObjekt(obj: MalData["objects"][number]): MalObjekt {
  return {
    id: obj.id,
    type: obj.type,
    label: obj.label,
    required: obj.required,
    sortOrder: obj.sortOrder,
    config: typeof obj.config === "object" && obj.config !== null
      ? (obj.config as Record<string, unknown>)
      : {},
    parentId: obj.parentId ?? null,
  };
}

// Bygg trestruktur fra flat array
function byggTre(objekter: MalObjekt[]): TreObjekt[] {
  const map = new Map<string, TreObjekt>();
  const rotObjekter: TreObjekt[] = [];

  for (const obj of objekter) {
    map.set(obj.id, { ...obj, children: [] });
  }

  for (const obj of objekter) {
    const node = map.get(obj.id)!;
    if (obj.parentId && map.has(obj.parentId)) {
      map.get(obj.parentId)!.children.push(node);
    } else {
      rotObjekter.push(node);
    }
  }

  function sorterRekursivt(noder: TreObjekt[]) {
    noder.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const node of noder) {
      sorterRekursivt(node.children);
    }
  }

  sorterRekursivt(rotObjekter);
  return rotObjekter;
}

// Finn alle etterkommere (rekursivt) av et objekt
function finnAlleEtterkommere(objekter: MalObjekt[], parentId: string): MalObjekt[] {
  const direkte = objekter.filter((o) => o.parentId === parentId);
  const alle: MalObjekt[] = [...direkte];
  for (const barn of direkte) {
    alle.push(...finnAlleEtterkommere(objekter, barn.id));
  }
  return alle;
}

// Sjekk om et objekt aksepterer barn (repeater alltid, list-kontainere kun med conditionActive)
function akseptererBarn(objekt: MalObjekt): boolean {
  if (objekt.type === "repeater") return true;
  return objekt.config.conditionActive === true;
}

// Sjekk om `muligForelderId` er en etterkommer av `objektId` (sirkulær referanse-vakt)
function erEtterkommer(objekter: MalObjekt[], objektId: string, muligForelderId: string): boolean {
  let currentId: string | null = muligForelderId;
  let dybde = 0;
  while (currentId && dybde < 10) {
    if (currentId === objektId) return true;
    const current = objekter.find((o) => o.id === currentId);
    currentId = current?.parentId ?? null;
    dybde++;
  }
  return false;
}

export function MalBygger({ mal }: MalByggerProps) {
  const utils = trpc.useUtils();
  const [valgtId, setValgtId] = useState<string | null>(null);
  const [aktivtDrag, setAktivtDrag] = useState<Active | null>(null);
  const [slettBekreftelse, setSlettBekreftelse] = useState<{ id: string; label: string } | null>(null);

  // Inline-redigering av malnavn
  const [redigererNavn, setRedigererNavn] = useState(false);
  const [malNavn, setMalNavn] = useState(mal.name);
  const navnInputRef = useRef<HTMLInputElement>(null);
  const oppdaterMalMutation = trpc.mal.oppdaterMal.useMutation({
    onSuccess: () => {
      utils.mal.hentMedId.invalidate({ id: mal.id });
      utils.mal.hentForProsjekt.invalidate();
    },
  });

  const lagreNavn = useCallback(() => {
    const trimmet = malNavn.trim();
    if (trimmet && trimmet !== mal.name) {
      oppdaterMalMutation.mutate({ id: mal.id, name: trimmet });
    } else {
      setMalNavn(mal.name);
    }
    setRedigererNavn(false);
  }, [malNavn, mal.name, mal.id, oppdaterMalMutation]);

  // Lokale objekter for optimistisk oppdatering
  const [objekter, setObjekter] = useState<MalObjekt[]>(
    () => mal.objects.map(tilMalObjekt),
  );

  // Bygg trestruktur
  const rotObjekter = useMemo(() => {
    const sortert = [...objekter].sort((a, b) => a.sortOrder - b.sortOrder);
    return byggTre(sortert);
  }, [objekter]);

  // Del trestrukturen i to soner (kun rot-objekter har sone)
  const topptekstTre = rotObjekter.filter((o) => hentZone(o.config) === "topptekst");
  const datafeltTre = rotObjekter.filter((o) => hentZone(o.config) === "datafelter");

  // Valgt objekt for konfigurasjon
  const valgtObjekt = valgtId ? objekter.find((o) => o.id === valgtId) ?? null : null;

  // Refetch-hjelper
  const refetchMal = useCallback(async () => {
    const oppdatert = await utils.mal.hentMedId.fetch({ id: mal.id });
    if (oppdatert) {
      setObjekter(
        (oppdatert.objects as MalData["objects"]).map(tilMalObjekt),
      );
    }
  }, [utils.mal.hentMedId, mal.id]);

  // tRPC-mutasjoner
  const leggTilMutation = trpc.mal.leggTilObjekt.useMutation({
    onSuccess: () => { refetchMal(); },
  });

  const slettMutation = trpc.mal.slettObjekt.useMutation({
    onSuccess: (_data: unknown, variabler: { id: string }) => {
      setObjekter((prev) => prev.filter((o) => o.id !== variabler.id));
      if (valgtId === variabler.id) setValgtId(null);
    },
  });

  const oppdaterRekkefølgeMutation = trpc.mal.oppdaterRekkefølge.useMutation();

  const oppdaterObjektMutation = trpc.mal.oppdaterObjekt.useMutation({
    onSuccess: () => { refetchMal(); },
  });

  // Sensorer
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Finn hvilken sone et objekt-id tilhører (gå opp til rot)
  const finnSone = useCallback(
    (id: string): TemplateZone | null => {
      const objekt = objekter.find((o) => o.id === id);
      if (!objekt) return null;
      // Gå opp til rot for å finne sone
      let current = objekt;
      while (current.parentId) {
        const parent = objekter.find((o) => o.id === current.parentId);
        if (!parent) break;
        current = parent;
      }
      return hentZone(current.config);
    },
    [objekter],
  );

  // Finn droppable sone fra over-id
  function finnMålSone(overId: string | null): TemplateZone | null {
    if (!overId) return null;
    if (overId === "sone-topptekst") return "topptekst";
    if (overId === "sone-datafelter") return "datafelter";
    return finnSone(overId as string);
  }

  // --- BETINGELSE-HANDLERS ---

  function handleTilfoyjBetingelse(parentId: string) {
    setObjekter((prev) => {
      const neste = [...prev];
      const idx = neste.findIndex((o) => o.id === parentId);
      if (idx === -1) return prev;

      const forelder = neste[idx];
      if (!forelder) return prev;

      const råOpsjoner = (forelder.config.options as unknown[]) ?? [];
      const førsteOpsjon = råOpsjoner[0];
      if (!førsteOpsjon) return prev;

      const førsteVerdi = opsjonTilStreng(førsteOpsjon);

      neste[idx] = {
        ...forelder,
        config: {
          ...forelder.config,
          conditionActive: true,
          conditionValues: [førsteVerdi],
        },
      };

      return neste;
    });

    // Lagre til server
    const forelder = objekter.find((o) => o.id === parentId);
    if (forelder) {
      const råOpsjoner = (forelder.config.options as unknown[]) ?? [];
      const førsteOpsjon = råOpsjoner[0];
      if (førsteOpsjon) {
        const førsteVerdi = opsjonTilStreng(førsteOpsjon);
        oppdaterObjektMutation.mutate({
          id: parentId,
          config: {
            ...forelder.config,
            conditionActive: true,
            conditionValues: [førsteVerdi],
          },
        });
      }
    }
  }

  function handleOppdaterBetingelseVerdier(parentId: string, verdier: string[]) {
    setObjekter((prev) => {
      const neste = [...prev];
      const idx = neste.findIndex((o) => o.id === parentId);
      if (idx === -1) return prev;

      const forelder = neste[idx];
      if (!forelder) return prev;

      neste[idx] = {
        ...forelder,
        config: {
          ...forelder.config,
          conditionValues: verdier,
        },
      };

      return neste;
    });

    const forelder = objekter.find((o) => o.id === parentId);
    if (forelder) {
      oppdaterObjektMutation.mutate({
        id: parentId,
        config: {
          ...forelder.config,
          conditionValues: verdier,
        },
      });
    }
  }

  function handleFjernBetingelse(parentId: string) {
    // Fjern conditionActive/conditionValues fra forelder, og frigjør alle direkte barn
    setObjekter((prev) => {
      return prev.map((o) => {
        if (o.id === parentId) {
          const { conditionActive: _, conditionValues: __, ...restConfig } = o.config;
          return { ...o, config: restConfig };
        }
        // Direkte barn → frigjør fra kontaineren (sett parentId = null)
        if (o.parentId === parentId) {
          return { ...o, parentId: null };
        }
        return o;
      });
    });

    // Lagre forelder config til server
    const forelder = objekter.find((o) => o.id === parentId);
    if (forelder) {
      const { conditionActive: _, conditionValues: __, ...restConfig } = forelder.config;
      oppdaterObjektMutation.mutate({
        id: parentId,
        config: restConfig,
      });
    }

    // Frigjør barn fra kontainer (nullstill parentId)
    const barn = objekter.filter((o) => o.parentId === parentId);
    for (const b of barn) {
      oppdaterObjektMutation.mutate({
        id: b.id,
        parentId: null,
      });
    }
  }

  function handleFjernBarnFraKontainer(barnId: string) {
    setObjekter((prev) => {
      return prev.map((o) => {
        if (o.id === barnId) {
          return { ...o, parentId: null };
        }
        return o;
      });
    });

    oppdaterObjektMutation.mutate({
      id: barnId,
      parentId: null,
    });
  }

  // --- DRAG-AND-DROP ---

  function handleDragStart(event: DragStartEvent) {
    setAktivtDrag(event.active);
  }

  function handleDragEnd(event: DragEndEvent) {
    setAktivtDrag(null);
    const { active, over } = event;

    if (!over) return;

    const data = active.data.current;

    // --- NYE FELT FRA PALETTEN ---
    if (data?.fraKilde === "palett") {
      const type = data.type as ReportObjectType;
      const meta = REPORT_OBJECT_TYPE_META[type];
      const målSone = finnMålSone(over.id as string) ?? "datafelter";

      // Finn posisjon og mulig forelder
      const overObjekt = objekter.find((o) => o.id === over.id);
      let parentId: string | null = null;
      let sortOrder: number;

      if (overObjekt) {
        // Droppet over et element
        if (akseptererBarn(overObjekt)) {
          // Droppet på kontainer → bli barn
          parentId = overObjekt.id;
          const barn = objekter.filter((o) => o.parentId === overObjekt.id);
          const sisteBarn = barn.sort((a, b) => b.sortOrder - a.sortOrder)[0];
          sortOrder = sisteBarn ? sisteBarn.sortOrder + 1 : 0;
        } else if (overObjekt.parentId) {
          // Droppet på et barn → arv samme forelder
          parentId = overObjekt.parentId;
          sortOrder = overObjekt.sortOrder + 1;
        } else {
          sortOrder = overObjekt.sortOrder + 1;
        }
      } else {
        // Droppet på tom sone
        const rotObjekterISone = objekter.filter(
          (o) => !o.parentId && hentZone(o.config) === målSone,
        );
        const siste = rotObjekterISone.sort((a, b) => b.sortOrder - a.sortOrder)[0];
        sortOrder = siste ? siste.sortOrder + 1 : 0;
      }

      const nyConfig: Record<string, unknown> = { ...meta.defaultConfig, zone: målSone };

      leggTilMutation.mutate({
        templateId: mal.id,
        type,
        label: meta.label,
        config: nyConfig,
        sortOrder,
        required: false,
        parentId,
      });
      return;
    }

    // --- OMSORTERING INNENFOR / MELLOM SONER ---
    if (data?.fraKilde === "sone") {
      const aktivId = active.id as string;
      const overId = over.id as string;

      if (aktivId === overId) return;

      const kildeSone = finnSone(aktivId);
      const målSone = finnMålSone(overId) ?? kildeSone;

      if (!kildeSone || !målSone) return;

      setObjekter((prev) => {
        const neste = [...prev];
        const aktivObjekt = neste.find((o) => o.id === aktivId);
        const overObjekt = neste.find((o) => o.id === overId);

        if (!aktivObjekt) return prev;

        if (kildeSone === målSone) {
          // Sortering innenfor samme sone — finn alle objekter på samme nivå
          const aktivParentId = aktivObjekt.parentId;

          // Sjekk om vi drar inn i en kontainer, ut av en, eller innenfor samme nivå
          if (overObjekt) {
            if (akseptererBarn(overObjekt) && overObjekt.id !== aktivParentId && !erEtterkommer(neste, aktivId, overObjekt.id)) {
              // Droppet på kontainer → bli barn av den kontaineren (med sirkulær referanse-vakt)
              const aktivIdx = neste.findIndex((o) => o.id === aktivId);
              if (aktivIdx !== -1) {
                neste[aktivIdx] = { ...aktivObjekt, parentId: overObjekt.id };
              }
            } else if (overObjekt.parentId && overObjekt.parentId !== aktivParentId) {
              // Droppet på et barn av en annen kontainer → flytt dit
              const aktivIdx = neste.findIndex((o) => o.id === aktivId);
              if (aktivIdx !== -1) {
                neste[aktivIdx] = { ...aktivObjekt, parentId: overObjekt.parentId };
              }
            } else if (!overObjekt.parentId && aktivParentId) {
              // Droppet på rot-nivå — fjern fra kontainer
              const aktivIdx = neste.findIndex((o) => o.id === aktivId);
              if (aktivIdx !== -1) {
                neste[aktivIdx] = { ...aktivObjekt, parentId: null };
              }
            }
          }

          // Omsorter på riktig nivå
          const oppdatertAktiv = neste.find((o) => o.id === aktivId)!;
          const nivåObjekter = neste
            .filter((o) => o.parentId === oppdatertAktiv.parentId && hentZone(o.config) === kildeSone)
            .sort((a, b) => a.sortOrder - b.sortOrder);

          const gammelIdx = nivåObjekter.findIndex((o) => o.id === aktivId);
          const nyIdx = nivåObjekter.findIndex((o) => o.id === overId);

          if (gammelIdx !== -1 && nyIdx !== -1 && gammelIdx !== nyIdx) {
            const omorganisert = arrayMove(nivåObjekter, gammelIdx, nyIdx);
            for (let i = 0; i < omorganisert.length; i++) {
              const obj = omorganisert[i];
              if (!obj) continue;
              const idx = neste.findIndex((n) => n.id === obj.id);
              const eksisterende = idx !== -1 ? neste[idx] : undefined;
              if (idx !== -1 && eksisterende) {
                neste[idx] = { ...eksisterende, sortOrder: i };
              }
            }
          }
        } else {
          // Flytt mellom soner — fjern fra kontainer
          const idx = neste.findIndex((o) => o.id === aktivId);
          if (idx === -1) return prev;

          neste[idx] = {
            ...aktivObjekt,
            parentId: null,
            config: { ...aktivObjekt.config, zone: målSone },
          };

          // Renummerer begge soner (kun rot-nivå)
          const renummerer = (sone: TemplateZone) => {
            const soneObjekter = neste
              .filter((o) => !o.parentId && hentZone(o.config) === sone)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            for (let i = 0; i < soneObjekter.length; i++) {
              const obj = soneObjekter[i];
              if (!obj) continue;
              const oIdx = neste.findIndex((n) => n.id === obj.id);
              const eksisterende = oIdx !== -1 ? neste[oIdx] : undefined;
              if (oIdx !== -1 && eksisterende) {
                neste[oIdx] = { ...eksisterende, sortOrder: i };
              }
            }
          };

          renummerer(kildeSone);
          renummerer(målSone);
        }

        // Lagre til server — global sortOrder: topptekst først, deretter datafelter
        // Slik at mobil/web-utfylling sorterer riktig med kun sortOrder
        const topptekstRot = neste
          .filter((o) => !o.parentId && hentZone(o.config) === "topptekst")
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const datafeltRot = neste
          .filter((o) => !o.parentId && hentZone(o.config) === "datafelter")
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const globalRot = [...topptekstRot, ...datafeltRot];

        const oppdateringer = neste.map((o) => {
          const globalIdx = globalRot.findIndex((r) => r.id === o.id);
          return {
            id: o.id,
            sortOrder: globalIdx >= 0 ? globalIdx : o.sortOrder,
            zone: hentZone(o.config),
            parentId: o.parentId,
          };
        });
        oppdaterRekkefølgeMutation.mutate({ objekter: oppdateringer });

        return neste;
      });
    }
  }

  function handleSlett(id: string) {
    const objekt = objekter.find((o) => o.id === id);
    const label = objekt?.label ?? "felt";
    setSlettBekreftelse({ id, label });
  }

  function utførSlett(id: string) {
    // Med CASCADE fjerner databasen barn automatisk.
    // Optimistisk: fjern feltet + alle etterkommere lokalt
    const etterkommere = finnAlleEtterkommere(objekter, id);
    const sletteIder = new Set([id, ...etterkommere.map((e) => e.id)]);

    setObjekter((prev) => prev.filter((o) => !sletteIder.has(o.id)));
    if (valgtId && sletteIder.has(valgtId)) setValgtId(null);

    slettMutation.mutate({ id });
    setSlettBekreftelse(null);
  }

  function handleLagreKonfig(data: {
    label: string;
    required: boolean;
    config: Record<string, unknown>;
  }) {
    if (!valgtId) return;
    oppdaterObjektMutation.mutate({
      id: valgtId,
      label: data.label,
      required: data.required,
      config: data.config,
    });
  }

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-lg border border-gray-200 bg-white">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Venstre — Feltpalett */}
        <FeltPalett />

        {/* Midt — Malsoner */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="mb-1">
            {redigererNavn ? (
              <input
                ref={navnInputRef}
                type="text"
                value={malNavn}
                onChange={(e) => setMalNavn(e.target.value)}
                onBlur={lagreNavn}
                onKeyDown={(e) => {
                  if (e.key === "Enter") lagreNavn();
                  if (e.key === "Escape") { setMalNavn(mal.name); setRedigererNavn(false); }
                }}
                autoFocus
                className="w-full rounded border border-blue-300 bg-white px-2 py-0.5 text-base font-semibold outline-none focus:ring-2 focus:ring-blue-200"
              />
            ) : (
              <button
                onClick={() => { setRedigererNavn(true); setMalNavn(mal.name); }}
                className="group flex items-center gap-1.5 text-base font-semibold hover:text-blue-700"
                title="Rediger malnavn"
              >
                {mal.name}
                <Pencil className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-500" />
              </button>
            )}
            {mal.description && (
              <p className="text-sm text-gray-500">{mal.description}</p>
            )}
          </div>

          {/* Faste metadata-felter — vises ved opprettelse/utfylling */}
          <div className="mb-2">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Faste felt
            </div>
            <div className="space-y-1.5">
              {/* Emne */}
              <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                <span className={mal.showSubject === false ? "line-through text-gray-300" : ""}>Emne</span>
                <span className="text-xs text-gray-400">
                  {mal.showSubject === false ? "Skjult" : "Fritekst eller forhåndsdefinerte emner"}
                </span>
                <button
                  type="button"
                  onClick={() => oppdaterMalMutation.mutate({ id: mal.id, showSubject: !(mal.showSubject !== false) })}
                  className="ml-auto rounded p-1 hover:bg-gray-200"
                  title={mal.showSubject === false ? "Vis emne-felt" : "Skjul emne-felt"}
                >
                  {mal.showSubject === false
                    ? <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                    : <Eye className="h-3.5 w-3.5 text-gray-400" />
                  }
                </button>
              </div>
              {/* Oppretter-entreprise */}
              <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                <span>Oppretter-entreprise</span>
                <span className="ml-auto text-xs text-gray-400">Påkrevd ved opprettelse</span>
              </div>
              {/* Lokasjon */}
              <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                <span>Lokasjon</span>
                <span className="ml-auto text-xs text-gray-400">Settes automatisk fra valgt bygning/tegning</span>
              </div>
            </div>
          </div>

          <DropSone
            zone="topptekst"
            label="Topptekst"
            treObjekter={topptekstTre}
            alleObjekter={objekter}
            valgtId={valgtId}
            onVelg={setValgtId}
            onSlett={handleSlett}
            onTilfoyjBetingelse={handleTilfoyjBetingelse}
            onOppdaterBetingelseVerdier={handleOppdaterBetingelseVerdier}
            onFjernBetingelse={handleFjernBetingelse}
            onFjernBarnFraKontainer={handleFjernBarnFraKontainer}
          />

          <DropSone
            zone="datafelter"
            label="Datafelter"
            treObjekter={datafeltTre}
            alleObjekter={objekter}
            valgtId={valgtId}
            onVelg={setValgtId}
            onSlett={handleSlett}
            onTilfoyjBetingelse={handleTilfoyjBetingelse}
            onOppdaterBetingelseVerdier={handleOppdaterBetingelseVerdier}
            onFjernBetingelse={handleFjernBetingelse}
            onFjernBarnFraKontainer={handleFjernBarnFraKontainer}
          />
        </div>

        {/* Drag overlay */}
        <DragOverlayKomponent aktivt={aktivtDrag} />
      </DndContext>

      {/* Høyre — Konfigurasjon */}
      {valgtObjekt ? (
        <FeltKonfigurasjon
          objekt={valgtObjekt}
          alleObjekter={objekter}
          onLagre={handleLagreKonfig}
          erLagrer={oppdaterObjektMutation.isPending}
          onFjernBetingelse={handleFjernBetingelse}
          onFjernBarnFraKontainer={handleFjernBarnFraKontainer}
        />
      ) : (
        <aside className="flex w-72 shrink-0 items-center justify-center border-l border-gray-200 bg-gray-50 p-4">
          <p className="text-center text-sm text-gray-400">
            Velg et felt for å redigere konfigurasjon
          </p>
        </aside>
      )}

      {/* Slett-bekreftelsesmodal */}
      {slettBekreftelse && (
        <SlettBekreftelse
          id={slettBekreftelse.id}
          label={slettBekreftelse.label}
          onBekreft={() => utførSlett(slettBekreftelse.id)}
          onAvbryt={() => setSlettBekreftelse(null)}
        />
      )}
    </div>
  );
}

function formaterNummer(prefiks: string | null | undefined, nummer: number | null | undefined): string {
  if (!nummer) return "";
  if (prefiks) return `${prefiks}-${String(nummer).padStart(3, "0")}`;
  return String(nummer);
}

function SlettBekreftelse({
  id,
  label,
  onBekreft,
  onAvbryt,
}: {
  id: string;
  label: string;
  onBekreft: () => void;
  onAvbryt: () => void;
}) {
  const { data, isLoading } = trpc.mal.sjekkObjektBruk.useQuery({ id });

  const harBruk = data && (data.sjekklister.length > 0 || data.oppgaver.length > 0);

  return (
    <Modal open={true} title={`Slett «${label}»?`} onClose={onAvbryt}>
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Spinner size="sm" />
            Sjekker bruk i sjekklister og oppgaver…
          </div>
        ) : harBruk ? (
          <>
            <p className="text-sm text-gray-700">
              Feltet kan ikke slettes fordi følgende dokumenter inneholder data for dette feltet.
              Fjern eller tøm dataen i disse dokumentene først.
            </p>

            {data.sjekklister.length > 0 && (
              <div>
                <h4 className="mb-1 text-sm font-medium text-gray-700">
                  Sjekklister ({data.sjekklister.length})
                </h4>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {data.sjekklister.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-gray-600 hover:bg-gray-50">
                      <span className="font-mono text-xs text-gray-400">
                        {formaterNummer(s.template?.prefix, s.number)}
                      </span>
                      <span className="truncate">{s.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.oppgaver.length > 0 && (
              <div>
                <h4 className="mb-1 text-sm font-medium text-gray-700">
                  Oppgaver ({data.oppgaver.length})
                </h4>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {data.oppgaver.map((o) => (
                    <li key={o.id} className="flex items-center gap-2 rounded px-2 py-1 text-gray-600 hover:bg-gray-50">
                      <span className="font-mono text-xs text-gray-400">
                        {formaterNummer(o.template?.prefix, o.number)}
                      </span>
                      <span className="truncate">{o.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">
            Ingen sjekklister eller oppgaver bruker dette feltet.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onAvbryt}>
            {harBruk ? "Lukk" : "Avbryt"}
          </Button>
          {harBruk && (
            <Button
              variant="danger"
              onClick={onBekreft}
            >
              Tving slett (test)
            </Button>
          )}
          {!harBruk && (
            <Button
              variant="danger"
              onClick={onBekreft}
              disabled={isLoading}
            >
              Slett
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
