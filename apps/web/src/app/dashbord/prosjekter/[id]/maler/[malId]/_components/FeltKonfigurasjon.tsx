"use client";

import { useState, useEffect } from "react";
import { REPORT_OBJECT_TYPE_META, type ReportObjectType } from "@siteflow/shared";
import { Input, Button } from "@siteflow/ui";
import type { MalObjekt } from "./DraggbartFelt";

interface FeltKonfigurasjonProps {
  objekt: MalObjekt;
  onLagre: (data: { label: string; required: boolean; config: Record<string, unknown> }) => void;
  erLagrer: boolean;
}

export function FeltKonfigurasjon({ objekt, onLagre, erLagrer }: FeltKonfigurasjonProps) {
  const [label, setLabel] = useState(objekt.label);
  const [påkrevd, setPåkrevd] = useState(objekt.required);
  const [config, setConfig] = useState(objekt.config);

  const meta = REPORT_OBJECT_TYPE_META[objekt.type as ReportObjectType];

  // Synkroniser når valgt objekt endrer seg
  useEffect(() => {
    setLabel(objekt.label);
    setPåkrevd(objekt.required);
    setConfig(objekt.config);
  }, [objekt.id, objekt.label, objekt.required, objekt.config]);

  function handleLagre() {
    onLagre({ label, required: påkrevd, config });
  }

  const harEndringer =
    label !== objekt.label ||
    påkrevd !== objekt.required ||
    JSON.stringify(config) !== JSON.stringify(objekt.config);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Konfigurasjon
      </h3>
      <p className="mb-4 text-xs text-gray-400">{meta?.label ?? objekt.type}</p>

      <div className="flex flex-col gap-4">
        <Input
          label="Etikett"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={påkrevd}
            onChange={(e) => setPåkrevd(e.target.checked)}
            className="rounded border-gray-300"
          />
          Påkrevd felt
        </label>

        {/* Typespesifikk konfigurasjon */}
        {(objekt.type === "list_single" || objekt.type === "list_multi") && (
          <ValglisteKonfig
            options={(config.options as string[]) ?? []}
            onChange={(options) => setConfig({ ...config, options })}
          />
        )}

        {objekt.type === "text_field" && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={(config.multiline as boolean) ?? false}
              onChange={(e) =>
                setConfig({ ...config, multiline: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            Flerlinjet
          </label>
        )}

        {(objekt.type === "integer" || objekt.type === "decimal") && (
          <div className="flex flex-col gap-2">
            <Input
              label="Enhet"
              placeholder="f.eks. kg, m², °C"
              value={(config.unit as string) ?? ""}
              onChange={(e) => setConfig({ ...config, unit: e.target.value })}
            />
          </div>
        )}

        {(objekt.type === "person" || objekt.type === "persons" || objekt.type === "company") && (
          <Input
            label="Rolle"
            placeholder="f.eks. Kontrollør, Prosjektleder"
            value={(config.role as string) ?? ""}
            onChange={(e) => setConfig({ ...config, role: e.target.value })}
          />
        )}

        {objekt.type === "attachments" && (
          <Input
            label="Maks antall filer"
            type="number"
            min={1}
            value={(config.maxFiles as number) ?? 10}
            onChange={(e) =>
              setConfig({ ...config, maxFiles: parseInt(e.target.value, 10) || 10 })
            }
          />
        )}
      </div>

      <div className="mt-6">
        <Button
          onClick={handleLagre}
          disabled={!harEndringer}
          loading={erLagrer}
          size="sm"
          className="w-full"
        >
          Lagre endringer
        </Button>
      </div>
    </aside>
  );
}

// Underkomponent for valgliste-konfigurasjon
function ValglisteKonfig({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  const [nytt, setNytt] = useState("");

  function leggTil() {
    if (!nytt.trim()) return;
    onChange([...options, nytt.trim()]);
    setNytt("");
  }

  function fjern(indeks: number) {
    onChange(options.filter((_, i) => i !== indeks));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700">Valgalternativer</p>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex-1 truncate rounded border border-gray-200 bg-white px-2 py-1 text-sm">
            {opt}
          </span>
          <button
            type="button"
            onClick={() => fjern(i)}
            className="text-gray-400 hover:text-red-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          placeholder="Nytt alternativ..."
          value={nytt}
          onChange={(e) => setNytt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              leggTil();
            }
          }}
          className="flex-1"
        />
        <Button type="button" size="sm" variant="secondary" onClick={leggTil}>
          +
        </Button>
      </div>
    </div>
  );
}
