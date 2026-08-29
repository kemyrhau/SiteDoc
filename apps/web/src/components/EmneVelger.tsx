"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tag, X, Plus } from "lucide-react";

/**
 * Emne (subject) på detaljsiden — chip + Endre, med to tilstander som LokasjonVelger
 * (FASTE FELT Del A#3, mockup 1c). Passiv: «+ Legg til emne». Aktivert: emne-chip +
 * Endre/Fjern. Redigering er nedtrekk-med-fritekst: `<input list>` + `<datalist>` av malens
 * `subjects`-forslag — aldri obligatorisk, fritekst alltid tillatt (effektivitets-gaten).
 * Skjules av kalleren når malens `showSubject=false`. Låst dokument (approved/closed) →
 * `leseModus` (server-vakten i sjekkliste.oppdater er sannheten).
 */
export function EmneVelger({
  emne,
  forslag,
  leseModus,
  onLagre,
}: {
  emne: string | null;
  forslag: string[];
  leseModus?: boolean;
  onLagre: (emne: string | null) => void;
}) {
  const { t } = useTranslation();
  const datalistId = useId();
  const [redigerer, setRedigerer] = useState(false);
  const [utkast, setUtkast] = useState("");

  function start() {
    setUtkast(emne ?? "");
    setRedigerer(true);
  }

  function lagre() {
    const rent = utkast.trim();
    onLagre(rent === "" ? null : rent);
    setRedigerer(false);
  }

  const innhold = byggInnhold();
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
        {t("emneVelger.etikett")}
      </div>
      {innhold}
    </div>
  );

  function byggInnhold() {
  if (redigerer) {
    return (
      <div className="flex items-center gap-2">
        <input
          list={datalistId}
          value={utkast}
          onChange={(e) => setUtkast(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") lagre();
            if (e.key === "Escape") setRedigerer(false);
          }}
          autoFocus
          placeholder={t("emneVelger.plassholder")}
          className="w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <datalist id={datalistId}>
          {forslag.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <button
          onClick={lagre}
          className="rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90"
        >
          {t("handling.lagre")}
        </button>
        <button
          onClick={() => setRedigerer(false)}
          className="rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
        >
          {t("handling.avbryt")}
        </button>
      </div>
    );
  }

  if (emne) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
          <Tag className="h-3.5 w-3.5" />
          {emne}
        </span>
        {!leseModus && (
          <>
            <button
              onClick={start}
              className="rounded px-2 py-1 text-xs font-medium text-sitedoc-secondary hover:bg-gray-100"
            >
              {t("handling.endre")}
            </button>
            <button
              onClick={() => onLagre(null)}
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              title={t("emneVelger.fjern")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    );
  }

  if (leseModus) {
    return <div className="text-sm italic text-gray-400">{t("emneVelger.ingenEmne")}</div>;
  }

  return (
    <button
      onClick={start}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-sitedoc-secondary hover:bg-gray-50"
    >
      <Plus className="h-4 w-4" />
      {t("emneVelger.leggTil")}
    </button>
  );
  }
}
