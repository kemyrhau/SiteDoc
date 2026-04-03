"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  EMNE_KATEGORIER,
  type ReportObjectType,
  type TemplateZone,
  type EmneKategori,
} from "@sitedoc/shared";
import { Modal, Button, Spinner } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import { FeltPalett } from "./FeltPalett";
import { DropSone } from "./DropSone";
import { FeltKonfigurasjon } from "./FeltKonfigurasjon";
import { DragOverlayKomponent } from "./DragOverlay_";
import type { MalObjekt } from "./DraggbartFelt";
import type { TreObjekt } from "./typer";
import { MapPin, Pencil, FileText, Building2, Eye, EyeOff, AlertTriangle } from "lucide-react";

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
  showEnterprise?: boolean;
  showLocation?: boolean;
  showPriority?: boolean;
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
  const { t } = useTranslation();
  const psiModus = mal.category === "psi";
  const utils = trpc.useUtils();
  const [valgtId, setValgtId] = useState<string | null>(null);
  const [visForhandsvisning, setVisForhandsvisning] = useState(false);
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
        <FeltPalett psiModus={psiModus} />

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
            {psiModus && (
              <button
                onClick={() => setVisForhandsvisning(!visForhandsvisning)}
                className={`mt-1 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  visForhandsvisning
                    ? "border-sitedoc-primary bg-blue-50 text-sitedoc-primary"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                {t("psi.forhandsvisning")}
              </button>
            )}
          </div>

          {/* Faste metadata-felter — vises ved opprettelse/utfylling */}
          <div className="mb-2">
            {!psiModus && (
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
              {t("malbygger.fasteFelt")}
            </div>
            )}
            <div className="space-y-1.5">
              {/* Emne — skjules i PSI-modus */}
              {!psiModus && (
              <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className={mal.showSubject === false ? "line-through text-gray-300" : ""}>Emne</span>
                  {mal.showSubject !== false && (
                    <select
                      value={(() => {
                        const subjects = Array.isArray(mal.subjects) ? mal.subjects.map(String) : [];
                        for (const [key, kat] of Object.entries(EMNE_KATEGORIER)) {
                          if (kat.emner.length === subjects.length && kat.emner.every((e) => subjects.includes(e))) return key;
                        }
                        return subjects.length > 0 ? "egendefinert" : "";
                      })()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          oppdaterMalMutation.mutate({ id: mal.id, subjects: [] });
                        } else if (val === "egendefinert") {
                          // Behold eksisterende
                        } else {
                          const kat = EMNE_KATEGORIER[val as EmneKategori];
                          if (kat) oppdaterMalMutation.mutate({ id: mal.id, subjects: kat.emner });
                        }
                      }}
                      className="ml-auto rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Ingen emner</option>
                      {Object.entries(EMNE_KATEGORIER).map(([key, kat]) => (
                        <option key={key} value={key}>{kat.navn} ({kat.emner.length})</option>
                      ))}
                      {Array.isArray(mal.subjects) && (mal.subjects as unknown[]).length > 0 && (() => {
                        const subjects = (mal.subjects as unknown[]).map(String);
                        const erStandard = Object.values(EMNE_KATEGORIER).some(
                          (kat) => kat.emner.length === subjects.length && kat.emner.every((e) => subjects.includes(e)),
                        );
                        return !erStandard ? <option value="egendefinert">Egendefinert ({subjects.length})</option> : null;
                      })()}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => oppdaterMalMutation.mutate({ id: mal.id, showSubject: !(mal.showSubject !== false) })}
                    className={`${mal.showSubject !== false ? "" : "ml-auto"} rounded p-1 hover:bg-gray-200`}
                    title={mal.showSubject === false ? "Vis emne-felt" : "Skjul emne-felt"}
                  >
                    {mal.showSubject === false
                      ? <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                      : <Eye className="h-3.5 w-3.5 text-gray-400" />
                    }
                  </button>
                </div>
                {mal.showSubject !== false && Array.isArray(mal.subjects) && (mal.subjects as unknown[]).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(mal.subjects as unknown[]).map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-xs text-gray-600 border border-gray-200">
                        {String(s)}
                        <button
                          type="button"
                          onClick={() => {
                            const nyListe = (mal.subjects as unknown[]).filter((_, j) => j !== i).map(String);
                            oppdaterMalMutation.mutate({ id: mal.id, subjects: nyListe });
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              )}
              {/* Oppretter-entreprise — skjules i PSI-modus */}
              {!psiModus && (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                <span className={mal.showEnterprise === false ? "line-through text-gray-300" : ""}>Oppretter-entreprise</span>
                <span className="text-xs text-gray-400">
                  {mal.showEnterprise === false ? "Skjult — settes automatisk" : "Velges ved opprettelse"}
                </span>
                <button
                  type="button"
                  onClick={() => oppdaterMalMutation.mutate({ id: mal.id, showEnterprise: !(mal.showEnterprise !== false) })}
                  className="ml-auto rounded p-1 hover:bg-gray-200"
                  title={mal.showEnterprise === false ? "Vis entreprise-felt" : "Skjul entreprise-felt"}
                >
                  {mal.showEnterprise === false
                    ? <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                    : <Eye className="h-3.5 w-3.5 text-gray-400" />
                  }
                </button>
              </div>
              )}
              {/* Lokasjon */}
              <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                <span className={mal.showLocation === false ? "line-through text-gray-300" : ""}>Lokasjon</span>
                <span className="text-xs text-gray-400">
                  {mal.showLocation === false ? "Skjult" : "Settes automatisk fra valgt bygning/tegning"}
                </span>
                <button
                  type="button"
                  onClick={() => oppdaterMalMutation.mutate({ id: mal.id, showLocation: !(mal.showLocation !== false) })}
                  className="ml-auto rounded p-1 hover:bg-gray-200"
                  title={mal.showLocation === false ? "Vis lokasjon-felt" : "Skjul lokasjon-felt"}
                >
                  {mal.showLocation === false
                    ? <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                    : <Eye className="h-3.5 w-3.5 text-gray-400" />
                  }
                </button>
              </div>
              {/* Prioritet (kun oppgavemaler) */}
              {mal.category === "oppgave" && (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className={mal.showPriority === false ? "line-through text-gray-300" : ""}>Prioritet</span>
                  <span className="text-xs text-gray-400">
                    {mal.showPriority === false ? "Skjult" : "Lav / Medium / Høy / Kritisk"}
                  </span>
                  <button
                    type="button"
                    onClick={() => oppdaterMalMutation.mutate({ id: mal.id, showPriority: !(mal.showPriority !== false) })}
                    className="ml-auto rounded p-1 hover:bg-gray-200"
                    title={mal.showPriority === false ? "Vis prioritet-felt" : "Skjul prioritet-felt"}
                  >
                    {mal.showPriority === false
                      ? <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                      : <Eye className="h-3.5 w-3.5 text-gray-400" />
                    }
                  </button>
                </div>
              )}
            </div>
          </div>

          <DropSone
            zone="topptekst"
            label={t("malbygger.topptekst")}
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
            label={psiModus ? t("malbygger.innhold") : t("malbygger.datafelter")}
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

      {/* Høyre — Konfigurasjon eller Forhåndsvisning */}
      {psiModus && visForhandsvisning ? (
        <PsiForhandsvisning objekter={objekter} malNavn={mal.name} onLukk={() => setVisForhandsvisning(false)} />
      ) : valgtObjekt ? (
        <FeltKonfigurasjon
          objekt={valgtObjekt}
          alleObjekter={objekter}
          onLagre={handleLagreKonfig}
          erLagrer={oppdaterObjektMutation.isPending}
          onFjernBetingelse={handleFjernBetingelse}
          onFjernBarnFraKontainer={handleFjernBarnFraKontainer}
          psiModus={psiModus}
        />
      ) : (
        <aside className={`flex shrink-0 items-center justify-center border-l border-gray-200 bg-gray-50 p-4 ${psiModus ? "w-[480px]" : "w-72"}`}>
          <p className="text-center text-sm text-gray-400">
            {t("malbygger.velgFelt")}
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

/* ------------------------------------------------------------------ */
/*  PSI Forhåndsvisning — seksjon-for-seksjon som arbeideren ser det    */
/* ------------------------------------------------------------------ */

function PsiForhandsvisning({ objekter, malNavn, onLukk }: { objekter: MalObjekt[]; malNavn: string; onLukk: () => void }) {
  const [aktivSeksjon, setAktivSeksjon] = useState(0);

  // Del inn i seksjoner basert på headings
  const seksjoner = useMemo(() => {
    const rot = [...objekter].sort((a, b) => a.sortOrder - b.sortOrder).filter((o) => !o.parentId);
    const result: Array<{ tittel: string; objekter: MalObjekt[] }> = [];
    let gjeldende: { tittel: string; objekter: MalObjekt[] } | null = null;

    for (const obj of rot) {
      if (obj.type === "heading") {
        if (gjeldende) result.push(gjeldende);
        gjeldende = { tittel: obj.label, objekter: [] };
      } else {
        if (!gjeldende) gjeldende = { tittel: "Introduksjon", objekter: [] };
        gjeldende.objekter.push(obj);
      }
    }
    if (gjeldende) result.push(gjeldende);
    return result;
  }, [objekter]);

  const seksjon = seksjoner[aktivSeksjon];

  return (
    <aside className="flex h-full w-[560px] shrink-0 flex-col border-l border-gray-200 bg-white">
      {/* Header med progresjon */}
      <div className="border-b border-gray-200 px-5 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Forhåndsvisning</p>
          <button onClick={onLukk} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <p className="mt-0.5 text-sm font-semibold text-gray-900">{malNavn}</p>
        <div className="mt-2 flex gap-1">
          {seksjoner.map((_, i) => (
            <button
              key={i}
              onClick={() => setAktivSeksjon(i)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i === aktivSeksjon ? "bg-sitedoc-primary" : i < aktivSeksjon ? "bg-green-400" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Seksjonstittel */}
      {seksjon && (
        <div className="border-b border-gray-100 px-5 py-3">
          <span className="text-xs text-gray-400">{aktivSeksjon + 1} / {seksjoner.length}</span>
          <h2 className="mt-0.5 text-lg font-semibold text-gray-900">{seksjon.tittel}</h2>
        </div>
      )}

      {/* Innhold */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {seksjon?.objekter.map((obj) => (
          <PsiPreviewObjekt key={obj.id} objekt={obj} />
        ))}
        {seksjon?.objekter.length === 0 && (
          <p className="text-sm italic text-gray-400">Ingen innhold i denne seksjonen</p>
        )}
      </div>

      {/* Navigasjon */}
      <div className="flex gap-2 border-t border-gray-200 px-5 py-3">
        <button
          onClick={() => setAktivSeksjon(Math.max(0, aktivSeksjon - 1))}
          disabled={aktivSeksjon === 0}
          className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 disabled:opacity-30"
        >
          Forrige
        </button>
        <button
          onClick={() => setAktivSeksjon(Math.min(seksjoner.length - 1, aktivSeksjon + 1))}
          disabled={aktivSeksjon === seksjoner.length - 1}
          className="flex-1 rounded-lg bg-sitedoc-primary py-2 text-sm font-medium text-white disabled:opacity-30"
        >
          Neste
        </button>
      </div>
    </aside>
  );
}

function PsiPreviewObjekt({ objekt }: { objekt: MalObjekt }) {
  const config = objekt.config as Record<string, unknown>;

  switch (objekt.type) {
    case "info_text": {
      const innhold = (config.content as string) ?? "";
      return innhold ? (
        <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{innhold}</p>
      ) : (
        <p className="mb-4 text-sm italic text-gray-300">Ingen tekst lagt inn</p>
      );
    }
    case "info_image": {
      const url = (config.imageUrl as string) ?? "";
      const caption = (config.caption as string) ?? "";
      return (
        <figure className="mb-4">
          {url ? (
            <img
              src={url.startsWith("http") ? url : `/api${url}`}
              alt={caption}
              className="max-w-full rounded-lg border border-gray-200"
            />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
              Bilde ikke lastet opp
            </div>
          )}
          {caption && <figcaption className="mt-1 text-center text-xs italic text-gray-500">{caption}</figcaption>}
        </figure>
      );
    }
    case "video": {
      const url = (config.url as string) ?? "";
      return url ? (
        <div className="mb-4 aspect-video overflow-hidden rounded-lg border border-gray-200 bg-black">
          <video src={url.startsWith("http") ? url : `/api${url}`} controls className="h-full w-full" />
        </div>
      ) : (
        <div className="mb-4 flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
          Video-URL ikke satt
        </div>
      );
    }
    case "quiz": {
      const spørsmål = (config.question as string) ?? objekt.label;
      const alternativer = (config.options as string[]) ?? [];
      const riktig = (config.correctIndex as number) ?? 0;
      return (
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-sm font-semibold text-gray-900">{spørsmål}</p>
          {alternativer.map((alt, i) => (
            <div key={i} className={`mb-1.5 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              i === riktig ? "border-green-300 bg-green-50 text-green-800" : "border-gray-200 text-gray-700"
            }`}>
              <div className={`h-4 w-4 rounded-full border-2 ${i === riktig ? "border-green-500 bg-green-500" : "border-gray-300"}`}>
                {i === riktig && <div className="mx-auto mt-0.5 h-2 w-2 rounded-full bg-white" />}
              </div>
              {alt}
            </div>
          ))}
        </div>
      );
    }
    case "signature":
      return (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
          <div className="mx-auto h-20 w-full max-w-xs rounded border border-dashed border-gray-300 bg-white" />
          <p className="mt-2 text-xs text-gray-500">Signatur</p>
        </div>
      );
    case "subtitle":
      return <p className="mb-2 text-sm font-medium text-gray-600">{objekt.label}</p>;
    default:
      return null;
  }
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
