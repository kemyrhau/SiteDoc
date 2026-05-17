"use client";

// T7-4f-3 (2026-05-16): Firma-attestering-liste — mockup v7.
// Uke-navigasjon, filter-pills, gruppering per prosjekt, kompakt sedel-kort
// via SeddelKort (T7-4f-3b 2026-05-17 — flat tabell, ikke ProsjektSectionAttest).

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
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
  beskrivelse: string | null;
  aktivitet: { id: string; navn: string; kode: string | null } | null;
  ansatt: Ansatt | null;
  prosjekt: { id: string; name: string; projectNumber: string | null } | null;
  timer: TimerRad[];
  tillegg: TilleggRad[];
  maskiner: MaskinRad[];
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

/* ------------------------------------------------------------------ */
/*  Hovedside                                                           */
/* ------------------------------------------------------------------ */

export default function FirmaAttesteringSide() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const utils = trpc.useUtils();

  const [ukeOffset, setUkeOffset] = useState(0);
  const [valgtProsjektId, setValgtProsjektId] = useState<string>("");
  const [valgtAnsattId, setValgtAnsattId] = useState<string>("");
  const [valgtAvdelingId, setValgtAvdelingId] = useState<string>("");
  const [returnerId, setReturnerId] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  const ukestart = useMemo(() => getUkestart(ukeOffset), [ukeOffset]);
  const ukeslutt = useMemo(() => getUkeslutt(ukestart), [ukestart]);
  const ukeNr = useMemo(() => ukeNummer(ukestart), [ukestart]);

  const { data: tilgang, isLoading: tilgangLaster } =
    trpc.timer.dagsseddel.kanAttestereFirma.useQuery(
      { organizationId: orgId! },
      { enabled: !!orgId },
    );
  const kanAttestere = tilgang?.kanAttestere ?? false;

  const { data: raderRaw, isLoading } =
    trpc.timer.dagsseddel.hentTilAttesteringFirma.useQuery(
      {
        organizationId: orgId!,
        fraOgMed: isoDato(ukestart),
        tilOgMed: isoDato(ukeslutt),
      },
      { enabled: !!orgId && kanAttestere },
    );
  const rader = (raderRaw ?? []) as unknown as AttesteringRad[];

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

  const filtrerteSedler = useMemo(() => {
    return rader.filter((s) => {
      if (valgtProsjektId && s.prosjekt?.id !== valgtProsjektId) return false;
      if (valgtAnsattId && s.ansatt?.id !== valgtAnsattId) return false;
      if (valgtAvdelingId && s.ansatt?.avdelingId !== valgtAvdelingId) return false;
      return true;
    });
  }, [rader, valgtProsjektId, valgtAnsattId, valgtAvdelingId]);

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
      prosjektNummer: sedler[0]?.prosjekt?.projectNumber ?? null,
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
