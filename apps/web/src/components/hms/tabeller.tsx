// Delte HMS-tabell-komponenter med valgfri Prosjekt/Byggeplass-kolonne.

import { useTranslation } from "react-i18next";
import { EmptyState, StatusBadge } from "@sitedoc/ui";
import { formaterDato, formaterLopenummer, hentDataVerdi } from "./visning";
import type { DokumentRad } from "./types";

type TabellProps = {
  rader: DokumentRad[];
  onKlikk: (rad: DokumentRad) => void;
  visProsjektKolonne?: boolean;
  visByggeplassKolonne?: boolean;
  onHurtigBehandle?: (rad: DokumentRad) => void;
};

function byggeplassNavnAvvik(r: DokumentRad): string {
  return r.drawing?.byggeplass?.name ?? "—";
}
function byggeplassNavnSjekkliste(r: DokumentRad): string {
  return r.byggeplass?.name ?? "—";
}

export function AvvikTabell({
  rader,
  onKlikk,
  visProsjektKolonne = false,
  visByggeplassKolonne = false,
  onHurtigBehandle,
}: TabellProps) {
  const { t } = useTranslation();
  if (rader.length === 0) {
    return (
      <EmptyState title={t("hms.tom.avvik")} description={t("hms.tom.avvikBeskrivelse")} />
    );
  }
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("tabell.nr")}</th>
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("tabell.tittel")}</th>
          {visProsjektKolonne && (
            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("firma.hms.kolonne.prosjekt")}</th>
          )}
          {visByggeplassKolonne && (
            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("firma.hms.kolonne.byggeplass")}</th>
          )}
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("hms.kolonne.alvorlighet")}</th>
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("tabell.status")}</th>
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("tabell.tidsfrist")}</th>
          {onHurtigBehandle && <th className="w-24 px-3 py-2" />}
        </tr>
      </thead>
      <tbody>
        {rader.map((r) => (
          <tr
            key={r.id}
            onClick={() => onKlikk(r)}
            className="cursor-pointer hover:bg-gray-50 border-t border-gray-100"
          >
            <td className="px-3 py-2 text-sm text-gray-700">
              {r.template.prefix ? `${r.template.prefix}-${formaterLopenummer(r)}` : formaterLopenummer(r)}
            </td>
            <td className="px-3 py-2 text-sm text-gray-900">{r.title}</td>
            {visProsjektKolonne && (
              <td className="px-3 py-2 text-sm text-gray-700">{r.template.project?.name ?? "—"}</td>
            )}
            {visByggeplassKolonne && (
              <td className="px-3 py-2 text-sm text-gray-700">{byggeplassNavnAvvik(r)}</td>
            )}
            <td className="px-3 py-2 text-sm text-gray-700">
              {hentDataVerdi(r, (l) => l.toLowerCase().includes("alvorlig"))}
            </td>
            <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
            <td className="px-3 py-2 text-sm text-gray-700">{formaterDato(r.dueDate ?? null)}</td>
            {onHurtigBehandle && (
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onHurtigBehandle(r);
                  }}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  {t("firma.hms.hurtig.knapp")}
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SjaTabell({
  rader,
  onKlikk,
  visProsjektKolonne = false,
  visByggeplassKolonne = false,
}: TabellProps) {
  const { t } = useTranslation();
  if (rader.length === 0) {
    return <EmptyState title={t("hms.tom.sja")} description={t("hms.tom.sjaBeskrivelse")} />;
  }
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("tabell.nr")}</th>
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("tabell.tittel")}</th>
          {visProsjektKolonne && (
            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("firma.hms.kolonne.prosjekt")}</th>
          )}
          {visByggeplassKolonne && (
            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("firma.hms.kolonne.byggeplass")}</th>
          )}
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("tabell.dato")}</th>
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("hms.kolonne.arbeidsleder")}</th>
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("tabell.status")}</th>
        </tr>
      </thead>
      <tbody>
        {rader.map((r) => (
          <tr
            key={r.id}
            onClick={() => onKlikk(r)}
            className="cursor-pointer hover:bg-gray-50 border-t border-gray-100"
          >
            <td className="px-3 py-2 text-sm text-gray-700">
              {r.template.prefix ? `${r.template.prefix}-${formaterLopenummer(r)}` : formaterLopenummer(r)}
            </td>
            <td className="px-3 py-2 text-sm text-gray-900">{r.title}</td>
            {visProsjektKolonne && (
              <td className="px-3 py-2 text-sm text-gray-700">{r.template.project?.name ?? "—"}</td>
            )}
            {visByggeplassKolonne && (
              <td className="px-3 py-2 text-sm text-gray-700">{byggeplassNavnSjekkliste(r)}</td>
            )}
            <td className="px-3 py-2 text-sm text-gray-700">
              {hentDataVerdi(r, (l) => l.toLowerCase() === "dato")}
            </td>
            <td className="px-3 py-2 text-sm text-gray-700">
              {hentDataVerdi(r, (l) => l.toLowerCase().includes("arbeidsleder"))}
            </td>
            <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RuhTabell({
  rader,
  onKlikk,
  visProsjektKolonne = false,
  visByggeplassKolonne = false,
}: TabellProps) {
  const { t } = useTranslation();
  if (rader.length === 0) {
    return <EmptyState title={t("hms.tom.ruh")} description={t("hms.tom.ruhBeskrivelse")} />;
  }
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("tabell.nr")}</th>
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("hms.kolonne.typeObservasjon")}</th>
          {visProsjektKolonne && (
            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("firma.hms.kolonne.prosjekt")}</th>
          )}
          {visByggeplassKolonne && (
            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("firma.hms.kolonne.byggeplass")}</th>
          )}
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("hms.kolonne.innmelder")}</th>
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("tabell.opprettelsesdato")}</th>
          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("tabell.status")}</th>
        </tr>
      </thead>
      <tbody>
        {rader.map((r) => (
          <tr
            key={r.id}
            onClick={() => onKlikk(r)}
            className="cursor-pointer hover:bg-gray-50 border-t border-gray-100"
          >
            <td className="px-3 py-2 text-sm text-gray-700">
              {r.template.prefix ? `${r.template.prefix}-${formaterLopenummer(r)}` : formaterLopenummer(r)}
            </td>
            <td className="px-3 py-2 text-sm text-gray-700">
              {hentDataVerdi(r, (l) => l.toLowerCase().includes("type"))}
            </td>
            {visProsjektKolonne && (
              <td className="px-3 py-2 text-sm text-gray-700">{r.template.project?.name ?? "—"}</td>
            )}
            {visByggeplassKolonne && (
              <td className="px-3 py-2 text-sm text-gray-700">{byggeplassNavnSjekkliste(r)}</td>
            )}
            <td className="px-3 py-2 text-sm text-gray-700">
              {hentDataVerdi(r, (l) => l.toLowerCase().includes("innmelder"))}
            </td>
            <td className="px-3 py-2 text-sm text-gray-700">{formaterDato(r.createdAt)}</td>
            <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
