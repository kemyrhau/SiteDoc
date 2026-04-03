"use client";

import { useState, useEffect } from "react";
import { REPORT_OBJECT_TYPE_META, type ReportObjectType } from "@sitedoc/shared";
import { Input, Button, Badge } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import type { MalObjekt } from "./DraggbartFelt";

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

interface FeltKonfigurasjonProps {
  objekt: MalObjekt;
  alleObjekter: MalObjekt[];
  onLagre: (data: { label: string; required: boolean; config: Record<string, unknown> }) => void;
  erLagrer: boolean;
  onFjernBetingelse?: (parentId: string) => void;
  onFjernBarnFraKontainer?: (barnId: string) => void;
  psiModus?: boolean;
}

export function FeltKonfigurasjon({
  objekt,
  alleObjekter,
  onLagre,
  erLagrer,
  onFjernBetingelse,
  onFjernBarnFraKontainer,
  psiModus,
}: FeltKonfigurasjonProps) {
  const { t } = useTranslation();
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

  const erBarn = objekt.parentId != null;
  const harAktivBetingelse = objekt.config.conditionActive === true;

  // Finn foreldrefeltets label for barnefelt
  const forelderLabel = erBarn
    ? alleObjekter.find((o) => o.id === objekt.parentId)?.label ?? "Ukjent"
    : null;

  // Tell barnefelt for foreldrefelt (direkte barn)
  const antallBarn = harAktivBetingelse
    ? alleObjekter.filter((o) => o.parentId === objekt.id).length
    : 0;

  return (
    <aside className={`flex h-full shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-gray-50 p-4 ${psiModus ? "w-[480px]" : "w-72"}`}>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {t("malbygger.konfigurasjon")}
      </h3>
      <p className="mb-4 text-xs text-gray-400">{meta?.label ?? objekt.type}</p>

      <div className="flex flex-col gap-4">
        <Input
          label={t("malbygger.etikett")}
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
          {t("malbygger.paakrevdFelt")}
        </label>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">{t("malbygger.hjelpetekst")}</label>
          <textarea
            placeholder={t("malbygger.hjelpetekstPlaceholder")}
            value={(config.helpText as string) ?? ""}
            onChange={(e) => {
              const verdi = e.target.value;
              if (verdi) {
                setConfig({ ...config, helpText: verdi });
              } else {
                const { helpText: _, ...resten } = config;
                setConfig(resten);
              }
            }}
            rows={2}
            className="rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Typespesifikk konfigurasjon */}
        {(objekt.type === "list_single" || objekt.type === "list_multi") && (
          <ValglisteKonfig
            options={((config.options as unknown[]) ?? []).map(opsjonTilStreng)}
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
            {t("malbygger.flerlinjet")}
          </label>
        )}

        {(objekt.type === "integer" || objekt.type === "decimal") && (
          <div className="flex flex-col gap-2">
            <Input
              label={t("malbygger.enhet")}
              placeholder={t("malbygger.enhetPlaceholder")}
              value={(config.unit as string) ?? ""}
              onChange={(e) => setConfig({ ...config, unit: e.target.value })}
            />
          </div>
        )}

        {(objekt.type === "person" || objekt.type === "persons" || objekt.type === "company") && (
          <Input
            label={t("malbygger.rolle")}
            placeholder={t("malbygger.rollePlaceholder")}
            value={(config.role as string) ?? ""}
            onChange={(e) => setConfig({ ...config, role: e.target.value })}
          />
        )}

        {objekt.type === "attachments" && (
          <Input
            label={t("malbygger.maksAntallFiler")}
            type="number"
            min={1}
            value={(config.maxFiles as number) ?? 10}
            onChange={(e) =>
              setConfig({ ...config, maxFiles: parseInt(e.target.value, 10) || 10 })
            }
          />
        )}

        {objekt.type === "drawing_position" && (
          <div className="flex flex-col gap-2">
            <Input
              label={t("malbygger.bygningsfilter")}
              placeholder={t("malbygger.bygningsfilterPlaceholder")}
              value={(config.buildingFilter as string) ?? ""}
              onChange={(e) =>
                setConfig({ ...config, buildingFilter: e.target.value || null })
              }
            />
            <Input
              label={t("malbygger.fagdisiplinfilter")}
              placeholder={t("malbygger.fagdisiplinfilterPlaceholder")}
              value={(config.disciplineFilter as string) ?? ""}
              onChange={(e) =>
                setConfig({ ...config, disciplineFilter: e.target.value || null })
              }
            />
          </div>
        )}

        {/* Lesetekst (info_text) */}
        {objekt.type === "info_text" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">{t("malbygger.innholdLabel")}</label>
            <p className="mb-1.5 text-[10px] text-gray-400">{t("malbygger.innholdHjelp")}</p>
            <textarea
              value={(config.content as string) ?? ""}
              onChange={(e) => setConfig({ ...config, content: e.target.value })}
              rows={15}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed"
              placeholder={t("malbygger.innholdPlaceholder")}
            />
          </div>
        )}

        {/* Bilde med tekst (info_image) */}
        {objekt.type === "info_image" && (
          <div className="flex flex-col gap-2">
            {/* Bildeopplasting */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">{t("malbygger.bilde")}</label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const fil = e.target.files?.[0];
                  if (!fil) return;
                  const formData = new FormData();
                  formData.append("file", fil);
                  try {
                    const resp = await fetch("/api/upload", { method: "POST", body: formData });
                    const data = await resp.json() as { fileUrl: string };
                    setConfig({ ...config, imageUrl: data.fileUrl });
                  } catch (_err) {
                    /* ignorer */
                  }
                }}
                className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-sitedoc-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
              />
              {(config.imageUrl as string) && (
                <img
                  src={(config.imageUrl as string).startsWith("http") ? (config.imageUrl as string) : `/api${config.imageUrl as string}`}
                  alt={t("malbygger.forhandsvisning")}
                  className="mt-2 max-h-40 rounded-lg border border-gray-200 object-contain"
                />
              )}
            </div>
            <Input
              label={t("malbygger.ellerLimInnUrl")}
              placeholder="/uploads/... https://..."
              value={(config.imageUrl as string) ?? ""}
              onChange={(e) => setConfig({ ...config, imageUrl: e.target.value })}
            />
            <Input
              label={t("malbygger.bildetekst")}
              placeholder={t("malbygger.bildetekstPlaceholder")}
              value={(config.caption as string) ?? ""}
              onChange={(e) => setConfig({ ...config, caption: e.target.value })}
            />
          </div>
        )}

        {/* Video */}
        {objekt.type === "video" && (
          <div>
            <Input
              label={t("malbygger.videoUrl")}
              placeholder="https://... /uploads/..."
              value={(config.url as string) ?? ""}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
            />
            <p className="mt-1 text-[10px] text-gray-400">{t("malbygger.videoHjelp")}</p>
          </div>
        )}

        {/* Quiz-spørsmål */}
        {objekt.type === "quiz" && (
          <div className="flex flex-col gap-3">
            <Input
              label={t("malbygger.spoersmaal")}
              value={(config.question as string) ?? ""}
              onChange={(e) => setConfig({ ...config, question: e.target.value })}
              placeholder={t("malbygger.spoersmaalPlaceholder")}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">{t("malbygger.alternativer")}</label>
              {((config.options as string[]) ?? []).map((alt, i) => (
                <div key={i} className="mb-1.5 flex items-center gap-2">
                  <input
                    type="radio"
                    name={`quiz-riktig-${objekt.id}`}
                    checked={(config.correctIndex as number) === i}
                    onChange={() => setConfig({ ...config, correctIndex: i })}
                    title={t("malbygger.markerRiktigSvar")}
                  />
                  <input
                    type="text"
                    value={alt}
                    onChange={(e) => {
                      const nyeOpts = [...((config.options as string[]) ?? [])];
                      nyeOpts[i] = e.target.value;
                      setConfig({ ...config, options: nyeOpts });
                    }}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    placeholder={`Alternativ ${i + 1}`}
                  />
                  {((config.options as string[]) ?? []).length > 2 && (
                    <button
                      onClick={() => {
                        const nyeOpts = ((config.options as string[]) ?? []).filter((_, j) => j !== i);
                        const nyRiktig = (config.correctIndex as number) >= i ? Math.max(0, (config.correctIndex as number) - 1) : (config.correctIndex as number);
                        setConfig({ ...config, options: nyeOpts, correctIndex: nyRiktig });
                      }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setConfig({ ...config, options: [...((config.options as string[]) ?? []), ""] })}
                className="mt-1 text-xs text-sitedoc-primary hover:underline"
              >
                {t("malbygger.leggTilAlternativ")}
              </button>
            </div>
            <p className="text-xs text-gray-400">{t("malbygger.markerRiktigHjelp")}</p>
          </div>
        )}

        {/* Betingelse-seksjon */}
        {(erBarn || harAktivBetingelse) && (
          <div className="mt-2 border-t border-gray-200 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {t("malbygger.betingelse")}
            </p>

            {erBarn && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{t("malbygger.tilhoerer")}</span>
                  <Badge variant="default">{forelderLabel}</Badge>
                </div>
                {onFjernBarnFraKontainer && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onFjernBarnFraKontainer(objekt.id)}
                    className="w-full"
                  >
                    {t("malbygger.fjernFraBetingelse")}
                  </Button>
                )}
              </div>
            )}

            {harAktivBetingelse && (
              <div className="flex flex-col gap-2">
                <div className="text-sm text-gray-600">
                  <span>{t("malbygger.utloserverdier")} </span>
                  <span className="flex flex-wrap gap-1 mt-1">
                    {((objekt.config.conditionValues as unknown[]) ?? []).map((v) => {
                      const label = opsjonTilStreng(v);
                      return <Badge key={label} variant="primary">{label}</Badge>;
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Betingede felter: {antallBarn}
                </p>
                {onFjernBetingelse && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onFjernBetingelse(objekt.id)}
                    className="w-full"
                  >
                    {t("malbygger.fjernBetingelse")}
                  </Button>
                )}
              </div>
            )}
          </div>
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
          {t("prosjektoppsett.lagreEndringer")}
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
  const { t } = useTranslation();
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
      <p className="text-sm font-medium text-gray-700">{t("malbygger.valgalternativer")}</p>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={opt}
            onChange={(e) => {
              const oppdatert = [...options];
              oppdatert[i] = e.target.value;
              onChange(oppdatert);
            }}
            className="flex-1 truncate rounded border border-gray-200 bg-white px-2 py-1 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
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
