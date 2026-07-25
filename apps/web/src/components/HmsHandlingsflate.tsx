"use client";

// Dedikert HMS-handlingsflate (Ordre B, D2). HMS er et selvstendig løp ved
// siden av dokumentflyten — denne flaten erstatter den generelle
// statusmaskinen (DokumentHandlingsmeny) for dokumenter med domain="hms".
//
// Handlingene speiler server-guarden verifiserHmsHandling (Ordre A):
//   Tilføy informasjon  — oppretter,  Sendt · Besvart  (obligatorisk tekst)
//   Besvar              — HMS-admin,  Sendt · Besvart  (obligatorisk begrunnelse)
//   Lukk                — HMS-admin,  Besvart          (valgfri kommentar)
//   Gjenåpne            — HMS-admin,  Lukket           (valgfri kommentar)
//
// Klienten avgjør synlighet; serveren håndhever autorisasjonen på nytt. Tomt
// obligatorisk felt blokkeres her (speiler min(1) på serveren) slik at brukeren
// ikke får en unødvendig serverrunde.

import { useState } from "react";
import { useTranslation } from "react-i18next";

export type HmsHandlingType = "tilfoyInformasjon" | "besvar" | "lukk" | "gjenapne";

interface HmsHandlingDef {
  type: HmsHandlingType;
  labelKey: string;
  placeholderKey: string;
  /** Obligatorisk tekst (kan ikke sende tomt) — speiler server min(1). */
  obligatorisk: boolean;
  /** Primærknapp (utfylt farge) vs. sekundær (kantlinje). */
  primaer: boolean;
}

const HANDLINGER: Record<HmsHandlingType, HmsHandlingDef> = {
  tilfoyInformasjon: {
    type: "tilfoyInformasjon",
    labelKey: "hms.handling.tilfoyInformasjon",
    placeholderKey: "hms.handling.tilfoyPlaceholder",
    obligatorisk: true,
    primaer: false,
  },
  besvar: {
    type: "besvar",
    labelKey: "hms.handling.besvar",
    placeholderKey: "hms.handling.begrunnelsePlaceholder",
    obligatorisk: true,
    primaer: true,
  },
  lukk: {
    type: "lukk",
    labelKey: "hms.handling.lukk",
    placeholderKey: "statushandling.valgfriKommentar",
    obligatorisk: false,
    primaer: true,
  },
  gjenapne: {
    type: "gjenapne",
    labelKey: "hms.handling.gjenapne",
    placeholderKey: "statushandling.valgfriKommentar",
    obligatorisk: false,
    primaer: false,
  },
};

interface HmsHandlingsflateProps {
  status: string;
  /** Innlogget bruker er oppretter (bestillerUserId === innlogget). */
  erOppretter: boolean;
  /** Innlogget bruker er HMS-admin (fra server-queryen hms.erHmsAdmin). */
  erHmsAdmin: boolean;
  erLaster: boolean;
  feilmelding?: string | null;
  onUtfor: (type: HmsHandlingType, tekst: string | undefined) => void;
}

/** Hvilke handlinger er tilgjengelige gitt tilstand × rolle (D2). */
function tilgjengeligeHandlinger(
  status: string,
  erOppretter: boolean,
  erHmsAdmin: boolean,
): HmsHandlingType[] {
  const liste: HmsHandlingType[] = [];
  if (erOppretter && (status === "sent" || status === "responded")) {
    liste.push("tilfoyInformasjon");
  }
  if (erHmsAdmin && (status === "sent" || status === "responded")) {
    liste.push("besvar");
  }
  if (erHmsAdmin && status === "responded") liste.push("lukk");
  if (erHmsAdmin && status === "closed") liste.push("gjenapne");
  return liste;
}

export function HmsHandlingsflate({
  status,
  erOppretter,
  erHmsAdmin,
  erLaster,
  feilmelding,
  onUtfor,
}: HmsHandlingsflateProps) {
  const { t } = useTranslation();
  const [aktiv, setAktiv] = useState<HmsHandlingType | null>(null);
  const [tekst, setTekst] = useState("");

  const handlinger = tilgjengeligeHandlinger(status, erOppretter, erHmsAdmin);

  const lukkPanel = () => {
    setAktiv(null);
    setTekst("");
  };

  const send = (def: HmsHandlingDef) => {
    const trimmet = tekst.trim();
    if (def.obligatorisk && !trimmet) return;
    onUtfor(def.type, trimmet || undefined);
    lukkPanel();
  };

  if (handlinger.length === 0) {
    // Ingen handlinger for denne rollen/tilstanden (f.eks. lukket sett fra
    // oppretter, eller leser uten rolle) — ren lesevisning.
    return <span className="text-xs italic text-gray-400">{t("bunnbar.lesevisning")}</span>;
  }

  const aktivDef = aktiv ? HANDLINGER[aktiv] : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {feilmelding && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {feilmelding}
        </div>
      )}

      {/* Aktivt inntastingspanel */}
      {aktivDef ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-gray-500">{t(aktivDef.labelKey)}</label>
          <textarea
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            placeholder={t(aktivDef.placeholderKey)}
            rows={3}
            autoFocus
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => send(aktivDef)}
              disabled={erLaster || (aktivDef.obligatorisk && !tekst.trim())}
              className="rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {erLaster ? t("statushandling.endrer") : t(aktivDef.labelKey)}
            </button>
            <button
              onClick={lukkPanel}
              disabled={erLaster}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("handling.avbryt")}
            </button>
          </div>
        </div>
      ) : (
        /* Handlingsknapper */
        <div className="flex flex-wrap items-center gap-2">
          {handlinger.map((type) => {
            const def = HANDLINGER[type];
            return (
              <button
                key={type}
                onClick={() => {
                  setTekst("");
                  setAktiv(type);
                }}
                disabled={erLaster}
                className={
                  def.primaer
                    ? "rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    : "rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                }
              >
                {t(def.labelKey)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
