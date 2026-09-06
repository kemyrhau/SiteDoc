"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { TemplateZone } from "@sitedoc/shared";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

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
            <p className="py-8 text-center text-lg font-semibold text-gray-200 select-none">
              {t("malbygger.draDrop")}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 pb-8">
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
  const { t } = useTranslation();
  const malObjekt = treObjekt as MalObjekt;
  const harAktivBetingelse = malObjekt.config.conditionActive === true;
  const erRepeater = malObjekt.type === "repeater";
  const erUtenforKrav = malObjekt.config.conditionType === "utenfor_krav";
  const harBarn = harAktivBetingelse || erRepeater;
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
      {/* Betingelsebjelke / repeater-bjelke + barnegruppe */}
      {harBarn && (
        <div className={`mt-1.5 ml-6 rounded-lg border-l-2 pb-2 pl-3 ${
          erRepeater
            ? "border-green-400 bg-green-50/30"
            : erUtenforKrav
              ? "border-amber-400 bg-amber-50/30"
              : "border-blue-400 bg-blue-50/30"
        }`}>
          {/* Utenfor-krav-utløser (tallfelt, trinn 3 del C): statisk bjelke — ingen verdiliste,
              retningen er tilstand. Vises i stedet for verdi-chip-bjelken. */}
          {harAktivBetingelse && !erRepeater && malObjekt.config.conditionType === "utenfor_krav" && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2">
              <span className="flex items-center gap-1.5 text-sm text-amber-700">
                <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
                </svg>
                {t("malbygger.avviksfeltBjelke")}
              </span>
              <button
                type="button"
                onClick={() => onFjernBetingelse(malObjekt.id)}
                className="shrink-0 rounded p-1 text-amber-400 hover:bg-amber-100 hover:text-amber-600"
                title={t("malbygger.fjernBetingelse")}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          {/* BetingelseBjelke (verdi-match) kun for list-kontainere */}
          {harAktivBetingelse && !erRepeater && malObjekt.config.conditionType !== "utenfor_krav" && (
            <BetingelseBjelke
              parentObjekt={malObjekt}
              aktiveVerdier={(malObjekt.config.conditionValues as string[]) ?? []}
              onEndreVerdier={(verdier) =>
                onOppdaterBetingelseVerdier(malObjekt.id, verdier)
              }
              onFjern={() => onFjernBetingelse(malObjekt.id)}
            />
          )}
          {erRepeater && (
            <p className="mb-1.5 mt-1 text-xs font-medium text-green-600">
              Felter som gjentas i hver rad:
            </p>
          )}

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
          <div className={`mt-1.5 rounded-lg border border-dashed px-3 py-3 text-center text-xs ${
            erRepeater
              ? "border-green-300 text-green-400"
              : "border-blue-300 text-blue-400"
          }`}>
            {erRepeater
              ? t("malbygger.draDropRepeater")
              : t("malbygger.draDrop")}
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
