"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Select } from "@sitedoc/ui";
import { DRAWING_TYPES } from "@sitedoc/shared";
import { Loader2, RefreshCw, Check, AlertTriangle, Eye } from "lucide-react";
import {
  byggTegningRadEndring,
  type SerieFilStatus,
  type TegningRadEndring,
  type TegningRadFelt,
} from "@/lib/tegningSerieOpplasting";
import { LastOppRevisjonKnapp } from "./LastOppRevisjonKnapp";

export interface SerieRad {
  tempId: string;
  fileName: string;
  drawingId: string | null;
  status: SerieFilStatus;
  feil?: string;
  /** R3-forslag (klient-side, ikke skrevet på raden ennå). */
  forslag?: { drawingNumber: string | null; drawingType: string | null };
}

export interface LiveTegning {
  id: string;
  name: string;
  drawingNumber: string | null;
  discipline: string | null;
  drawingType: string | null;
  floor: string | null;
  scale: string | null;
  revision: string | null;
  conversionStatus?: string | null;
}

const TOM_FELT: TegningRadFelt = {
  name: "",
  drawingNumber: "",
  discipline: "",
  drawingType: "",
  floor: "",
  scale: "",
};

/** Startverdier for en rad: lagret tegning + R3-forslag (nummer/type) som ikke er lagret. */
function initFelt(live: LiveTegning | undefined, forslag: SerieRad["forslag"]): TegningRadFelt {
  return {
    name: live?.name ?? "",
    drawingNumber: live?.drawingNumber ?? forslag?.drawingNumber ?? "",
    discipline: live?.discipline ?? "",
    drawingType: live?.drawingType ?? forslag?.drawingType ?? "",
    floor: live?.floor ?? "",
    scale: live?.scale ?? "",
  };
}

/**
 * R4: etterfyllings-tabell for serieopplastede tegninger. Én rad pr. fil med navn,
 * nummer, type, revisjon, etasje, målestokk (valgfritt), status og «Prøv igjen».
 * R3-forslag vises merket «foreslått» til brukeren lagrer. Lagring pr. rad sender
 * KUN endrede felt (`byggTegningRadEndring`) via `tegning.oppdater`. Gjenbrukes fra
 * tegningslista som «Rediger flere» (samme komponent, samme mutasjon).
 *
 * T1b: `onVis` (valgfri) gir en «Vis»-knapp pr. rad — åpner tegningen i den
 * omsluttende sidens egen forhåndsvisning. Tabellen forblir montert (ingen
 * navigasjon), så ulagrede radendringer bevares når brukeren kommer tilbake.
 */
export function TegningSerieTabell({
  rader,
  liveTegninger,
  onLagreRad,
  lagrerId,
  onPrøvIgjen,
  onRevisjonFerdig,
  onVis,
}: {
  rader: SerieRad[];
  liveTegninger: Record<string, LiveTegning>;
  onLagreRad: (endring: TegningRadEndring) => void;
  lagrerId: string | null;
  onPrøvIgjen: (tempId: string) => void;
  onRevisjonFerdig: () => void;
  onVis?: (drawingId: string) => void;
}) {
  const { t } = useTranslation();
  const [felt, setFelt] = useState<Record<string, TegningRadFelt>>({});

  // Initialiser rad-felt når en rad får drawingId (etter opprett). Overskriver ikke
  // ubekreftede endringer på rader som alt er initialisert.
  useEffect(() => {
    setFelt((forrige) => {
      const neste = { ...forrige };
      for (const rad of rader) {
        if (!(rad.tempId in neste)) {
          const live = rad.drawingId ? liveTegninger[rad.drawingId] : undefined;
          neste[rad.tempId] = rad.drawingId ? initFelt(live, rad.forslag) : { ...TOM_FELT };
        }
      }
      return neste;
    });
  }, [rader, liveTegninger]);

  const settFelt = (tempId: string, key: keyof TegningRadFelt, verdi: string) =>
    setFelt((f) => ({ ...f, [tempId]: { ...(f[tempId] ?? TOM_FELT), [key]: verdi } }));

  function lagre(rad: SerieRad) {
    if (!rad.drawingId) return;
    const live = liveTegninger[rad.drawingId];
    const redigert = felt[rad.tempId] ?? TOM_FELT;
    onLagreRad(
      byggTegningRadEndring(
        rad.drawingId,
        {
          name: live?.name ?? "",
          drawingNumber: live?.drawingNumber ?? "",
          discipline: live?.discipline ?? "",
          drawingType: live?.drawingType ?? "",
          floor: live?.floor ?? "",
          scale: live?.scale ?? "",
        },
        redigert,
      ),
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-2 py-2">{t("tegninger.serie.kolFil")}</th>
            <th className="px-2 py-2">{t("tegninger.feltNavn")}</th>
            <th className="px-2 py-2">{t("tegninger.feltTegningsnummer")}</th>
            <th className="px-2 py-2">{t("tegninger.feltTegningstype")}</th>
            <th className="px-2 py-2">{t("tegninger.feltEtasje")}</th>
            <th className="px-2 py-2">{t("tegninger.serie.kolMålestokk")}</th>
            <th className="px-2 py-2">{t("tegninger.serie.kolRevisjon")}</th>
            <th className="px-2 py-2">{t("tegninger.serie.kolStatus")}</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {rader.map((rad) => {
            const f = felt[rad.tempId] ?? TOM_FELT;
            const live = rad.drawingId ? liveTegninger[rad.drawingId] : undefined;
            const klar = rad.status === "klar" || rad.status === "konverterer";
            const nummerForeslått =
              !!rad.forslag?.drawingNumber &&
              f.drawingNumber === rad.forslag.drawingNumber &&
              !live?.drawingNumber;
            const typeForeslått =
              !!rad.forslag?.drawingType &&
              f.drawingType === rad.forslag.drawingType &&
              !live?.drawingType;
            return (
              <tr key={rad.tempId} className="border-b border-gray-100 align-top">
                <td className="max-w-[160px] truncate px-2 py-2 text-gray-600" title={rad.fileName}>
                  {rad.fileName}
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={f.name}
                    onChange={(e) => settFelt(rad.tempId, "name", e.target.value)}
                    disabled={!klar}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={f.drawingNumber}
                    onChange={(e) => settFelt(rad.tempId, "drawingNumber", e.target.value)}
                    disabled={!klar}
                  />
                  {nummerForeslått && (
                    <span className="mt-0.5 block text-[10px] font-medium text-amber-600">
                      {t("tegninger.serie.foreslått")}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <Select
                    value={f.drawingType}
                    onChange={(e) => settFelt(rad.tempId, "drawingType", e.target.value)}
                    placeholder={t("tegninger.velgType")}
                    disabled={!klar}
                    options={DRAWING_TYPES.map((type) => ({
                      value: type,
                      label: type.charAt(0).toUpperCase() + type.slice(1),
                    }))}
                  />
                  {typeForeslått && (
                    <span className="mt-0.5 block text-[10px] font-medium text-amber-600">
                      {t("tegninger.serie.foreslått")}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={f.floor}
                    onChange={(e) => settFelt(rad.tempId, "floor", e.target.value)}
                    disabled={!klar}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={f.scale}
                    onChange={(e) => settFelt(rad.tempId, "scale", e.target.value)}
                    disabled={!klar}
                  />
                </td>
                <td className="px-2 py-2 text-gray-600">{live?.revision ?? "–"}</td>
                <td className="px-2 py-2">
                  <StatusMerke status={rad.status} />
                </td>
                <td className="px-2 py-2">
                  {rad.status === "feilet" ? (
                    <div className="flex flex-col items-start gap-1">
                      {rad.feil && <span className="text-xs text-sitedoc-error">{rad.feil}</span>}
                      <Button size="sm" variant="secondary" onClick={() => onPrøvIgjen(rad.tempId)}>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        {t("tegninger.serie.prøvIgjen")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-1.5">
                      {onVis && rad.drawingId && klar && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onVis(rad.drawingId!)}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          {t("handling.vis")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => lagre(rad)}
                        disabled={!klar || lagrerId === rad.drawingId}
                      >
                        {lagrerId === rad.drawingId
                          ? t("handling.lagrer")
                          : t("handling.lagre")}
                      </Button>
                      {rad.drawingId && (
                        <LastOppRevisjonKnapp
                          drawingId={rad.drawingId}
                          gjeldendeRevisjon={live?.revision}
                          variant="ghost"
                          onFerdig={onRevisjonFerdig}
                        />
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusMerke({ status }: { status: SerieFilStatus }) {
  const { t } = useTranslation();
  if (status === "laster")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("tegninger.serie.statusLaster")}
      </span>
    );
  if (status === "konverterer")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("tegninger.serie.statusKonverterer")}
      </span>
    );
  if (status === "feilet")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-sitedoc-error">
        <AlertTriangle className="h-3.5 w-3.5" />
        {t("tegninger.serie.statusFeilet")}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600">
      <Check className="h-3.5 w-3.5" />
      {t("tegninger.serie.statusKlar")}
    </span>
  );
}
