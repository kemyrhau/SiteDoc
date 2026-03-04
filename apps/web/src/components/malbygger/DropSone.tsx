"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { TemplateZone } from "@siteflow/shared";
import { DraggbartFelt, type MalObjekt } from "./DraggbartFelt";
import { BetingelseBjelke } from "./BetingelseBjelke";
import type { TreObjekt } from "./typer";

interface DropSoneProps {
  zone: TemplateZone;
  label: string;
  treObjekter: TreObjekt[];
  alleObjekter: MalObjekt[];
  valgtId: string | null;
  onVelg: (id: string) => void;
  onSlett: (id: string) => void;
  onTilfoyjBetingelse: (parentId: string) => void;
  onOppdaterBetingelseVerdier: (parentId: string, verdier: string[]) => void;
  onFjernBetingelse: (parentId: string) => void;
  onFjernBarnFraKontainer: (barnId: string) => void;
}

export function DropSone({
  zone,
  label,
  treObjekter,
  alleObjekter,
  valgtId,
  onVelg,
  onSlett,
  onTilfoyjBetingelse,
  onOppdaterBetingelseVerdier,
  onFjernBetingelse,
  onFjernBarnFraKontainer,
}: DropSoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `sone-${zone}`,
    data: { zone },
  });

  // Samle alle ID-er (flat) for SortableContext
  const alleIder = samleIder(treObjekter);

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </h4>
      <SortableContext items={alleIder} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`min-h-[80px] rounded-lg border-2 border-dashed p-2 transition-colors ${
            isOver
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 bg-gray-50/50"
          }`}
        >
          {treObjekter.length === 0 ? (
            <p className="py-6 text-center text-sm font-medium text-gray-300">
              Dropp her
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {treObjekter.map((treObj) => (
                <RekursivtFelt
                  key={treObj.id}
                  treObjekt={treObj}
                  nestingNivå={0}
                  valgtId={valgtId}
                  alleObjekter={alleObjekter}
                  onVelg={onVelg}
                  onSlett={onSlett}
                  onTilfoyjBetingelse={onTilfoyjBetingelse}
                  onOppdaterBetingelseVerdier={onOppdaterBetingelseVerdier}
                  onFjernBetingelse={onFjernBetingelse}
                  onFjernBarnFraKontainer={onFjernBarnFraKontainer}
                />
              ))}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Rekursiv rendering av felt med barn
interface RekursivtFeltProps {
  treObjekt: TreObjekt;
  nestingNivå: number;
  valgtId: string | null;
  alleObjekter: MalObjekt[];
  onVelg: (id: string) => void;
  onSlett: (id: string) => void;
  onTilfoyjBetingelse: (parentId: string) => void;
  onOppdaterBetingelseVerdier: (parentId: string, verdier: string[]) => void;
  onFjernBetingelse: (parentId: string) => void;
  onFjernBarnFraKontainer: (barnId: string) => void;
}

function RekursivtFelt({
  treObjekt,
  nestingNivå,
  valgtId,
  alleObjekter,
  onVelg,
  onSlett,
  onTilfoyjBetingelse,
  onOppdaterBetingelseVerdier,
  onFjernBetingelse,
  onFjernBarnFraKontainer,
}: RekursivtFeltProps) {
  const malObjekt = treObjekt as MalObjekt;
  const harAktivBetingelse = malObjekt.config.conditionActive === true;
  const barn = treObjekt.children;

  return (
    <DraggbartFelt
      objekt={malObjekt}
      erValgt={valgtId === malObjekt.id}
      nestingNivå={nestingNivå}
      onClick={() => onVelg(malObjekt.id)}
      onSlett={() => onSlett(malObjekt.id)}
      onTilfoyjBetingelse={() => onTilfoyjBetingelse(malObjekt.id)}
      onFjernBetingelse={() => onFjernBarnFraKontainer(malObjekt.id)}
    >
      {/* Betingelsebjelke + barnegruppe */}
      {harAktivBetingelse && (
        <div className="mt-1.5 ml-6 rounded-lg border-l-2 border-blue-400 bg-blue-50/30 pl-3 pb-2">
          <BetingelseBjelke
            parentObjekt={malObjekt}
            aktiveVerdier={(malObjekt.config.conditionValues as string[]) ?? []}
            onEndreVerdier={(verdier) =>
              onOppdaterBetingelseVerdier(malObjekt.id, verdier)
            }
            onFjern={() => onFjernBetingelse(malObjekt.id)}
          />

          {/* Rekursive barn */}
          <div className="mt-1.5 flex flex-col gap-1.5">
            {barn.map((barnObj) => (
              <RekursivtFelt
                key={barnObj.id}
                treObjekt={barnObj}
                nestingNivå={nestingNivå + 1}
                valgtId={valgtId}
                alleObjekter={alleObjekter}
                onVelg={onVelg}
                onSlett={onSlett}
                onTilfoyjBetingelse={onTilfoyjBetingelse}
                onOppdaterBetingelseVerdier={onOppdaterBetingelseVerdier}
                onFjernBetingelse={onFjernBetingelse}
                onFjernBarnFraKontainer={onFjernBarnFraKontainer}
              />
            ))}
          </div>

          {/* Tom drop-sone for tomme barnegrupper */}
          <div className="mt-1.5 rounded-lg border border-dashed border-blue-300 px-3 py-3 text-center text-xs text-blue-400">
            Dra og slipp felter her
          </div>
        </div>
      )}
    </DraggbartFelt>
  );
}

// Samle alle ID-er fra trestrukturen (flat) for SortableContext
function samleIder(treObjekter: TreObjekt[]): string[] {
  const ider: string[] = [];
  function samle(noder: TreObjekt[]) {
    for (const node of noder) {
      ider.push(node.id);
      samle(node.children);
    }
  }
  samle(treObjekter);
  return ider;
}
