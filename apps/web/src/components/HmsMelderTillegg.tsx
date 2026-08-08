"use client";

// HMS «Tillegg fra melder» (Spor 2 / 5b). Vises på HMS-detaljen for melderen etter at
// saken er sendt. To deler, samme prinsipp — melder eier innholdet:
//   • Synlig feltlås: forklarer HVORFOR meldingens felt er låst (append-only-modellen
//     gjøres synlig, ikke skjult knappeadferd). Vises kun mens feltene faktisk er låst
//     (sendt, ballen hos behandler).
//   • Tidsstemplet tillegg-logg: melderens rene append-transfers (fromStatus === toStatus),
//     med «+ Tilføy informasjon»-inngang. Ingen andre enn melder rører innholdet.
//
// Sporet (revidert-og-sendt-tilbake) ligger i den generelle DokumentTidslinje via
// status-transfers; denne seksjonen viser KUN melderens tillegg. Delt av oppgave- og
// sjekkliste-detaljen.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";

interface Overforing {
  id: string;
  fromStatus: string;
  toStatus: string;
  comment: string | null;
  createdAt: string;
  sender?: { id: string; name: string | null } | null;
}

interface HmsMelderTilleggProps {
  overforinger: Overforing[];
  bestillerUserId: string | null | undefined;
  /** Feltene er låst (sendt, ballen hos behandler) → vis feltlås-forklaringen. */
  feltlaast: boolean;
  /** Kan tilføye (åpen tilstand — sent/received/responded). */
  kanTilfoye: boolean;
  laster: boolean;
  onTilfoy: (tekst: string) => void;
}

function formaterDatoTid(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HmsMelderTillegg({
  overforinger,
  bestillerUserId,
  feltlaast,
  kanTilfoye,
  laster,
  onTilfoy,
}: HmsMelderTilleggProps) {
  const { t } = useTranslation();
  const [aktiv, setAktiv] = useState(false);
  const [tekst, setTekst] = useState("");

  // Melderens rene tillegg = append-transfers (ingen statusendring) fra melderen selv.
  const tillegg = overforinger
    .filter((o) => o.fromStatus === o.toStatus && o.sender?.id === bestillerUserId && o.comment)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Sendt-tidspunkt for feltlås-forklaringen = første send (draft → received/sent).
  const sendtDato = overforinger.find(
    (o) => o.fromStatus === "draft" && (o.toStatus === "received" || o.toStatus === "sent"),
  )?.createdAt;

  const send = () => {
    const trimmet = tekst.trim();
    if (!trimmet) return;
    onTilfoy(trimmet);
    setTekst("");
    setAktiv(false);
  };

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
      {feltlaast && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <p className="text-xs leading-relaxed text-gray-600">
            {sendtDato
              ? t("hms.feltlaas.forklaring", {
                  dato: new Date(sendtDato).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit" }),
                })
              : t("hms.feltlaas.forklaringUtenDato")}
          </p>
        </div>
      )}

      <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
        {t("hms.tillegg.tittel")}
      </h3>

      <div className="mt-2 flex flex-col gap-2.5">
        {tillegg.length === 0 && (
          <p className="text-xs italic text-gray-400">{t("hms.tillegg.tomt")}</p>
        )}
        {tillegg.map((entry) => (
          <div key={entry.id} className="border-l-2 border-gray-200 pl-2.5">
            <p className="text-[11px] text-gray-400">
              {formaterDatoTid(entry.createdAt)} · {entry.sender?.name ?? "—"}
            </p>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{entry.comment}</p>
          </div>
        ))}
      </div>

      {kanTilfoye && (
        <div className="mt-3">
          {aktiv ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={tekst}
                onChange={(e) => setTekst(e.target.value)}
                placeholder={t("hms.handling.tilfoyPlaceholder")}
                rows={3}
                autoFocus
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={send}
                  disabled={laster || !tekst.trim()}
                  className="rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {t("hms.tillegg.tilfoy")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAktiv(false);
                    setTekst("");
                  }}
                  disabled={laster}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  {t("handling.avbryt")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAktiv(true)}
              className="rounded-lg border border-dashed border-blue-200 px-3 py-1.5 text-sm font-medium text-sitedoc-primary hover:bg-blue-50"
            >
              + {t("hms.tillegg.tilfoy")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
