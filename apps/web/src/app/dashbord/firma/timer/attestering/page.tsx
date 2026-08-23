"use client";

// T7-4f-3 (2026-05-16): Firma-attestering-liste — mockup v7.
// Uke-navigasjon, filter-pills, gruppering per prosjekt, kompakt sedel-kort
// via SeddelKort (T7-4f-3b 2026-05-17 — flat tabell, ikke ProsjektSectionAttest).

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  FolderKanban,
  Users,
} from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import {
  ProsjektPivot,
  AnsattPivot,
  type PivotRad,
} from "@/components/attestering/AttesteringPivot";
import type {
  MaskinRad,
  RadProsjekt,
  TilleggRad,
  TimerRad,
} from "@/components/attestering/attestering-buckets";
import { SeddelKort } from "@/components/attestering/SeddelKort";

/* ------------------------------------------------------------------ */
/*  Typer                                                               */
/* ------------------------------------------------------------------ */

type Ansatt = {
  id: string;
  name: string | null;
  email: string;
  ansattnummer: string | null;
  avdelingId: string | null;
};

type AttesteringRad = {
  id: string;
  dato: Date | string;
  totaltimer: number;
  antallRader: number;
  tilleggHarKrav: boolean;
  dagsnorm: number;
  redigerTillatt: boolean;
  // B5 (2026-05-27): pauseMin trengs for maskin-av-arbeid-invarianten
  // i SeddelKort. Server returnerer feltet via ...s-spread i
  // hentTilAttesteringFirma — eksplisitt her for type-fanging.
  pauseMin: number;
  beskrivelse: string | null;
  aktivitet: { id: string; navn: string; kode: string | null } | null;
  ansatt: Ansatt | null;
  prosjekt: { id: string; name: string; internalProjectNumber: string | null } | null;
  timer: TimerRad[];
  tillegg: TilleggRad[];
  maskiner: MaskinRad[];
  // T.11: leder-synlighet — maskinarbeid uten gyldig maskinførerbevis.
  manglerMaskinforerbevis: boolean;
  // ORDRE 2 STEG 1/2: server-avledet overtidsgrunnlag (dag-nivå) + ukenorm.
  overtidsgrunnlag: {
    sumOrdinaert: number;
    sumOvertid: number;
    beregnetOvertid: number;
    avvik: boolean;
  } | null;
  ukenorm: number;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function getUkestart(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dag = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - dag + offset * 7);
  return d;
}

function getUkeslutt(start: Date): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + 6);
  return d;
}

function isoDato(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ukeNummer(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatDato(d: Date | string): string {
  return new Date(d).toLocaleDateString("no-NB", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  });
}

/** Typet innsnevring AttesteringRad → PivotRad. Leser eksplisitt fra kilden i
 *  stedet for `as unknown as PivotRad[]` — mister vi et felt PivotRad krever,
 *  feiler tsc her, ikke som `undefined` langt unna (SAMARBEIDSREGLER-advarselen
 *  om cast-lekkasje). */
function tilPivotRad(r: AttesteringRad): PivotRad {
  return {
    id: r.id,
    dato: r.dato,
    totaltimer: r.totaltimer,
    ukenorm: r.ukenorm,
    overtidsgrunnlag: r.overtidsgrunnlag,
    ansatt: r.ansatt
      ? { id: r.ansatt.id, name: r.ansatt.name, email: r.ansatt.email }
      : null,
    prosjekt: r.prosjekt,
    // TimerRad.timer/MaskinRad.timer/mengde er `unknown` (Decimal serialisert
    // som tall/streng); dagskortet + pivoten konsumerer via Number(), så vi
    // normaliserer her. beskrivelse/sheetTimerId følger med i payloaden.
    timer: r.timer.map((rad) => ({
      id: rad.id,
      projectId: rad.projectId,
      timer: Number(rad.timer),
      aktivitetId: rad.aktivitetId,
      lonnsartId: rad.lonnsartId,
      beskrivelse: rad.beskrivelse,
    })),
    maskiner: r.maskiner.map((m) => ({
      vehicleId: m.vehicleId,
      sheetTimerId: m.sheetTimerId,
      timer: Number(m.timer),
      mengde: m.mengde === null || m.mengde === undefined ? null : Number(m.mengde),
      enhet: m.enhet,
    })),
    manglerMaskinforerbevis: r.manglerMaskinforerbevis,
  };
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                           */
/* ------------------------------------------------------------------ */

export default function FirmaAttesteringSide() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const utils = trpc.useUtils();
  const router = useRouter();

  // ORDRE 2 STEG 2 (D3): visningsvelger — Sedler (dagens) · Per prosjekt · Per ansatt.
  const [visning, setVisning] = useState<"sedler" | "prosjekt" | "ansatt">(
    "sedler",
  );
  const [ukeOffset, setUkeOffset] = useState(0);
  const [valgtProsjektId, setValgtProsjektId] = useState<string>("");
  const [valgtAnsattId, setValgtAnsattId] = useState<string>("");
  const [valgtAvdelingId, setValgtAvdelingId] = useState<string>("");
  const [returnerId, setReturnerId] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  // T7-5e: fane-toggle mellom venter på attestering ("sent") og attestert
  // ("accepted"). Attestert-fanen er read-only — knapper og redigering skjult.
  const [aktivFane, setAktivFane] = useState<"sent" | "accepted">("sent");

  const ukestart = useMemo(() => getUkestart(ukeOffset), [ukeOffset]);
  const ukeslutt = useMemo(() => getUkeslutt(ukestart), [ukestart]);
  const ukeNr = useMemo(() => ukeNummer(ukestart), [ukestart]);

  const { data: tilgang, isLoading: tilgangLaster } =
    trpc.timer.dagsseddel.kanAttestereFirma.useQuery(
      { organizationId: orgId! },
      { enabled: !!orgId },
    );
  const kanAttestere = tilgang?.kanAttestere ?? false;

  // T7-5e: to parallelle queries (samme uke-vindu, ulik status) for å vise
  // badge-tall på begge faner uten å bytte fane.
  const { data: sentRaderRaw, isLoading: sentLaster } =
    trpc.timer.dagsseddel.hentTilAttesteringFirma.useQuery(
      {
        organizationId: orgId!,
        fraOgMed: isoDato(ukestart),
        tilOgMed: isoDato(ukeslutt),
        status: "sent",
      },
      { enabled: !!orgId && kanAttestere },
    );
  const { data: acceptedRaderRaw, isLoading: acceptedLaster } =
    trpc.timer.dagsseddel.hentTilAttesteringFirma.useQuery(
      {
        organizationId: orgId!,
        fraOgMed: isoDato(ukestart),
        tilOgMed: isoDato(ukeslutt),
        status: "accepted",
      },
      { enabled: !!orgId && kanAttestere },
    );
  const sentRader = (sentRaderRaw ?? []) as unknown as AttesteringRad[];
  const acceptedRader = (acceptedRaderRaw ?? []) as unknown as AttesteringRad[];
  const rader = aktivFane === "sent" ? sentRader : acceptedRader;
  const isLoading = aktivFane === "sent" ? sentLaster : acceptedLaster;
  const readOnly = aktivFane === "accepted";

  const { data: avdelinger } = trpc.avdeling.hentAlle.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId && kanAttestere },
  );

  // Distinct verdier til pills
  const prosjekterIRader = useMemo(() => {
    const m = new Map<string, NonNullable<RadProsjekt>>();
    for (const s of rader) {
      if (s.prosjekt) m.set(s.prosjekt.id, s.prosjekt);
    }
    return Array.from(m.values());
  }, [rader]);

  const ansatteIRader = useMemo(() => {
    const m = new Map<string, { id: string; navn: string }>();
    for (const s of rader) {
      if (s.ansatt) {
        m.set(s.ansatt.id, {
          id: s.ansatt.id,
          navn: s.ansatt.name ?? s.ansatt.email,
        });
      }
    }
    return Array.from(m.values());
  }, [rader]);

  // Ett filter-predikat, to bruk: visning (aktiv fane) og avviksgrunnlag
  // (hele uken). Delt så de aldri drifter.
  const passererFilter = useCallback(
    (s: AttesteringRad): boolean => {
      if (valgtProsjektId && s.prosjekt?.id !== valgtProsjektId) return false;
      if (valgtAnsattId && s.ansatt?.id !== valgtAnsattId) return false;
      if (valgtAvdelingId && s.ansatt?.avdelingId !== valgtAvdelingId) return false;
      return true;
    },
    [valgtProsjektId, valgtAnsattId, valgtAvdelingId],
  );

  const filtrerteSedler = useMemo(
    () => rader.filter(passererFilter),
    [rader, passererFilter],
  );

  // ORDRE 2 STEG 2 (fabel-gate-fiks): avviksbadgen skal gjelde HELE uken, ikke
  // den aktive fanen. page snevrer `rader` til aktiv fane for visning, men både
  // sent- og accepted-settet er alt lastet (to parallelle queries over). Union
  // med samme pill-filter → korrekt norm-avvik selv når uken er delvis attestert.
  const ukeGrunnlag = useMemo(
    () => [...sentRader, ...acceptedRader].filter(passererFilter),
    [sentRader, acceptedRader, passererFilter],
  );

  // Gruppering per prosjekt
  const grupper = useMemo(() => {
    const m = new Map<string, AttesteringRad[]>();
    for (const s of filtrerteSedler) {
      const key = s.prosjekt?.id ?? "—";
      const liste = m.get(key) ?? [];
      liste.push(s);
      m.set(key, liste);
    }
    return Array.from(m.entries()).map(([prosjektId, sedler]) => ({
      prosjektId,
      prosjektNavn:
        sedler[0]?.prosjekt?.name ?? t("timer.detalj.ukjentProsjekt"),
      prosjektNummer: sedler[0]?.prosjekt?.internalProjectNumber ?? null,
      sedler,
      arbeidstimer: sedler.reduce(
        (acc, s) => acc + s.timer.reduce((a, r) => a + Number(r.timer), 0),
        0,
      ),
      maskintimer: sedler.reduce(
        (acc, s) => acc + s.maskiner.reduce((a, r) => a + Number(r.timer), 0),
        0,
      ),
    }));
  }, [filtrerteSedler, t]);

  const attester = trpc.timer.dagsseddel.attester.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  // ORDRE 2 STEG 2: pivot-callbacks. Celle-klikk → sedel-detalj; batch per rad.
  const aapneSedel = (sheetId: string) =>
    router.push(`/dashbord/firma/timer/attestering/${sheetId}`);
  const attesterMange = (sheetIds: string[]) => {
    setFeil(null);
    for (const id of sheetIds) attester.mutate({ id });
  };

  if (tilgangLaster) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mr-1 inline-block h-4 w-4" />
        {t("firma.timer.attesteringIngenFirma")}
      </div>
    );
  }

  if (!kanAttestere) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mr-1 inline-block h-4 w-4" />
        {t("timer.attestering.ingenTilgang")}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-600">
        {t("firma.timer.attesteringBeskrivelse")}
      </p>

      {/* T7-5e: Fane-toggle [Venter på attestering ●N] [Attestert ●M] */}
      <div className="mb-4 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setAktivFane("sent")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            aktivFane === "sent"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {t("timer.attestering.fane.venter")}
          {sentRader.length > 0 && (
            <span
              className={`ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                aktivFane === "sent"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {sentRader.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setAktivFane("accepted")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            aktivFane === "accepted"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {t("timer.attestering.fane.attestert")}
          {acceptedRader.length > 0 && (
            <span
              className={`ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                aktivFane === "accepted"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {acceptedRader.length}
            </span>
          )}
        </button>
      </div>

      {/* ORDRE 2 STEG 2: visningsvelger — samme uke/filtre på alle tre */}
      <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
        {(
          [
            { id: "sedler", ikon: LayoutList },
            { id: "prosjekt", ikon: FolderKanban },
            { id: "ansatt", ikon: Users },
          ] as const
        ).map((v) => (
          <button
            key={v.id}
            onClick={() => setVisning(v.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              visning === v.id
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <v.ikon className="h-3.5 w-3.5" />
            {t(`timer.attestering.visning.${v.id}`)}
          </button>
        ))}
      </div>

      {/* Uke-navigasjon */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setUkeOffset((o) => o - 1)}
          className="rounded border border-gray-300 p-1.5 hover:bg-gray-50"
          aria-label={t("timer.attestering.uke.label", { nr: ukeNr - 1 })}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-[220px] text-center text-sm font-medium text-gray-900">
          {t("timer.attestering.uke.label", { nr: ukeNr })}{" "}
          <span className="text-gray-500">
            · {formatDato(ukestart)}–{formatDato(ukeslutt)}
          </span>
        </div>
        <button
          onClick={() => setUkeOffset((o) => o + 1)}
          className="rounded border border-gray-300 p-1.5 hover:bg-gray-50"
          aria-label={t("timer.attestering.uke.label", { nr: ukeNr + 1 })}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {ukeOffset !== 0 && (
          <button
            onClick={() => setUkeOffset(0)}
            className="ml-2 text-xs text-blue-600 hover:underline"
          >
            {t("timer.attestering.uke.iDag")}
          </button>
        )}
      </div>

      {/* Filter-pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={valgtProsjektId}
          onChange={(e) => setValgtProsjektId(e.target.value)}
          className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs"
        >
          <option value="">{t("timer.attestering.filter.alleProsjekter")}</option>
          {prosjekterIRader.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={valgtAnsattId}
          onChange={(e) => setValgtAnsattId(e.target.value)}
          className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs"
        >
          <option value="">{t("timer.attestering.filter.alleAnsatte")}</option>
          {ansatteIRader.map((a) => (
            <option key={a.id} value={a.id}>
              {a.navn}
            </option>
          ))}
        </select>
        <select
          value={valgtAvdelingId}
          onChange={(e) => setValgtAvdelingId(e.target.value)}
          className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs"
        >
          <option value="">{t("timer.attestering.filter.alleAvdelinger")}</option>
          {avdelinger?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.navn}
            </option>
          ))}
        </select>
      </div>

      {feil && <p className="mb-4 text-sm text-red-600">{feil}</p>}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : visning === "prosjekt" ? (
        <ProsjektPivot
          visningsRader={filtrerteSedler.map(tilPivotRad)}
          ukestart={ukestart}
          onAapneSedel={aapneSedel}
          onAttesterMange={attesterMange}
          attesterPending={attester.isPending}
          readOnly={readOnly}
        />
      ) : visning === "ansatt" ? (
        <AnsattPivot
          visningsRader={filtrerteSedler.map(tilPivotRad)}
          ukeGrunnlag={ukeGrunnlag.map(tilPivotRad)}
          ukestart={ukestart}
          onAapneSedel={aapneSedel}
          onAttesterMange={attesterMange}
          attesterPending={attester.isPending}
          readOnly={readOnly}
        />
      ) : grupper.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">
            {t("timer.attestering.ingenSedler")}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupper.map((g) => (
            <ProsjektGruppe
              key={g.prosjektId}
              gruppe={g}
              onAttester={(id) => {
                setFeil(null);
                attester.mutate({ id });
              }}
              onReturner={(id) => setReturnerId(id)}
              attesterPending={attester.isPending}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      {returnerId && (
        <ReturnerDialog
          sheetId={returnerId}
          onLukk={() => setReturnerId(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ProsjektGruppe                                                      */
/* ------------------------------------------------------------------ */

function ProsjektGruppe({
  gruppe,
  onAttester,
  onReturner,
  attesterPending,
  readOnly,
}: {
  gruppe: {
    prosjektId: string;
    prosjektNavn: string;
    prosjektNummer: string | null;
    sedler: AttesteringRad[];
    arbeidstimer: number;
    maskintimer: number;
  };
  onAttester: (sheetId: string) => void;
  onReturner: (sheetId: string) => void;
  attesterPending: boolean;
  readOnly: boolean;
}) {
  const { t } = useTranslation();

  return (
    <section>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-t-lg border border-gray-200 bg-gray-100 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-gray-900">
            {gruppe.prosjektNavn}
          </h2>
          {gruppe.prosjektNummer && (
            <span className="text-xs text-gray-500">{gruppe.prosjektNummer}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>
            {t("timer.attestering.gruppe.sedler", { antall: gruppe.sedler.length })}
          </span>
          <span className="font-mono">
            {gruppe.arbeidstimer.toFixed(2)}t {t("timer.gruppe.arbeidstimer")}
          </span>
          <span className="font-mono">
            {gruppe.maskintimer.toFixed(2)}t {t("timer.gruppe.maskintimer")}
          </span>
          {!readOnly && (
            <Button
              size="sm"
              onClick={() => {
                for (const s of gruppe.sedler) onAttester(s.id);
              }}
              disabled={attesterPending}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              {t("timer.attestering.gruppe.attesterGruppe", {
                antall: gruppe.sedler.length,
              })}
            </Button>
          )}
        </div>
      </header>
      <div className="space-y-3">
        {gruppe.sedler.map((s) => (
          <SeddelKort
            key={s.id}
            sedel={s}
            onAttester={() => onAttester(s.id)}
            onReturner={() => onReturner(s.id)}
            attesterPending={attesterPending}
            readOnly={readOnly}
          />
        ))}
      </div>
    </section>
  );
}


/* ------------------------------------------------------------------ */
/*  ReturnerDialog                                                      */
/* ------------------------------------------------------------------ */

function ReturnerDialog({
  sheetId,
  onLukk,
}: {
  sheetId: string;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [kommentar, setKommentar] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const returner = trpc.timer.dagsseddel.returner.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    if (!kommentar.trim()) {
      setFeil(t("timer.attestering.kommentarPaakrevd"));
      return;
    }
    returner.mutate({ id: sheetId, kommentar: kommentar.trim() });
  }

  return (
    <Modal
      open={true}
      onClose={onLukk}
      title={t("timer.attestering.returnerTittel")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          {t("timer.attestering.returnerBeskrivelse")}
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.attestering.kommentar")}
          </label>
          <textarea
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            rows={4}
            placeholder={t("timer.attestering.kommentarPlaceholder")}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            autoFocus
            required
          />
        </div>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button
            type="submit"
            disabled={returner.isPending || !kommentar.trim()}
          >
            {returner.isPending
              ? t("handling.lagrer")
              : t("timer.attestering.returner")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
