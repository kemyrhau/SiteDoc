"use client";

// w10b (plan web-timeføring § 4.6/§ 4.10): ÉN attestering på firmanivå. Flyttet fra
// /dashbord/firma/timer/attestering (som nå sender hit). Firma-admin ser hele firmaet som før;
// prosjektlederen ser sedlene med rader på sine prosjekter og attesterer bare dem
// (`kanAttestereFirma.omfang`, `prosjektKontekst`), uten ukeavvik, ukeoversikt og avdeling.
//
// T7-4f-3 (2026-05-16): Firma-attestering-liste. Alle tre visningene er den delte
// tabellen AttesteringTabell (spec prosjektkort-kortid d2b-1 § 12.8.5, d2b-2 R12):
// «Per prosjekt» og «Per ansatt» er grupperinger av samme rader, og ukeoversikten over
// tabellen erstatter pivotene. Nedtrekkene er kolonnefiltre i tabellhodet (§ 12.5).

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
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";
import { useAttesteringsFirma } from "@/components/attestering/useAttesteringsFirma";
import type {
  MaskinRad,
  TilleggRad,
  TimerRad,
} from "@/components/attestering/attestering-buckets";
import { AttesteringTabell } from "@/components/attestering/AttesteringTabell";
import { Ukeoversikt } from "@/components/attestering/Ukeoversikt";
import { useAttesteringModell } from "@/components/attestering/useAttesteringModell";
import type { AttSedel } from "@/components/attestering/attestering-tabell";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { aarValg, isoUke, ukeOffsetForAar } from "@/components/attestering/ukevalg";

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
  // hentTilAttesteringFirma). Driver norm-merket i dagsraden.
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

/* ------------------------------------------------------------------ */
/*  Hovedside                                                           */
/* ------------------------------------------------------------------ */

export default function AttesteringSide() {
  const { t } = useTranslation();
  const { orgId: valgtOrgId, firmaer, laster: firmaLaster } = useAttesteringsFirma();
  const orgId = valgtOrgId ?? undefined;
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
  const [returnerId, setReturnerId] = useState<string | null>(null);
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
    // B6: firmaet står i adressen bare når det er flere å velge mellom.
    if (firmaer.length > 1 && orgId) p.set("firma", orgId);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [visning, ukeOffset, aktivFane, pathname, router, firmaer.length, orgId]);

  const velgFirma = (id: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("firma", id);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const ukestart = useMemo(() => getUkestart(ukeOffset), [ukeOffset]);
  const ukeslutt = useMemo(() => getUkeslutt(ukestart), [ukestart]);
  const ukeNr = useMemo(() => ukeNummer(ukestart), [ukestart]);
  // w1: året står i årsvelgeren (datoen i tabellen er «17.11.»).
  const visAar = useMemo(() => isoUke(ukestart).aar, [ukestart]);

  const { data: tilgang, isLoading: tilgangLaster } =
    trpc.timer.dagsseddel.kanAttestereFirma.useQuery(
      { organizationId: orgId! },
      { enabled: !!orgId },
    );
  // w10b: `omfang` — «alle» (firma-admin), «prosjekter» (prosjektleder) eller «ingen».
  const kanAttestere = !!tilgang && tilgang.omfang !== "ingen";
  const erFirmaAdmin = tilgang?.omfang === "alle";
  const prosjektKontekst = useMemo(
    () => (tilgang?.omfang === "prosjekter" ? new Set(tilgang.prosjektIder) : undefined),
    [tilgang],
  );

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
  const sentRader = useMemo(() => (sentRaderRaw ?? []) as unknown as AttesteringRad[], [sentRaderRaw]);
  const acceptedRader = useMemo(() => (acceptedRaderRaw ?? []) as unknown as AttesteringRad[], [acceptedRaderRaw]);
  const rader = aktivFane === "sent" ? sentRader : acceptedRader;
  const isLoading = aktivFane === "sent" ? sentLaster : acceptedLaster;
  const readOnly = aktivFane === "accepted";

  // Avviksbadgen og -teksten gjelder HELE uken (sendt + attestert), ikke den aktive
  // fanen (ORDRE 2 STEG 2). Kolonnefiltrene snevrer bare visningen, ikke ukeavviket.
  const ukeGrunnlag = useMemo(() => [...sentRader, ...acceptedRader], [sentRader, acceptedRader]);

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

  // Tabellen (spec prosjektkort-kortid d2b-1 § 12.8.5, d2b-2 R12): dagseddel →
  // prosjektsedler → linjer, i alle tre visningene; visningen er bare grupperingen.
  const ukeAvvikTekst = useCallback(
    (s: AttSedel) => {
      const avvik = avvikFor(s as unknown as AttesteringRad);
      const retning = avvik ? avvikRetning(avvik) : null;
      if (!avvik || !retning) return null;
      const uke = ukeNummer(new Date(s.dato));
      return retning === "over"
        ? t("timer.attestering.tabell.ukeAvvikOver", { uke, timer: avvik.avvikTimer.toFixed(1), norm: avvik.norm.toFixed(1) })
        : t("timer.attestering.tabell.ukeAvvikUnder", { uke, norm: avvik.norm.toFixed(1) });
    },
    [avvikFor, t],
  );
  // Ukeavviket og avdelingen gjelder hele uken og hele firmaet — bare for firma-admin (w10b).
  const dager = useAttesteringModell(orgId, rader as unknown as AttSedel[], {
    medAvdeling: erFirmaAdmin,
    ukeAvvikTekst: erFirmaAdmin ? ukeAvvikTekst : undefined,
  });
  const avvikForAnsatt = useCallback(
    (ansattId: string) => avvikPerNokkel.get(`${ansattId}-${mandagIso(isoDato(ukestart))}`) ?? null,
    [avvikPerNokkel, ukestart],
  );

  // Bær retur-konteksten som EKSPLISITTE verdier (?fraVisning/fraUke/fraFane), ikke en
  // encodet retur-URL — sistnevnte er et open-redirect-mønster som må valideres. Detaljsiden
  // bygger tilbakeUrl av det lukkede settet; ugyldige verdier faller til standard.
  const sedelUrl = (sheetId: string) => {
    const qp = new URLSearchParams({
      fraVisning: visning,
      fraUke: String(ukeOffset),
      fraFane: aktivFane,
    });
    if (orgId) qp.set("firma", orgId);
    return `/dashbord/attestering/${sheetId}?${qp.toString()}`;
  };

  if (firmaLaster || tilgangLaster) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!orgId || !kanAttestere) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mr-1 inline-block h-4 w-4" />
        {t("timer.attestering.ingenTilgangFirma")}
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
      {/* w1: bytt år i én handling — samme uke i det valgte året. */}
      <select
        value={visAar}
        onChange={(e) => setUkeOffset(ukeOffsetForAar(ukestart, Number(e.target.value)))}
        aria-label={t("timer.attestering.uke.aar")}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 hover:bg-gray-50"
      >
        {aarValg(new Date(), visAar).map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
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
    <div className="mx-auto max-w-7xl min-w-0">
      <SonetonetSidehode sone="firma" className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t("timer.attestering.tittel")}</h1>
            <p className="mt-1 text-sm text-gray-600">{t("firma.timer.attesteringBeskrivelse")}</p>
          </div>
          <div className="flex items-center gap-2">
            {firmaer.length > 1 && (
              <select
                value={orgId}
                onChange={(e) => velgFirma(e.target.value)}
                aria-label={t("firma.velgFirma")}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 hover:bg-gray-50"
              >
                {firmaer.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.navn}
                  </option>
                ))}
              </select>
            )}
        <HjelpKnapp>
          <HjelpFane tittel={t("timer.attestering.tabell.hjelp.tittel")}>
            <p>{t("firma.timer.attesteringBeskrivelse")}</p>
            <p className="mt-2">{t("timer.attestering.hjelp.omfang")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.struktur")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.dato")} {t("timer.attestering.tabell.hjelp.aar")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.handlinger")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.merker")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.retting")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.registrering")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.verktoy")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.grupperinger")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.ukeavvik")}</p>
            <p className="mt-2">{t("timer.attestering.tabell.hjelp.kvittering")}</p>
          </HjelpFane>
        </HjelpKnapp>
          </div>
        </div>
      </SonetonetSidehode>

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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <AttesteringTabell
          dager={dager}
          orgId={orgId}
          readOnly={readOnly}
          gruppering={visning === "sedler" ? "dag" : visning}
          verktoy={<>{visningVelger}{ukeNav}</>}
          ukeoversikt={
            erFirmaAdmin
              ? (api) => (
                  <Ukeoversikt
                    api={api}
                    ukestart={ukestart}
                    akse={visning === "prosjekt" ? "prosjekt" : "ansatt"}
                    avvikFor={avvikForAnsatt}
                  />
                )
              : undefined
          }
          prosjektKontekst={prosjektKontekst}
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
