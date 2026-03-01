"use client";

import { useState, useCallback } from "react";
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
} from "@siteflow/shared";
import { trpc } from "@/lib/trpc";
import { FeltPalett } from "./FeltPalett";
import { DropSone } from "./DropSone";
import { FeltKonfigurasjon } from "./FeltKonfigurasjon";
import { DragOverlayKomponent } from "./DragOverlay_";
import type { MalObjekt } from "./DraggbartFelt";

interface MalData {
  id: string;
  name: string;
  description: string | null;
  objects: Array<{
    id: string;
    type: string;
    label: string;
    required: boolean;
    sortOrder: number;
    config: unknown;
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
  };
}

export function MalBygger({ mal }: MalByggerProps) {
  const utils = trpc.useUtils();
  const [valgtId, setValgtId] = useState<string | null>(null);
  const [aktivtDrag, setAktivtDrag] = useState<Active | null>(null);

  // Lokale objekter for optimistisk oppdatering
  const [objekter, setObjekter] = useState<MalObjekt[]>(
    () => mal.objects.map(tilMalObjekt),
  );

  // Del objekter i to soner
  const topptekstObjekter = objekter
    .filter((o) => hentZone(o.config) === "topptekst")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const datafeltObjekter = objekter
    .filter((o) => hentZone(o.config) === "datafelter")
    .sort((a, b) => a.sortOrder - b.sortOrder);

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
    onSuccess: (_data, variabler) => {
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

  // Finn hvilken sone et objekt-id tilhører
  const finnSone = useCallback(
    (id: string): TemplateZone | null => {
      const objekt = objekter.find((o) => o.id === id);
      if (!objekt) return null;
      return hentZone(objekt.config);
    },
    [objekter],
  );

  // Finn droppable sone fra over-id
  function finnMålSone(overId: string | null): TemplateZone | null {
    if (!overId) return null;

    // Direkte droppet på en sone-container
    if (overId === "sone-topptekst") return "topptekst";
    if (overId === "sone-datafelter") return "datafelter";

    // Droppet over et eksisterende element — finn dets sone
    return finnSone(overId as string);
  }

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

      const soneObjekter =
        målSone === "topptekst" ? topptekstObjekter : datafeltObjekter;

      // Finn posisjon: droppet over et element → sett inn etter det, ellers på slutten
      let sortOrder: number;
      const overObjekt = soneObjekter.find((o) => o.id === over.id);
      if (overObjekt) {
        sortOrder = overObjekt.sortOrder + 1;
      } else {
        const siste = soneObjekter[soneObjekter.length - 1];
        sortOrder = siste ? siste.sortOrder + 1 : 0;
      }

      leggTilMutation.mutate({
        templateId: mal.id,
        type,
        label: meta.label,
        config: { ...meta.defaultConfig, zone: målSone },
        sortOrder,
        required: false,
      });
      return;
    }

    // --- OMSORTERING INNENFOR / MELLOM SONER ---
    if (data?.fraKilde === "sone") {
      const aktivId = active.id as string;
      const overId = over.id as string;

      const kildeSone = finnSone(aktivId);
      const målSone = finnMålSone(overId) ?? kildeSone;

      if (!kildeSone || !målSone) return;

      setObjekter((prev) => {
        const neste = [...prev];

        if (kildeSone === målSone) {
          // Sortering innenfor samme sone
          const soneObjekter = neste
            .filter((o) => hentZone(o.config) === kildeSone)
            .sort((a, b) => a.sortOrder - b.sortOrder);

          const gammelIdx = soneObjekter.findIndex((o) => o.id === aktivId);
          const nyIdx = soneObjekter.findIndex((o) => o.id === overId);

          if (gammelIdx === -1 || nyIdx === -1 || gammelIdx === nyIdx) return prev;

          const omorganisert = arrayMove(soneObjekter, gammelIdx, nyIdx);
          for (let i = 0; i < omorganisert.length; i++) {
            const obj = omorganisert[i];
            if (!obj) continue;
            const idx = neste.findIndex((n) => n.id === obj.id);
            const eksisterende = idx !== -1 ? neste[idx] : undefined;
            if (idx !== -1 && eksisterende) {
              neste[idx] = { id: eksisterende.id, type: eksisterende.type, label: eksisterende.label, required: eksisterende.required, config: eksisterende.config, sortOrder: i };
            }
          }
        } else {
          // Flytt mellom soner
          const idx = neste.findIndex((o) => o.id === aktivId);
          if (idx === -1) return prev;

          // Oppdater sone i config
          const gammel = neste[idx];
          if (!gammel) return prev;
          neste[idx] = {
            id: gammel.id,
            type: gammel.type,
            label: gammel.label,
            required: gammel.required,
            sortOrder: gammel.sortOrder,
            config: { ...gammel.config, zone: målSone },
          };

          // Renummerer begge soner
          const renummerer = (sone: TemplateZone) => {
            const soneObjekter = neste
              .filter((o) => hentZone(o.config) === sone)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            for (let i = 0; i < soneObjekter.length; i++) {
              const obj = soneObjekter[i];
              if (!obj) continue;
              const oIdx = neste.findIndex((n) => n.id === obj.id);
              const eksisterende = oIdx !== -1 ? neste[oIdx] : undefined;
              if (oIdx !== -1 && eksisterende) {
                neste[oIdx] = { id: eksisterende.id, type: eksisterende.type, label: eksisterende.label, required: eksisterende.required, config: eksisterende.config, sortOrder: i };
              }
            }
          };

          renummerer(kildeSone);
          renummerer(målSone);
        }

        // Lagre til server
        const oppdateringer = neste.map((o) => ({
          id: o.id,
          sortOrder: o.sortOrder,
          zone: hentZone(o.config),
        }));
        oppdaterRekkefølgeMutation.mutate({ objekter: oppdateringer });

        return neste;
      });
    }
  }

  function handleSlett(id: string) {
    slettMutation.mutate({ id });
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
    <div className="flex h-[calc(100vh-220px)] overflow-hidden rounded-lg border border-gray-200 bg-white">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Venstre — Feltpalett */}
        <FeltPalett />

        {/* Midt — Malsoner */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <div className="mb-2">
            <h3 className="text-lg font-semibold">{mal.name}</h3>
            {mal.description && (
              <p className="text-sm text-gray-500">{mal.description}</p>
            )}
          </div>

          <DropSone
            zone="topptekst"
            label="Topptekst"
            objekter={topptekstObjekter}
            valgtId={valgtId}
            onVelg={setValgtId}
            onSlett={handleSlett}
          />

          <DropSone
            zone="datafelter"
            label="Datafelter"
            objekter={datafeltObjekter}
            valgtId={valgtId}
            onVelg={setValgtId}
            onSlett={handleSlett}
          />
        </div>

        {/* Drag overlay */}
        <DragOverlayKomponent aktivt={aktivtDrag} />
      </DndContext>

      {/* Høyre — Konfigurasjon */}
      {valgtObjekt ? (
        <FeltKonfigurasjon
          objekt={valgtObjekt}
          onLagre={handleLagreKonfig}
          erLagrer={oppdaterObjektMutation.isPending}
        />
      ) : (
        <aside className="flex w-72 shrink-0 items-center justify-center border-l border-gray-200 bg-gray-50 p-4">
          <p className="text-center text-sm text-gray-400">
            Velg et felt for å redigere konfigurasjon
          </p>
        </aside>
      )}
    </div>
  );
}
