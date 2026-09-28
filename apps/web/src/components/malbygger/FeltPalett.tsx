"use client";

import {
  REPORT_OBJECT_TYPES,
  REPORT_OBJECT_TYPE_META,
  type ReportObjectCategory,
} from "@sitedoc/shared";
import { PalettElement } from "./PalettElement";
import { useTranslation } from "react-i18next";

const kategoriLabelKeys: Record<ReportObjectCategory, string> = {
  tekst: "malbygger.tekst",
  valg: "malbygger.valg",
  tall: "malbygger.tall",
  dato: "malbygger.dato",
  person: "malbygger.person",
  fil: "malbygger.filer",
  spesial: "malbygger.spesialfelt",
  instruksjon: "malbygger.instruksjon",
};

const kategoriRekkefølge: ReportObjectCategory[] = [
  "tekst",
  "valg",
  "tall",
  "dato",
  "person",
  "fil",
  "spesial",
  "instruksjon",
];

// PSI-modus: kun innholdsrelevante typer
const PSI_TYPER = new Set(["heading", "subtitle", "info_text", "info_image", "video", "quiz", "signature"]);

// Skjult fra paletten — område/rom håndteres via kontrollplan, ikke som felt i malen.
// "location" er AVVIKLET 2026-09-02 (begrepsrydding): ut av paletten så ingen NYE opprettes,
// men den forblir en gyldig type for legacy-objekter (se REPORT_OBJECT_TYPE_META-kommentar).
const SKJULTE_TYPER = new Set(["zone_property", "room_property", "location"]);

// Felttyper som ikke lenger TILBYS for en gitt maltype (`category` er bryteren). En repeater
// er en liste av N ting, mens en oppgave er ÉN ting med felles status (domene-arbeidsflyt.md
// § Repeater hører ikke hjemme i en oppgave). Vi fjerner tilbudet, ikke dataene: en
// eksisterende oppgave-repeater rendres og fungerer som før. Sjekkliste/HMS urørt.
const SKJULT_PER_KATEGORI: Record<string, ReadonlySet<string>> = {
  oppgave: new Set(["repeater"]),
};

// §8: paletten tilbyr TO trafikklys — tre lys og fire lys. Begge oppretter `type: "traffic_light"`
// og skiller seg bare i `config.options` de sås med (palett-valg, ikke typevalg). Firelys-settet er
// META-defaulten uendret; treesettet er DEN SAMME lista minus `gray` — utledet, ikke en egen
// hardkodet liste (bruk-er-ikke-behov.md). Etikettene beholdes så de gjenkjennes → i18n ved rendring.
const trafikklysFireOptions = REPORT_OBJECT_TYPE_META.traffic_light.defaultConfig.options as { value: string }[];
const trafikklysTreOptions = trafikklysFireOptions.filter((o) => o.value !== "gray");
const TRAFIKKLYS_VARIANTER = [
  { dragId: "palett-traffic_light-3", labelKey: "malbygger.trafikklys3", seedConfig: { options: trafikklysTreOptions } },
  { dragId: "palett-traffic_light-4", labelKey: "malbygger.trafikklys4", seedConfig: { options: trafikklysFireOptions } },
];

export function FeltPalett({ psiModus, category }: { psiModus?: boolean; category?: string }) {
  const { t } = useTranslation();
  const skjultForKategori = category ? SKJULT_PER_KATEGORI[category] : undefined;
  const gruppert = kategoriRekkefølge
    .map((kategori) => ({
      kategori,
      label: t(kategoriLabelKeys[kategori]),
      typer: REPORT_OBJECT_TYPES.filter((type) => {
        if (SKJULTE_TYPER.has(type)) return false;
        if (skjultForKategori?.has(type)) return false;
        if (psiModus && !PSI_TYPER.has(type)) return false;
        return REPORT_OBJECT_TYPE_META[type].category === kategori;
      }),
    }))
    .filter((g) => g.typer.length > 0);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-gray-50 p-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {psiModus ? t("malbygger.innhold") : t("malbygger.felttyper")}
      </h3>
      <div className="flex flex-col gap-3">
        {gruppert.map(({ kategori, label, typer }) => (
          <div key={kategori}>
            <p className="mb-1.5 text-xs font-medium text-gray-400">{label}</p>
            <div className="flex flex-col gap-1.5">
              {typer.flatMap((type) =>
                type === "traffic_light"
                  ? TRAFIKKLYS_VARIANTER.map((variant) => (
                      <PalettElement
                        key={variant.dragId}
                        type="traffic_light"
                        meta={REPORT_OBJECT_TYPE_META.traffic_light}
                        variant={variant}
                      />
                    ))
                  : [
                      <PalettElement
                        key={type}
                        type={type}
                        meta={REPORT_OBJECT_TYPE_META[type]}
                      />,
                    ],
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
