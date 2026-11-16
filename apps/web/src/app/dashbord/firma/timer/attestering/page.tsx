"use client";

// T7-4f-3 (2026-05-16): Firma-attestering-liste. Sedler-visningen er fra d2b-1
// (spec prosjektkort-kortid § 12.8.5) tabellen AttesteringTabell; pivotvisningene
// (Per prosjekt / Per ansatt) beholder uke-navigasjon og nedtrekk.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  FolderKanban,
  Users,
} from "lucide-react";
import { avvikRetning, beregnUkeAvvik, mandagIso, type UkeAvvik, type NormtakBruddData } from "@sitedoc/shared";
import { useFirma } from "@/kontekst/firma-kontekst";
import {
  ProsjektPivot,
  AnsattPivot,
} from "@/components/attestering/AttesteringPivot";
import { tilPivotRad, useKatalogNavn } from "@/components/attestering/DagsKort";
import type {
  MaskinRad,
  RadProsjekt,
  TilleggRad,
  TimerRad,
} from "@/components/attestering/attestering-buckets";
import { AttesteringTabell } from "@/components/attestering/AttesteringTabell";
import { byggAttesteringModell, type AttSedel } from "@/components/attestering/attestering-tabell";
import { normtakBruddLinje } from "@/lib/normtakBrudd";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";

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

// Utlegg-rad slik dagskortet trenger den: beløp + kategorinavn. Speiler
// server-`select` (id/belop/expenseCategory.navn) — INGEN kommentar/vedlegg.
// `belop` er Decimal serialisert (unknown → Number ved mapping).
type UtleggRad = {
  id: string;
  belop: unknown;
  expenseCategory: { navn: string } | null;
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
  // i tabellen. Server returnerer feltet via ...s-spread i
  // hentTilAttesteringFirma — eksplisitt her for type-fanging.
  pauseMin: number;
  beskrivelse: string | null;
  aktivitet: { id: string; navn: string; kode: string | null } | null;
  ansatt: Ansatt | null;
  prosjekt: { id: string; name: string; internalProjectNumber: string | null } | null;
  timer: TimerRad[];
  tillegg: TilleggRad[];
  maskiner: MaskinRad[];
  // Dagskort: utlegg (beløp + kategorinavn via server-include; INGEN vedlegg).
  utlegg: UtleggRad[];
  // T.11: leder-synlighet — maskinarbeid uten gyldig maskinførerbevis.
  manglerMaskinforerbevis: boolean;
  // LAG 2 D1: sedelens norm-status (DailySheet.normStatus, via ...s-spread i
  // hentTilAttesteringFirma). Driver norm-merket i dagsumraden.
  normStatus: "server" | "cachet" | "ukjent" | null;
  // V19-C (C-2): uavklart PC/mobil-overlapp (DailySheet.konfliktVentendeSiden, via
  // ...s-spread). Blokkerer ✓ i tabellen. Lista leser ALDRI forslagsradene (M15).
  konfliktVentendeSiden: Date | string | null;
  // B10 (§ 11.10.4): fravær med tak over dagsnormen; null = intet brudd. Sperrer ✓.
  fravaerNormtakBrudd: NormtakBruddData | null;
  // ORDRE 2 STEG 1/2: server-avledet overtidsgrunnlag (dag-nivå) + ukenorm.
  overtidsgrunnlag: {
    sumOrdinaert: number;
    sumOvertid: number;
    beregnetOvertid: number;
    avvik: boolean;
    // F-F1 (kort-id-spec § 11.10.4): dagens timer med fravær bare inntil normen.
    ukeTimer?: number;
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

// tilPivotRad (AttesteringRad → PivotRad) er nå delt fra DagsKort.tsx, så
// pivotene og Sedler-lista bruker samme mapping. AttesteringRad er strukturelt
// en RaaSedel.

/* ------------------------------------------------------------------ */
/*  Hovedside                                                           */
/* ------------------------------------------------------------------ */

export default function FirmaAttesteringSide() {
  const { t, i18n } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const utils = trpc.useUtils();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Retur-navigasjon (2026-08-23): visning/uke/fane leves i URL-en så «Tilbake til
  // oversikt» fra detaljsiden gjenoppretter konteksten, og en URL kan deles. Ekspandert
  // rad + scroll bevisst UTELATT — visning + uke er nok til å finne konteksten på ett blikk.
  // ORDRE 2 STEG 2 (D3): visningsvelger — Sedler (dagens) · Per prosjekt · Per ansatt.
  const [visning, setVisning] = useState<"sedler" | "prosjekt" | "ansatt">(() => {
    const v = searchParams.get("visning");
    return v === "prosjekt" || v === "ansatt" ? v : "sedler";
  });
  const [ukeOffset, setUkeOffset] = useState<number>(() => {
    const u = Number(searchParams.get("uke"));
    return Number.isInteger(u) ? u : 0;
  });
  const [valgtProsjektId, setValgtProsjektId] = useState<string>("");
  const [valgtAnsattId, setValgtAnsattId] = useState<string>("");
  const [valgtAvdelingId, setValgtAvdelingId] = useState<string>("");
  const [returnerId, setReturnerId] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  // T7-5e: fane-toggle mellom venter på attestering ("sent") og attestert
  // ("accepted"). Attestert-fanen er read-only — knapper og redigering skjult.
  const [aktivFane, setAktivFane] = useState<"sent" | "accepted">(() =>
    searchParams.get("fane") === "accepted" ? "accepted" : "sent",
  );

  // Speil visning/uke/fane til URL-en (router.replace — ikke history-push, ikke back).
  // Én retning: state → URL. Init-lesingen skjer i useState over, så ingen løkke.
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("visning", visning);
    p.set("uke", String(ukeOffset));
    p.set("fane", aktivFane);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [visning, ukeOffset, aktivFane, pathname, router]);

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

  // ORDRE 2 STEG 3 ledd 2 (D2): uke-avvik pr. (ansatt + uke) for tabellens
  // avvikstekst på Sedler-visningen. Regnet på HELE ukens grunnlag (union sent+
  // accepted) — samme kilde og funksjon som AnsattPivot-badgen, så de aldri
  // drifter. Nøkkel = ansatt + mandag (lista er én uke, men nøkkelen er robust).
  const avvikPerNokkel = useMemo(() => {
    const bøtter = new Map<
      string,
      { totaltimer: number; ukenorm: number; sumOvertid: number; ukeTimer?: number }[]
    >();
    for (const s of ukeGrunnlag) {
      const ansattId = s.ansatt?.id;
      if (!ansattId) continue;
      const nokkel = `${ansattId}-${mandagIso(s.dato)}`;
      const liste = bøtter.get(nokkel) ?? [];
      liste.push({
        totaltimer: s.totaltimer,
        ukenorm: s.ukenorm,
        sumOvertid: s.overtidsgrunnlag?.sumOvertid ?? 0,
        // F-F1: fravær fyller bare dagens norm i ukesummen (eldre svar → totaltimer).
        ukeTimer: s.overtidsgrunnlag?.ukeTimer,
      });
      bøtter.set(nokkel, liste);
    }
    const ut = new Map<string, UkeAvvik>();
    for (const [nokkel, liste] of bøtter) ut.set(nokkel, beregnUkeAvvik(liste));
    return ut;
  }, [ukeGrunnlag]);

  const avvikFor = useCallback(
    (s: AttesteringRad): UkeAvvik | null => {
      const ansattId = s.ansatt?.id;
      if (!ansattId) return null;
      return avvikPerNokkel.get(`${ansattId}-${mandagIso(s.dato)}`) ?? null;
    },
    [avvikPerNokkel],
  );

  // Sedler-fanen som tabell (spec prosjektkort-kortid d2b-1, § 12.8.5): dagseddel →
  // prosjektsedler → linjer. Ekspander-knappene og «Attester gruppe» er erstattet av
  // «Bare oversiktsrader», Avvik-filteret («Krever vurdering») og «Attester utvalget».
  const katalog = useKatalogNavn(orgId);
  const dager = useMemo(() => {
    const avdNavn = new Map((avdelinger ?? []).map((a) => [a.id, a.navn]));
    return byggAttesteringModell(filtrerteSedler as unknown as AttSedel[], {
      ...katalog,
      avdelingNavn: (id) => (id ? avdNavn.get(id) ?? null : null),
      normtakLinje: (s) => normtakBruddLinje(t, (s as unknown as AttesteringRad).fravaerNormtakBrudd, i18n.language),
      ukeAvvikTekst: (s) => {
        const avvik = avvikFor(s as unknown as AttesteringRad);
        const retning = avvik ? avvikRetning(avvik) : null;
        if (!avvik || !retning) return null;
        const uke = ukeNummer(new Date(s.dato));
        return retning === "over"
          ? t("timer.attestering.tabell.ukeAvvikOver", { uke, timer: avvik.avvikTimer.toFixed(1), norm: avvik.norm.toFixed(1) })
          : t("timer.attestering.tabell.ukeAvvikUnder", { uke, norm: avvik.norm.toFixed(1) });
      },
      tekst: {
        forslagSperre: t("timer.forslagValg.attesterBlokkert"),
        maskinUtenTimerad: t("timer.attestering.tabell.maskinUtenTimerad"),
        maskinforerbevis: t("timer.maskinforerbevis.leder"),
        tilleggskrav: t("timer.attestering.sedel.tilleggskrav"),
        tilByggherre: t("timer.gruppe.tilByggherre"),
        fravaerUtenProsjekt: t("timer.detalj.fravaerUtenProsjekt"),
        reise: t("timer.attestering.tabell.type.reise"),
        statusVenter: t("timer.attestering.tabell.status.venter"),
        statusAttestert: t("timer.attestering.tabell.status.attestert"),
        statusReturnert: t("timer.attestering.tabell.status.returnert"),
      },
    });
  }, [filtrerteSedler, katalog, avdelinger, t, i18n.language, avvikFor]);

  const attester = trpc.timer.dagsseddel.attester.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  // ORDRE 2 STEG 2: pivot-callbacks. Celle-klikk → sedel-detalj; batch per rad.
  // Bær retur-konteksten som EKSPLISITTE verdier (?fraVisning/fraUke/fraFane), ikke en
  // encodet retur-URL — sistnevnte er et open-redirect-mønster som må valideres. Detaljsiden
  // bygger tilbakeUrl av det lukkede settet; ugyldige verdier faller til standard.
  const sedelUrl = (sheetId: string) => {
    const qp = new URLSearchParams({
      fraVisning: visning,
      fraUke: String(ukeOffset),
      fraFane: aktivFane,
    });
    return `/dashbord/firma/timer/attestering/${sheetId}?${qp.toString()}`;
  };
  const aapneSedel = (sheetId: string) => router.push(sedelUrl(sheetId));
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

  const visningVelger = (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
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
  );
  const ukeNav = (
    <div className="flex items-center gap-2">
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
  );

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <HjelpKnapp>
          <HjelpFane tittel={t("timer.attestering.tabell.hjelp.tittel")}>
            <p>{t("firma.timer.attesteringBeskrivelse")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.struktur")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.handlinger")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.retting")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.verktoy")}</p>
          </HjelpFane>
        </HjelpKnapp>
      </div>

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

      {visning !== "sedler" && (
        <div className="mb-4 space-y-4">
          {visningVelger}
          {ukeNav}
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

        </div>
      )}

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
      ) : (
        <AttesteringTabell
          dager={dager}
          orgId={orgId}
          readOnly={readOnly}
          verktoy={<>{visningVelger}{ukeNav}</>}
          ukeoversikt={
            <AnsattPivot
              visningsRader={filtrerteSedler.map(tilPivotRad)}
              ukeGrunnlag={ukeGrunnlag.map(tilPivotRad)}
              ukestart={ukestart}
              onAapneSedel={aapneSedel}
              onAttesterMange={attesterMange}
              attesterPending={attester.isPending}
              readOnly={readOnly}
            />
          }
          sedelUrl={sedelUrl}
          onReturnerDag={(id) => setReturnerId(id)}
        />
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
