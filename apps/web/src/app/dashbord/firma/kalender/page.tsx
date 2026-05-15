"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal, Select, Spinner } from "@sitedoc/ui";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Pencil,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";

type KalenderType =
  | "helligdag"
  | "fellesferie"
  | "klemdager"
  | "sommertid_start"
  | "sommertid_slutt"
  | "halvdag"
  | "firma_fri";

type KalenderRad = {
  id: string;
  organizationId: string;
  aar: number;
  dato: Date | string;
  type: string;
  navn: string;
  timerOverstyr: number | string | null;
  aktiv: boolean;
  // T.4 (2026-05-16) — periode-overstyring av firma-default arbeidstid.
  standardStartTid: string | null;
  standardSluttTid: string | null;
  pauseMin: number | null;
};

const TYPER: KalenderType[] = [
  "helligdag",
  "fellesferie",
  "klemdager",
  "sommertid_start",
  "sommertid_slutt",
  "halvdag",
  "firma_fri",
];

function badgeKlasse(type: string): string {
  switch (type) {
    case "helligdag":
      return "bg-red-100 text-red-800 border-red-200";
    case "fellesferie":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "klemdager":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "sommertid_start":
    case "sommertid_slutt":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "halvdag":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "firma_fri":
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function tilDateInput(d: Date | string): string {
  const dato = d instanceof Date ? d : new Date(d);
  return dato.toISOString().slice(0, 10);
}

function formaterDag(d: Date | string): string {
  const dato = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(dato);
}

function maanedNavn(maaned: number): string {
  // maaned: 0-indeksert
  const dato = new Date(Date.UTC(2000, maaned, 1));
  return new Intl.DateTimeFormat("nb-NO", { month: "long" }).format(dato);
}

function maanedAvDato(d: Date | string): number {
  const dato = d instanceof Date ? d : new Date(d);
  return dato.getUTCMonth();
}

export default function FirmakalenderSide() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const [aar, setAar] = useState(new Date().getFullYear());
  const [opprettForMaaned, setOpprettForMaaned] = useState<number | null>(null);
  const [redigerRad, setRedigerRad] = useState<KalenderRad | null>(null);

  const { data, isLoading } = trpc.firma.kalender.hentForAar.useQuery(
    { organizationId: orgId!, aar },
    { enabled: !!orgId },
  );

  const importerMutation = trpc.firma.kalender.importerNorskStandard.useMutation({
    onSuccess: (resultat) => {
      utils.firma.kalender.hentForAar.invalidate();
      alert(
        t("firma.kalender.importerSuksess", {
          opprettet: resultat.opprettet,
          oppdatert: resultat.oppdatert,
          hoppetOver: resultat.hoppetOver,
        }),
      );
    },
    onError: (e) => alert(e.message),
  });

  const rader = (data?.rader ?? []) as KalenderRad[];
  const sommertidStatus = data?.sommertidStatus ?? "ingen";

  const raderPerMaaned = useMemo(() => {
    const map = new Map<number, KalenderRad[]>();
    for (let m = 0; m < 12; m++) map.set(m, []);
    for (const rad of rader) {
      const m = maanedAvDato(rad.dato);
      map.get(m)!.push(rad);
    }
    return map;
  }, [rader]);

  if (!orgId) return null;

  const visSommertidVarsel =
    sommertidStatus === "bare_start" || sommertidStatus === "bare_slutt";

  return (
    <div className="mx-auto max-w-5xl">
      {/* Topp: tittel + år-velger + import-knapp */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {t("firma.kalender.tittel")}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t("firma.kalender.beskrivelse")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setAar((a) => a - 1)}
              className="rounded-l-md px-2 py-1.5 text-gray-600 hover:bg-gray-50"
              aria-label={t("firma.kalender.forrigeAar")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[4rem] text-center text-sm font-semibold text-gray-900">
              {aar}
            </span>
            <button
              type="button"
              onClick={() => setAar((a) => a + 1)}
              className="rounded-r-md px-2 py-1.5 text-gray-600 hover:bg-gray-50"
              aria-label={t("firma.kalender.nesteAar")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="secondary"
            onClick={() =>
              importerMutation.mutate({ organizationId: orgId, aar })
            }
            disabled={importerMutation.isPending}
          >
            <Download className="mr-1.5 h-4 w-4" />
            {t("firma.kalender.importerNorskStandard", { aar })}
          </Button>
        </div>
      </div>

      {/* Sommertid-banner */}
      {visSommertidVarsel && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="flex-1 text-sm text-amber-900">
            <p className="font-medium">
              {t("firma.kalender.sommertidAdvarsel.tittel")}
            </p>
            <p className="mt-0.5">
              {sommertidStatus === "bare_start"
                ? t("firma.kalender.sommertidAdvarsel.bareStart")
                : t("firma.kalender.sommertidAdvarsel.bareSlutt")}
            </p>
          </div>
        </div>
      )}

      {/* Måneds-liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 12 }).map((_, m) => {
            const maanedRader = raderPerMaaned.get(m) ?? [];
            return (
              <div
                key={m}
                className="rounded-md border border-gray-200 bg-white"
              >
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                  <h2 className="text-sm font-semibold capitalize text-gray-900">
                    {maanedNavn(m)}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpprettForMaaned(m)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-sitedoc-primary hover:bg-sitedoc-primary/5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("firma.kalender.leggTil")}
                  </button>
                </div>
                {maanedRader.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-gray-400">
                    {t("firma.kalender.ingenIMaaned")}
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {maanedRader.map((rad) => (
                      <li
                        key={rad.id}
                        className="flex items-center gap-3 px-4 py-2"
                      >
                        <span className="w-28 text-xs text-gray-600">
                          {formaterDag(rad.dato)}
                        </span>
                        <span
                          className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badgeKlasse(rad.type)}`}
                        >
                          {t(`firma.kalender.type.${rad.type}`)}
                        </span>
                        <span className="flex-1 text-sm text-gray-900">
                          {rad.navn}
                        </span>
                        {rad.type === "halvdag" && rad.timerOverstyr !== null && (
                          <span className="text-xs text-gray-600">
                            {Number(rad.timerOverstyr)}{" "}
                            {t("firma.kalender.timerKort")}
                          </span>
                        )}
                        {(rad.standardStartTid || rad.standardSluttTid) && (
                          <span
                            className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-600"
                            title={t("firma.kalender.tidsperiodeOverstyrt")}
                          >
                            <Clock className="h-3 w-3" />
                            {rad.standardStartTid ?? "–"}
                            {"–"}
                            {rad.standardSluttTid ?? "–"}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setRedigerRad(rad)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          aria-label={t("handling.rediger")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Opprett-modal */}
      {opprettForMaaned !== null && (
        <RadModal
          modus="opprett"
          orgId={orgId}
          aar={aar}
          maaned={opprettForMaaned}
          onLukk={() => setOpprettForMaaned(null)}
        />
      )}

      {/* Rediger-modal */}
      {redigerRad && (
        <RadModal
          modus="rediger"
          orgId={orgId}
          aar={aar}
          maaned={maanedAvDato(redigerRad.dato)}
          eksisterende={redigerRad}
          onLukk={() => setRedigerRad(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RadModal — opprett eller rediger en kalender-rad                  */
/* ------------------------------------------------------------------ */

function RadModal({
  modus,
  orgId,
  aar,
  maaned,
  eksisterende,
  onLukk,
}: {
  modus: "opprett" | "rediger";
  orgId: string;
  aar: number;
  maaned: number;
  eksisterende?: KalenderRad;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // Default-dato = første dag i valgt måned for opprett-modus
  const defaultDato =
    eksisterende?.dato
      ? tilDateInput(eksisterende.dato)
      : new Date(Date.UTC(aar, maaned, 1)).toISOString().slice(0, 10);

  const [dato, setDato] = useState(defaultDato);
  const [type, setType] = useState<KalenderType>(
    (eksisterende?.type as KalenderType | undefined) ?? "firma_fri",
  );
  const [navn, setNavn] = useState(eksisterende?.navn ?? "");
  const [timerOverstyr, setTimerOverstyr] = useState<string>(
    eksisterende?.timerOverstyr !== null && eksisterende?.timerOverstyr !== undefined
      ? String(eksisterende.timerOverstyr)
      : "",
  );
  // T.4 — periode-overstyringer. Tom streng = null (ikke satt).
  const [standardStartTid, setStandardStartTid] = useState<string>(
    eksisterende?.standardStartTid ?? "",
  );
  const [standardSluttTid, setStandardSluttTid] = useState<string>(
    eksisterende?.standardSluttTid ?? "",
  );
  const [pauseMin, setPauseMin] = useState<string>(
    eksisterende?.pauseMin !== null && eksisterende?.pauseMin !== undefined
      ? String(eksisterende.pauseMin)
      : "",
  );
  const [aktiv, setAktiv] = useState(eksisterende?.aktiv ?? true);
  const [feil, setFeil] = useState<string | null>(null);

  const opprettMutation = trpc.firma.kalender.opprett.useMutation({
    onSuccess: () => {
      utils.firma.kalender.hentForAar.invalidate();
      onLukk();
    },
    onError: (e) => setFeil(e.message),
  });
  const oppdaterMutation = trpc.firma.kalender.oppdater.useMutation({
    onSuccess: () => {
      utils.firma.kalender.hentForAar.invalidate();
      onLukk();
    },
    onError: (e) => setFeil(e.message),
  });
  const slettMutation = trpc.firma.kalender.slett.useMutation({
    onSuccess: () => {
      utils.firma.kalender.hentForAar.invalidate();
      onLukk();
    },
    onError: (e) => setFeil(e.message),
  });

  const visTimerOverstyr = type === "halvdag";
  // T.4 — tidsfelter er kun relevante for sommertid_start/slutt og halvdag.
  // For andre typer skjules feltene (server avviser også verdier på dem).
  const visTidsfelter =
    type === "sommertid_start" ||
    type === "sommertid_slutt" ||
    type === "halvdag";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);

    const tov =
      visTimerOverstyr && timerOverstyr.trim()
        ? Number(timerOverstyr.replace(",", "."))
        : null;
    if (visTimerOverstyr && (tov === null || Number.isNaN(tov))) {
      setFeil(t("firma.kalender.feil.timerOverstyrPaakrevd"));
      return;
    }

    // T.4 — tidsfelter: tom streng → null. Verdier sendes kun hvis tidsfelter
    // er relevant for valgt type; vri på type tilbake til ikke-tidsrelevant
    // forkaster tidligere satte verdier ved å sende null.
    const sst = visTidsfelter && standardStartTid ? standardStartTid : null;
    const sslutt = visTidsfelter && standardSluttTid ? standardSluttTid : null;
    const pm =
      visTidsfelter && pauseMin.trim() ? Number(pauseMin) : null;

    if (visTidsfelter && sst && sslutt && sst >= sslutt) {
      setFeil(t("firma.kalender.feil.tidRekkefolge"));
      return;
    }
    if (pm !== null && (Number.isNaN(pm) || pm < 0 || pm > 480)) {
      setFeil(t("firma.kalender.feil.pauseMinUgyldig"));
      return;
    }

    if (modus === "opprett") {
      opprettMutation.mutate({
        organizationId: orgId,
        dato: new Date(dato),
        type,
        navn,
        timerOverstyr: tov,
        standardStartTid: sst,
        standardSluttTid: sslutt,
        pauseMin: pm,
      });
    } else if (eksisterende) {
      oppdaterMutation.mutate({
        id: eksisterende.id,
        organizationId: orgId,
        type,
        navn,
        timerOverstyr: tov,
        aktiv,
        standardStartTid: sst,
        standardSluttTid: sslutt,
        pauseMin: pm,
      });
    }
  }

  function handleDeaktiver() {
    if (!eksisterende) return;
    if (!confirm(t("firma.kalender.deaktiverBekreft", { navn: eksisterende.navn }))) {
      return;
    }
    slettMutation.mutate({ id: eksisterende.id, organizationId: orgId });
  }

  const tittel =
    modus === "opprett"
      ? t("firma.kalender.leggTil")
      : t("firma.kalender.rediger");

  const lagrer = opprettMutation.isPending || oppdaterMutation.isPending;

  return (
    <Modal open={true} onClose={onLukk} title={tittel}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.kalender.felt.dato")}
          </label>
          <Input
            type="date"
            value={dato}
            onChange={(e) => setDato(e.target.value)}
            disabled={modus === "rediger"}
            required
          />
          {modus === "rediger" && (
            <p className="mt-1 text-xs text-gray-500">
              {t("firma.kalender.datoIkkeRedigerbar")}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.kalender.felt.type")}
          </label>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as KalenderType)}
            options={TYPER.map((t2) => ({
              value: t2,
              label: t(`firma.kalender.type.${t2}`),
            }))}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.kalender.felt.navn")}
          </label>
          <Input
            type="text"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            placeholder={t("firma.kalender.felt.navnPlaceholder")}
            required
          />
        </div>

        {visTimerOverstyr && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.kalender.felt.timerOverstyr")}
            </label>
            <Input
              type="number"
              step="0.25"
              min="0.25"
              max="23.75"
              value={timerOverstyr}
              onChange={(e) => setTimerOverstyr(e.target.value)}
              placeholder="3.5"
              required
            />
          </div>
        )}

        {visTidsfelter && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium text-gray-700">
              {t("firma.kalender.felt.tidsperiodeTittel")}
            </p>
            <p className="mb-3 text-xs text-gray-500">
              {t("firma.kalender.felt.tidsperiodeBeskrivelse")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t("firma.kalender.felt.standardStartTid")}
                </label>
                <Input
                  type="time"
                  value={standardStartTid}
                  onChange={(e) => setStandardStartTid(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t("firma.kalender.felt.standardSluttTid")}
                </label>
                <Input
                  type="time"
                  value={standardSluttTid}
                  onChange={(e) => setStandardSluttTid(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t("firma.kalender.felt.pauseMin")}
                </label>
                <Input
                  type="number"
                  min={0}
                  max={480}
                  value={pauseMin}
                  onChange={(e) => setPauseMin(e.target.value)}
                  placeholder="30"
                />
              </div>
            </div>
          </div>
        )}

        {modus === "rediger" && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={aktiv}
              onChange={(e) => setAktiv(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("firma.kalender.aktiv")}
          </label>
        )}

        {feil && <p className="text-sm text-red-600">{feil}</p>}

        <div className="flex justify-between gap-3 pt-2">
          {modus === "rediger" && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleDeaktiver}
              disabled={slettMutation.isPending}
            >
              {t("firma.kalender.deaktiver")}
            </Button>
          )}
          <div className="ml-auto flex gap-3">
            <Button type="button" variant="secondary" onClick={onLukk}>
              {t("handling.avbryt")}
            </Button>
            <Button type="submit" disabled={lagrer || !navn.trim()}>
              {lagrer ? t("handling.lagrer") : t("handling.lagre")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
