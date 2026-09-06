"use client";

import { useState, useEffect, Fragment } from "react";
import {
  REPORT_OBJECT_TYPE_META,
  type ReportObjectType,
  normaliserGrense,
  lesKravType,
  løsGrense,
  normaliserOpsjon,
  type KravType,
  type Grense,
  type GrenseVariant,
} from "@sitedoc/shared";
import { harMeningsfullLabel } from "@sitedoc/pdf";
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
          <GrenseKonfig
            objekt={objekt}
            alleObjekter={alleObjekter}
            config={config}
            setConfig={setConfig}
          />
        )}

        {(objekt.type === "person" || objekt.type === "persons" || objekt.type === "company") && (
          <div className="flex flex-col gap-2">
            <Input
              label={t("malbygger.rolle")}
              placeholder={t("malbygger.rollePlaceholder")}
              value={(config.role as string) ?? ""}
              onChange={(e) => setConfig({ ...config, role: e.target.value })}
            />
            {objekt.type === "persons" && (
              <Input
                label={t("malbygger.maksAntallPersoner")}
                type="number"
                min={1}
                placeholder={t("malbygger.ubegrensetPlaceholder")}
                value={(config.max as number) ?? ""}
                onChange={(e) => {
                  const neste = { ...config };
                  const n = parseInt(e.target.value, 10);
                  if (e.target.value.trim() !== "" && Number.isFinite(n) && n > 0) {
                    neste.max = n;
                  } else {
                    delete neste.max;
                  }
                  setConfig(neste);
                }}
              />
            )}
          </div>
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
                  <Badge variant="default">
                    {harMeningsfullLabel(forelderLabel) ? forelderLabel : t("malbygger.utenNavn")}
                  </Badge>
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

// Hvilke tallfelter hver kravtype bruker (2 for «mellom», 1 ellers). Styrer både
// hvilke input som vises og variantkolonnene. Grenseresolver-ordre trinn 2.
const KRAVTYPE_FELTER: Record<KravType, ("min" | "maks" | "toleranse")[]> = {
  minst: ["min"],
  hoyst: ["maks"],
  mellom: ["min", "maks"],
  toleranse: ["toleranse"],
};

// Tallfelt-etikett per kravtype (klarspråk, matcher mockup): Minst/Høyst/±, «Fra»+«og» for mellom.
function kravFeltNokkel(kravType: KravType, k: "min" | "maks" | "toleranse"): string {
  if (kravType === "mellom") return k === "min" ? "malbygger.kravFeltFra" : "malbygger.kravFeltOg";
  if (kravType === "minst") return "malbygger.kravFeltMinst";
  if (kravType === "hoyst") return "malbygger.kravFeltHoyst";
  return "malbygger.kravFeltToleranse";
}

// Grense-konfigurasjon for integer/decimal: enhet + desimaler (felt-nivå), kravtype
// i klarspråk (aldri symboler), live kvitteringslinje, og Vei B — betinget grense per
// styrende enkeltvalg. Mockup «MalBygger Grensevarianter Mockup» er visuell fasit;
// bygget mot de ti tekstlige designlås-punktene (spredt: hoved-notat + tillegg-klarspråk
// + tillegg2-kravtype). Panelbredde w-72.
function GrenseKonfig({
  objekt,
  alleObjekter,
  config,
  setConfig,
}: {
  objekt: MalObjekt;
  alleObjekter: MalObjekt[];
  config: Record<string, unknown>;
  setConfig: (c: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const grense = normaliserGrense(config);
  const kravType = lesKravType(config); // eksplisitt vinner, ellers utledet (ingen backfill)

  const felt = (k: "min" | "maks" | "toleranse"): number | null => grense[k];

  function settEnhet(v: string) {
    const neste = { ...config };
    delete neste.unit;
    if (v) neste.enhet = v;
    else delete neste.enhet;
    setConfig(neste);
  }

  function settDesimaler(raw: string) {
    const neste = { ...config };
    delete neste.decimals;
    if (raw.trim() === "") delete neste.desimaler;
    else {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) neste.desimaler = n;
    }
    setConfig(neste);
  }

  function settKravType(ny: KravType | "ingen") {
    const neste = { ...config };
    delete neste.max; // rydd engelsk alias
    if (ny === "ingen") {
      // «Ingen krav» skjuler begge bryterne (punkt 10) → fjern krav + variant-konfig
      for (const k of ["kravType", "min", "maks", "toleranse", "styrendeFeltId", "grenseVarianter"]) {
        delete neste[k];
      }
      setConfig(neste);
      return;
    }
    neste.kravType = ny;
    // Behold kun tallene den nye kravtypen bruker (bytter mellom→høyst dropper min)
    const beholder = KRAVTYPE_FELTER[ny];
    for (const k of ["min", "maks", "toleranse"] as const) {
      if (!beholder.includes(k)) delete neste[k];
    }
    setConfig(neste);
  }

  function settTall(k: "min" | "maks" | "toleranse", raw: string) {
    const neste = { ...config };
    if (k === "maks") delete neste.max;
    if (raw.trim() === "") delete neste[k];
    else {
      const n = parseFloat(raw.replace(",", "."));
      if (Number.isFinite(n)) neste[k] = n;
    }
    setConfig(neste);
  }

  // Kvitteringslinje (panel A): samme tekst forfatteren ser som konsekvens av valget.
  const krav = kravType ? formaterGrenseKrav(grense, kravType) : "";
  let kvitteringTekst: string | null = null;
  if (kravType === "minst" && grense.min !== null) kvitteringTekst = t("malbygger.kvitteringMinst", { krav, verdi: grense.min });
  else if (kravType === "hoyst" && grense.maks !== null) kvitteringTekst = t("malbygger.kvitteringHoyst", { krav, verdi: grense.maks });
  else if (kravType === "mellom" && grense.min !== null && grense.maks !== null) kvitteringTekst = t("malbygger.kvitteringMellom", { krav });
  else if (kravType === "toleranse" && grense.toleranse !== null) kvitteringTekst = t("malbygger.kvitteringToleranse", { krav, verdi: grense.toleranse });

  // Varsel: «mellom» med bare én verdi (dekket av tillegg2 § 1, ikke de ti hoved-punktene).
  const mellomMangler = kravType === "mellom" && (grense.min === null) !== (grense.maks === null);

  // Styrende-felt-kandidater: list_single i samme kontekst (samme forelder) med lavere sortOrder
  const kandidater = alleObjekter.filter(
    (o) => o.type === "list_single" && o.parentId === objekt.parentId && o.sortOrder < objekt.sortOrder,
  );
  const styrendeFeltId = typeof config.styrendeFeltId === "string" ? config.styrendeFeltId : null;
  const betingetPå = styrendeFeltId !== null;
  const varianter: GrenseVariant[] = Array.isArray(config.grenseVarianter)
    ? (config.grenseVarianter as GrenseVariant[])
    : [];

  function toggleBetinget(på: boolean) {
    const neste = { ...config };
    if (på && kandidater[0]) neste.styrendeFeltId = kandidater[0].id;
    else {
      delete neste.styrendeFeltId;
      delete neste.grenseVarianter;
    }
    setConfig(neste);
  }

  // Bytte styrende felt beholder grenseVarianter → gamle overstyringer vises som foreldreløse
  // (amber, med Fjern) i stedet for stille sletting.
  function settStyrende(id: string) {
    setConfig({ ...config, styrendeFeltId: id });
  }

  const styrendeFelt = alleObjekter.find((o) => o.id === styrendeFeltId);
  const opsjoner = ((styrendeFelt?.config.options as unknown[]) ?? []).map(normaliserOpsjon);
  const opsjonVerdier = new Set(opsjoner.map((o) => o.value));
  const foreldrelose = varianter.filter((v) => !opsjonVerdier.has(normaliserOpsjon(v.valg).value));

  function settVariantCelle(opsjonValue: string, k: "min" | "maks" | "toleranse", raw: string) {
    const neste = [...varianter];
    let idx = neste.findIndex((v) => normaliserOpsjon(v.valg).value === opsjonValue);
    if (idx === -1) {
      neste.push({ valg: opsjonValue });
      idx = neste.length - 1;
    }
    const rad: GrenseVariant = { ...neste[idx]! };
    if (raw.trim() === "") delete rad[k];
    else {
      const n = parseFloat(raw.replace(",", "."));
      if (Number.isFinite(n)) rad[k] = n;
    }
    // Ren rad uten overstyringer fjernes (arver standard uansett)
    if (rad.min === undefined && rad.maks === undefined && rad.toleranse === undefined) {
      neste.splice(idx, 1);
    } else {
      neste[idx] = rad;
    }
    setConfig({ ...config, grenseVarianter: neste });
  }

  function fjernForeldrelos(mål: GrenseVariant) {
    setConfig({ ...config, grenseVarianter: varianter.filter((v) => v !== mål) });
  }

  const kolonner = kravType ? KRAVTYPE_FELTER[kravType] : [];

  // Vei B-kvittering (mockup, bunn av panel B): per overstyrt valg + «ellers standard».
  // Bruker den delte resolveren (trinn 1) så kvitteringen er samme grensen utfylling løser.
  const veiBDeler = kravType
    ? opsjoner
        .filter((o) => varianter.some((v) => normaliserOpsjon(v.valg).value === o.value))
        .map((o) => `${o.label}: ${formaterGrenseKrav(løsGrense({ config }, o.value), kravType)}`)
    : [];
  const veiBKvittering = kravType && krav ? [...veiBDeler, t("malbygger.veiBEllers", { krav })].join(" · ") : "";

  const enhetInput = (
    <Input
      label={t("malbygger.enhet")}
      placeholder={t("malbygger.enhetPlaceholder")}
      value={grense.enhet}
      onChange={(ev) => settEnhet(ev.target.value)}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Kravtype i klarspråk — aldri symboler */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">{t("malbygger.kravTypeLabel")}</label>
        <select
          value={kravType ?? "ingen"}
          onChange={(ev) => settKravType(ev.target.value as KravType | "ingen")}
          className="rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="ingen">{t("malbygger.kravIngen")}</option>
          <option value="minst">{t("malbygger.kravMinst")}</option>
          <option value="hoyst">{t("malbygger.kravHoyst")}</option>
          <option value="mellom">{t("malbygger.kravMellom")}</option>
          <option value="toleranse">{t("malbygger.kravToleranse")}</option>
        </select>
      </div>

      {/* Tallene kravtypen trenger + enhet på samme rad (mockup). «Ingen krav» skjuler raden. */}
      {kravType ? (
        <div className="flex items-end gap-2">
          {kolonner.map((k) => (
            <Input
              key={k}
              className="flex-1"
              label={t(kravFeltNokkel(kravType, k))}
              type="number"
              placeholder={t("malbygger.grensePlaceholder")}
              value={felt(k) ?? ""}
              onChange={(ev) => settTall(k, ev.target.value)}
            />
          ))}
          <div className="w-[72px] shrink-0">{enhetInput}</div>
        </div>
      ) : (
        // Avvik fra mockup (meldt): mockupen nester enhet i «har krav» og skjuler den ved
        // «Ingen krav». Enhet beholdes her så et måltall uten krav ikke mister enheten sin.
        enhetInput
      )}

      {/* Live kvitteringslinje (panel A) — hvit boks som mockup. Vei B har egen linje nederst. */}
      {kravType && kvitteringTekst && !betingetPå && (
        <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] leading-relaxed text-gray-500">
          {kvitteringTekst}
        </div>
      )}
      {mellomMangler && (
        <p className="text-[11px] font-medium text-amber-600">{t("malbygger.mellomMangler")}</p>
      )}

      {/* Desimaler (kun decimal) — felt-nivå, alltid synlig (mockup: egen rad) */}
      {objekt.type === "decimal" && (
        <div className="w-20">
          <Input
            label={t("malbygger.desimaler")}
            type="number"
            min={0}
            max={6}
            value={grense.desimaler ?? ""}
            onChange={(ev) => settDesimaler(ev.target.value)}
          />
        </div>
      )}

      {/* Vei B — betinget grense per styrende enkeltvalg. Vises kun når det finnes et krav. */}
      {kravType && (
        <div className="mt-1 flex flex-col gap-2 border-t border-gray-200 pt-3">
          <label
            className={`flex items-start gap-2 text-sm ${kandidater.length === 0 ? "text-gray-400" : "text-gray-700"}`}
          >
            <input
              type="checkbox"
              checked={betingetPå}
              disabled={kandidater.length === 0}
              onChange={(ev) => toggleBetinget(ev.target.checked)}
              className="mt-0.5 rounded border-gray-300"
            />
            <span className="flex flex-col">
              <span className={betingetPå ? "font-semibold" : ""}>{t("malbygger.betingetGrense")}</span>
              {kandidater.length === 0 && (
                <span className="text-[10px] text-gray-400">{t("malbygger.betingetGrenseHjelp")}</span>
              )}
            </span>
          </label>

          {betingetPå && (
            <div className="flex flex-col gap-2">
              {/* Styrende felt */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-600">{t("malbygger.styrendeFelt")}</label>
                <select
                  value={styrendeFeltId ?? ""}
                  onChange={(ev) => settStyrende(ev.target.value)}
                  className="rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  {kandidater.map((k) => (
                    <option key={k.id} value={k.id}>
                      {harMeningsfullLabel(k.label) ? k.label : t("malbygger.utenNavn")}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-gray-400">{t("malbygger.betingetGrenseHjelp")}</span>
              </div>

              {/* Intro (vedtak 3): lærer bort modellen FØR utfylling — lys blå infoboks */}
              <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] leading-relaxed text-gray-600">
                {krav
                  ? t("malbygger.variantIntro", { krav })
                  : t("malbygger.variantIntroUtenKrav")}
              </div>

              {/* Varianttabell (grid): én rad per opsjon. Satt vs. arvet skilles på FORM. */}
              <div
                className="grid items-center gap-x-2 gap-y-1.5 rounded border border-gray-200 bg-white p-2"
                style={{ gridTemplateColumns: `1fr ${kolonner.map(() => "84px").join(" ")}` }}
              >
                <span className="text-[11px] font-semibold text-gray-500">{t("malbygger.variantValg")}</span>
                {kolonner.map((k) => (
                  <span key={k} className="text-[11px] font-semibold text-gray-500">
                    {t(kravFeltNokkel(kravType, k))}
                    {grense.enhet ? ` (${grense.enhet})` : ""}
                  </span>
                ))}
                {opsjoner.map((o) => {
                  const v = varianter.find((x) => normaliserOpsjon(x.valg).value === o.value);
                  return (
                    <Fragment key={o.value}>
                      <span className="truncate text-[13px] text-gray-900" title={o.label}>{o.label}</span>
                      {kolonner.map((k) => {
                        const satt = v != null && v[k] !== undefined && v[k] !== null;
                        return (
                          // ✕ ligger som søsken ETTER input → input remountes ikke når
                          // «arvet» blir «satt», og fokus bevares mens man skriver.
                          <span
                            key={k}
                            className={`flex items-center gap-1 rounded border bg-white px-2 py-1 ${
                              satt ? "border-sitedoc-primary" : "border-dashed border-gray-300"
                            }`}
                          >
                            <input
                              type="number"
                              inputMode="decimal"
                              value={satt ? String(v![k]) : ""}
                              placeholder={variantArvetPlaceholder(felt(k), kravType)}
                              onChange={(ev) => settVariantCelle(o.value, k, ev.target.value)}
                              className={`w-full min-w-0 bg-transparent text-[13px] focus:outline-none ${
                                satt
                                  ? "font-semibold text-gray-900"
                                  : "italic text-gray-400 placeholder:italic placeholder:text-gray-400"
                              }`}
                            />
                            {satt && (
                              <button
                                type="button"
                                onClick={() => settVariantCelle(o.value, k, "")}
                                title={t("malbygger.variantFjernOverstyring")}
                                className="shrink-0 text-gray-400 hover:text-gray-600"
                              >
                                ✕
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </div>

              {/* «Ellers (standard)» (vedtak 2): tekstlinje under tabellen, ikke en rad */}
              <div className="px-0.5 text-[11px] leading-relaxed text-gray-500">
                {krav
                  ? t("malbygger.variantStandardlinje", { krav })
                  : t("malbygger.variantStandardlinjeUtenKrav")}
              </div>

              {/* Foreldreløse varianter — aldri stille sletting */}
              {foreldrelose.map((v, i) => (
                <div
                  key={`fl-${i}`}
                  className="flex items-center justify-between gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[12px] text-amber-700"
                >
                  <span className="truncate">
                    {t("malbygger.variantForeldrelos", {
                      valg: normaliserOpsjon(v.valg).value,
                      felt: harMeningsfullLabel(styrendeFelt?.label) ? styrendeFelt!.label : t("malbygger.utenNavn"),
                    })}
                    {" · "}
                    {foreldrelosTall(v, kravType)}
                  </span>
                  <button
                    type="button"
                    onClick={() => fjernForeldrelos(v)}
                    className="shrink-0 font-bold hover:text-amber-900"
                  >
                    {t("malbygger.variantFjern")}
                  </button>
                </div>
              ))}

              {/* Vei B-kvittering: per valg + ellers */}
              {veiBKvittering && (
                <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] leading-relaxed text-gray-500">
                  {veiBKvittering}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-400">{t("malbygger.grenseHjelp")}</p>
    </div>
  );
}

// «Vises som»-krav i kvitteringslinja: symbolformen (kompakt visningsform), bygget av
// tallene kravtypen bruker. Forfatteren skriver aldri symbolet selv.
function formaterGrenseKrav(grense: Grense, kravType: KravType): string {
  const e = grense.enhet ? ` ${grense.enhet}` : "";
  if (kravType === "minst" && grense.min !== null) return `≥ ${grense.min}${e}`;
  if (kravType === "hoyst" && grense.maks !== null) return `≤ ${grense.maks}${e}`;
  if (kravType === "mellom" && grense.min !== null && grense.maks !== null) return `${grense.min}–${grense.maks}${e}`;
  if (kravType === "toleranse" && grense.toleranse !== null) return `± ${grense.toleranse}${e}`;
  return "";
}

// Placeholder for en arvet (ikke overstyrt) variantcelle: standardens symbolform for
// kolonnens kravtype, uten enhet (enheten står i kolonneoverskriften). «≤ 10» for høyst,
// «≥»/«±» for minst/toleranse; bare tall for «mellom» (Fra/og — symbol gir ikke mening).
// «—» når feltet ikke har noe standardtall å arve.
function variantArvetPlaceholder(standardVerdi: number | null, kravType: KravType): string {
  if (standardVerdi === null) return "—";
  if (kravType === "minst") return `≥ ${standardVerdi}`;
  if (kravType === "hoyst") return `≤ ${standardVerdi}`;
  if (kravType === "toleranse") return `± ${standardVerdi}`;
  return String(standardVerdi);
}

// Kompakt tallvisning for en foreldreløs variant (de tallene den overstyrer).
function foreldrelosTall(v: GrenseVariant, kravType: KravType): string {
  const deler = KRAVTYPE_FELTER[kravType]
    .map((k) => (v[k] !== undefined && v[k] !== null && v[k] !== "" ? String(v[k]) : null))
    .filter((x): x is string => x !== null);
  return deler.length > 0 ? deler.join("–") : "—";
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
