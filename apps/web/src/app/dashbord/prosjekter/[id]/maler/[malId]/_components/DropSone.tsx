"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { TemplateZone } from "@siteflow/shared";
import { DraggbartFelt, type MalObjekt } from "./DraggbartFelt";

interface DropSoneProps {
  zone: TemplateZone;
  label: string;
  objekter: MalObjekt[];
  valgtId: string | null;
  onVelg: (id: string) => void;
  onSlett: (id: string) => void;
}

export function DropSone({
  zone,
  label,
  objekter,
  valgtId,
  onVelg,
  onSlett,
}: DropSoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `sone-${zone}`,
    data: { zone },
  });

  const ider = objekter.map((o) => o.id);

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </h4>
      <SortableContext items={ider} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`min-h-[80px] rounded-lg border-2 border-dashed p-3 transition-colors ${
            isOver
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 bg-gray-50/50"
          }`}
        >
          {objekter.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Dra felter hit
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {objekter.map((objekt) => (
                <DraggbartFelt
                  key={objekt.id}
                  objekt={objekt}
                  erValgt={valgtId === objekt.id}
                  onClick={() => onVelg(objekt.id)}
                  onSlett={() => onSlett(objekt.id)}
                />
              ))}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
