"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useFirma } from "@/kontekst/firma-kontekst";
import { skalVarsleSkjulteTimer } from "@sitedoc/shared";
import { Spinner, Input, Button } from "@sitedoc/ui";
import { MultiComboks } from "@/components/ui/MultiComboks";
import { RegistrerTimerKnapp } from "@/components/timer/RegistrerTimerKnapp";
import { SlettDagModal } from "@/components/timer/SlettDagModal";
import { lokalIsoDato, medRetur, mineTimerIntervall } from "@/lib/tilbake-adresse";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { spennerFlereAar, standardRegistrerDato, visDagDato, visTimerTall } from "@/lib/registrerTimer";
import { Clock, FileText, Briefcase, Activity, Info, ChevronRight, Trash2 } from "lucide-react";
import { KorrigertAvDag, type DagKorrigertAv } from "@/components/timer/KorrigertMerke";

/** w14 (TK3): dagene herfra går tilbake til Mine timer («Tilbake til Mine timer»). */
const MINE_TIMER_STI = "/dashbord/timer/mine";

/**
 * «Mine timer» — personlig rapport-visning på tvers av prosjekter
 * (Runde 2.7 2026-05-02).
 *
 * Bruker eksisterende timer.dagsseddel.list med userId default = ctx.userId.
 * Aggregeringer beregnes klient-side. Hvis datasett vokser over ~500 sedler
 * for en periode, vurderes egen aggregert query (utsatt).
 */

type Periode =
  | "denne_uken"
  | "denne_maaneden"
  | "forrige_maaneden"
  | "siste_3_mnd"
  | "egendefinert";

const PERIODER: Periode[] = [
  "denne_uken",
  "denne_maaneden",
  "forrige_maaneden",
  "siste_3_mnd",
  "egendefinert",
];

const STATUS_VALG = ["alle", "draft", "sent", "returned", "accepted"] as const;
type StatusValg = (typeof STATUS_VALG)[number];

type ListeRad = {
  id: string;
  dato: Date | string;
  status: string;
  // Kenneth-vedtak 2026-10-09 (2): styrer om slett tilbys (draft | returnert-ikke-attestert).
  attestertVed: string | Date | null;
  totaltimer: number;
  antallRader: number;
  // T.1: prosjekt(er) utledet fra radene — en sedel kan spenne flere prosjekter.
  prosjektIder: string[];
  aktivitet: { id: string; navn: string; kode: string | null } | null;
  // Rad-beskrivelser for fritekstsøk (TILLEGG 3). list() inkluderer timer-radene.
  timer?: { beskrivelse: string | null }[];
  // w15g: «Korrigert av [navn]» — hvem som korrigerte sist på dagen, og om flere har gjort det.
  korrigertAv?: DagKorrigertAv | null;
};

// TILLEGG 2 punkt 2 / TILLEGG 3: valgt filter huskes på tvers av navigasjon.
const FILTER_KEY = "sitedoc-mine-timer-filter";
type LagretFilter = {
  periode?: Periode;
  fraEgen?: string;
  tilEgen?: string;
  datoSok?: string;
  statusFilter?: StatusValg;
  valgteProsjekter?: string[];
  fritekst?: string;
};
function lesLagretFilter(): LagretFilter {
  try {
    const rå = localStorage.getItem(FILTER_KEY);
    return rå ? (JSON.parse(rå) as LagretFilter) : {};
  } catch {
    return {};
  }
}
function skrivLagretFilter(f: LagretFilter): void {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(f));
  } catch {
    /* privat modus / kvote — persistering er valgfri */
  }
}

function ukestart(dato: Date): Date {
  const d = new Date(dato);
  const dag = d.getDay();
  const offset = dag === 0 ? -6 : 1 - dag;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Dagsseddelens dato fra serveren (UTC-midnatt) som YYYY-MM-DD. */
function datoIso(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

function formatDato(d: Date | string): string {
  return new Date(d).toLocaleDateString("no-NB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


export default function MineTimerSide() {
  const { t } = useTranslation();
  // Kenneth-vedtak 2026-10-09: timer følger innlogget firma — samme firmakilde til
  // både prosjektliste og dagsseddel-lista.
  const { valgtFirma, erSitedocAdmin } = useFirma();
  const orgId = valgtFirma?.id ?? undefined;
  // w2 (B2 trinn 3): prosjektet i toppen er forvalget for «+ Registrer timer».
  const { prosjektId: aktivProsjektId } = useProsjekt();
  const utils = trpc.useUtils();

  // TILLEGG 2/3: hydrer filter fra localStorage (lazy init — kun på klient).
  const [lagret] = useState<LagretFilter>(() =>
    typeof window === "undefined" ? {} : lesLagretFilter(),
  );
  const [periode, setPeriode] = useState<Periode>(lagret.periode ?? "denne_uken");
  const [fraEgen, setFraEgen] = useState<string>(lagret.fraEgen ?? lokalIsoDato(ukestart(new Date())));
  const [tilEgen, setTilEgen] = useState<string>(lagret.tilEgen ?? lokalIsoDato(new Date()));
  // TILLEGG 3: søk på én enkelt dato på tvers av prosjekter — overstyrer perioden.
  const [datoSok, setDatoSok] = useState<string>(lagret.datoSok ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusValg>(lagret.statusFilter ?? "alle");
  const [valgteProsjekter, setValgteProsjekter] = useState<string[]>(lagret.valgteProsjekter ?? []);
  const [fritekst, setFritekst] = useState<string>(lagret.fritekst ?? "");
  const [slettMål, setSlettMål] = useState<ListeRad | null>(null);
  const [antallVist, setAntallVist] = useState(50);

  // Persister filtervalget (huskes på tvers av navigasjon — TILLEGG 2 punkt 2).
  useEffect(() => {
    skrivLagretFilter({ periode, fraEgen, tilEgen, datoSok, statusFilter, valgteProsjekter, fritekst });
  }, [periode, fraEgen, tilEgen, datoSok, statusFilter, valgteProsjekter, fritekst]);

  // Effektivt dato-vindu: en valgt enkeltdato vinner over perioden.
  const { fra, til } = useMemo(
    () => (datoSok ? { fra: datoSok, til: datoSok } : mineTimerIntervall(periode, new Date(), fraEgen, tilEgen)),
    [datoSok, periode, fraEgen, tilEgen],
  );

  // hentForTimer (Fase 2 / T.10): inkluderer interne prosjekter så navn på
  // ikke-prosjekt-tid-rader resolver i lista (hentMine ville utelatt dem).
  const { data: prosjekter } = trpc.prosjekt.hentForTimer.useQuery({
    organizationId: orgId,
  });
  const prosjektListe = (prosjekter ?? []) as Array<{
    id: string;
    name: string;
    internalProjectNumber?: string | null;
  }>;
  const prosjektNavnMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of prosjektListe) m.set(p.id, p.name);
    return m;
  }, [prosjektListe]);

  // Kenneth-vedtak 2026-10-09 (2): «Ny dagsseddel» deaktiveres hvis ikke ansatt i firmaet.
  const { data: ansattStatus } = trpc.timer.dagsseddel.kanFoereTimer.useQuery({
    organizationId: orgId,
  });
  const kanFoereTimer = ansattStatus?.kanFoere ?? true;
  const ansattFirmanavn = ansattStatus?.firmanavn ?? valgtFirma?.name ?? "";
  // TILLEGG (14): sitedoc_admin uten ansettelse i valgt firma → varsel i stedet
  // for tom liste, med lenke til firmaets brukerfane (impersonering).
  const varsleSkjulteTimer = skalVarsleSkjulteTimer({
    rolle: erSitedocAdmin ? "sitedoc_admin" : null,
    erAnsatt: ansattStatus?.kanFoere,
  });

  const { data: rader, isLoading } = trpc.timer.dagsseddel.list.useQuery({
    fra,
    til,
    organizationId: orgId,
  });

  const slett = trpc.timer.dagsseddel.slett.useMutation({
    onSuccess: () => {
      setSlettMål(null);
      utils.timer.dagsseddel.list.invalidate();
    },
  });

  const alleRader = (rader as unknown as ListeRad[] | undefined) ?? [];

  // Klient-side filtrering (TILLEGG 3): status + prosjekt(er) + fritekst. Dato-vinduet
  // er allerede avgrenset server-side via fra/til.
  const liste = useMemo(() => {
    const q = fritekst.trim().toLowerCase();
    return alleRader.filter((r) => {
      if (statusFilter !== "alle" && r.status !== statusFilter) return false;
      if (valgteProsjekter.length > 0 && !r.prosjektIder.some((id) => valgteProsjekter.includes(id)))
        return false;
      if (q) {
        const prosjektTreff = r.prosjektIder.some((id) => {
          const p = prosjektListe.find((x) => x.id === id);
          return (
            p &&
            (p.name.toLowerCase().includes(q) ||
              (p.internalProjectNumber ?? "").toLowerCase().includes(q))
          );
        });
        const beskrivelseTreff = (r.timer ?? []).some((rad) =>
          (rad.beskrivelse ?? "").toLowerCase().includes(q),
        );
        if (!prosjektTreff && !beskrivelseTreff) return false;
      }
      return true;
    });
  }, [alleRader, statusFilter, valgteProsjekter, fritekst, prosjektListe]);

  // w2: dd.mm. som i attesteringen — året står med når lista spenner over flere år.
  const listeMedAar = useMemo(() => spennerFlereAar(liste.map((r) => r.dato)), [liste]);

  // S1 (plan § 8.22, Kenneth 2026-11-21): bare utkast kan slettes — en returnert dag rettes
  // og sendes på nytt. Serveren håndhever samme regel (`dagsseddel.slett`).
  const kanSlettes = (r: ListeRad) => r.status === "draft";

  // D8 (web-paritet 2026-07-09): kladd-påminnelse — usendte drafts MED innhold
  // fra TIDLIGERE dager (mobil `DagsseddelListe` UF-3). Periode-UAVHENGIG: egen
  // query uten fra/til så en glemt kladd utenfor valgt periode fortsatt fanges.
  // Dagens egen draft maser ikke (kun dato < i dag). Lenker til eldste.
  const { data: draftRader } = trpc.timer.dagsseddel.list.useQuery({
    status: "draft",
    organizationId: orgId,
  });
  const usendteKladder = useMemo(() => {
    const iDag = lokalIsoDato(new Date());
    return ((draftRader as unknown as ListeRad[] | undefined) ?? [])
      .filter((r) => r.antallRader > 0 && datoIso(r.dato) < iDag)
      .sort((a, b) => datoIso(b.dato).localeCompare(datoIso(a.dato)));
  }, [draftRader]);
  const eldsteKladd = usendteKladder[usendteKladder.length - 1];

  const oppsummering = useMemo(() => {
    const totalt = liste.reduce((s, r) => s + r.totaltimer, 0);
    const antallSedler = liste.length;
    const prosjektIder = new Set(liste.flatMap((r) => r.prosjektIder));
    const aktivitetIder = new Set(
      liste.map((r) => r.aktivitet?.id).filter((x): x is string => !!x),
    );
    return {
      totalt,
      antallSedler,
      antallProsjekter: prosjektIder.size,
      antallAktiviteter: aktivitetIder.size,
    };
  }, [liste]);

  const perAktivitet = useMemo(() => {
    const m = new Map<string, { navn: string; timer: number }>();
    for (const r of liste) {
      const navn = r.aktivitet?.navn ?? "—";
      const id = r.aktivitet?.id ?? "_ukjent";
      const eks = m.get(id);
      if (eks) eks.timer += r.totaltimer;
      else m.set(id, { navn, timer: r.totaltimer });
    }
    const arr = Array.from(m.values()).sort((a, b) => b.timer - a.timer);
    return arr;
  }, [liste]);

  const perStatus = useMemo(() => {
    const m = new Map<string, { antall: number; timer: number }>();
    for (const r of liste) {
      const eks = m.get(r.status);
      if (eks) {
        eks.antall += 1;
        eks.timer += r.totaltimer;
      } else {
        m.set(r.status, { antall: 1, timer: r.totaltimer });
      }
    }
    return Array.from(m.entries()).map(([status, v]) => ({
      status,
      antall: v.antall,
      timer: v.timer,
    }));
  }, [liste]);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {t("timer.mine.tittel")}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t("timer.mine.beskrivelse")}
          </p>
        </div>
        {/* w2 (B1): «+ Registrer timer» i prosjektkort-modus; dagskort-modus beholder
            «Ny dagsseddel» + skjemaet. Deaktivert (synlig) hvis ikke ansatt (2026-10-09 (2)). */}
        <div className="flex items-start gap-1">
          {/* SL2 (B78 ja): «Slettet og korrigert» for egne dager, på perioden lista står i. */}
          <Link
            href={`/dashbord/timer/mine/slettet-korrigert?${new URLSearchParams({ fra, til }).toString()}`}
            className="mr-2 self-center whitespace-nowrap text-sm text-blue-600 hover:underline"
          >
            {t("timer.slettetKorrigert.lenke")}
          </Link>
          <RegistrerTimerKnapp
            organizationId={orgId ?? null}
            projectId={aktivProsjektId}
            retur={MINE_TIMER_STI}
            dato={standardRegistrerDato({ naa: new Date(), valgtDato: datoSok || null })}
          />
          <HjelpKnapp>
            <HjelpFane tittel={t("timer.mine.tittel")}>
              <p>{t("timer.mine.hjelp.registrer")}</p>
              <p className="mt-2">{t("timer.mine.hjelp.velgDato")}</p>
              <p className="mt-2">{t("timer.mine.hjelp.dagen")}</p>
              <p className="mt-2">{t("timer.mine.hjelp.ferdig")}</p>
              <p className="mt-2">{t("timer.mine.hjelp.skjema")}</p>
              <p className="mt-2">{t("timer.mine.hjelp.dato")}</p>
              <p className="mt-2">{t("timer.mine.hjelp.reise")}</p>
              <p className="mt-2">{t("timer.mine.hjelp.reiseStartIJobb")}</p>
              <p className="mt-2">{t("timer.mine.hjelp.reiseSluttIJobb")}</p>
              <p className="mt-2">{t("timer.mine.hjelp.korrigert")}</p>
            </HjelpFane>
          </HjelpKnapp>
        </div>
      </div>

      {!kanFoereTimer && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {t("timer.ikkeAnsatt", { firma: ansattFirmanavn })}
        </div>
      )}

      {/* D8: kladd-påminnelse — usendte drafts fra tidligere dager (mobil UF-3). */}
      {eldsteKladd && (
        <Link
          href={medRetur(`/dashbord/timer/${eldsteKladd.id}`, MINE_TIMER_STI)}
          className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 hover:bg-amber-100"
        >
          <Info className="h-4 w-4 shrink-0 text-amber-700" />
          <span className="flex-1 text-sm text-amber-800">
            {t("timer.kladdPaaminnelse", { antall: usendteKladder.length })}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-amber-700" />
        </Link>
      )}

      {/* Periode-velger + hurtigvalg (TILLEGG 3). En valgt enkeltdato (under) overstyrer. */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
        {PERIODER.map((p) => (
          <button
            key={p}
            onClick={() => {
              setPeriode(p);
              setDatoSok(""); // bytte periode nullstiller enkeltdato-søket
            }}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              periode === p && !datoSok
                ? "bg-sitedoc-primary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {t(`timer.mine.periode.${p}`)}
          </button>
        ))}
        {periode === "egendefinert" && !datoSok && (
          <div className="ml-2 flex items-center gap-2">
            <Input
              type="date"
              value={fraEgen}
              onChange={(e) => setFraEgen(e.target.value)}
              className="w-40"
            />
            <span className="text-sm text-gray-500">–</span>
            <Input
              type="date"
              value={tilEgen}
              onChange={(e) => setTilEgen(e.target.value)}
              className="w-40"
            />
          </div>
        )}
      </div>

      {/* Filter-rad: enkeltdato-søk · status · prosjekt(er) · fritekst (TILLEGG 3) */}
      <div className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            {t("timer.mine.filter.dato")}
          </label>
          <Input
            type="date"
            value={datoSok}
            onChange={(e) => setDatoSok(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            {t("timer.kol.status")}
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusValg)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {STATUS_VALG.map((s) => (
              <option key={s} value={s}>
                {s === "alle" ? t("timer.mine.filter.alleStatuser") : t(`timer.statusType.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <MultiComboks
            label={t("timer.mine.filter.prosjekt")}
            options={prosjektListe.map((p) => ({
              id: p.id,
              name: p.internalProjectNumber ? `${p.internalProjectNumber} — ${p.name}` : p.name,
            }))}
            valgte={valgteProsjekter}
            onToggle={(id) =>
              setValgteProsjekter((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }
            placeholderSok={t("timer.mine.filter.sokProsjekt")}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            {t("timer.mine.filter.fritekst")}
          </label>
          <Input
            type="text"
            value={fritekst}
            onChange={(e) => setFritekst(e.target.value)}
            placeholder={t("timer.mine.filter.fritekstPlaceholder")}
          />
        </div>
      </div>

      {/* Oppsummerings-kort */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OppsummeringKort
          ikon={<Clock className="h-4 w-4 text-blue-600" />}
          label={t("timer.mine.totaltTimer")}
          verdi={`${visTimerTall(oppsummering.totalt)} t`}
        />
        <OppsummeringKort
          ikon={<FileText className="h-4 w-4 text-purple-600" />}
          label={t("timer.mine.antallSedler")}
          verdi={String(oppsummering.antallSedler)}
        />
        <OppsummeringKort
          ikon={<Briefcase className="h-4 w-4 text-amber-600" />}
          label={t("timer.mine.antallProsjekter")}
          verdi={String(oppsummering.antallProsjekter)}
        />
        <OppsummeringKort
          ikon={<Activity className="h-4 w-4 text-green-600" />}
          label={t("timer.mine.antallAktiviteter")}
          verdi={String(oppsummering.antallAktiviteter)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : liste.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          {varsleSkjulteTimer && orgId ? (
            <>
              <p className="text-sm text-gray-500">
                {t("timer.mine.skjultForAdmin", { firma: ansattFirmanavn })}
              </p>
              <Link
                href={medRetur(`/dashbord/admin/firmaer/${orgId}?fane=brukere`, "/dashbord/timer/mine")}
                className="mt-2 inline-block text-sm text-blue-600 hover:underline"
              >
                {t("timer.mine.gaaTilBrukere", { firma: ansattFirmanavn })}
              </Link>
            </>
          ) : (
            <p className="text-sm text-gray-500">{t("timer.mine.ingenSedler")}</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Per aktivitet */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">
              {t("timer.mine.perAktivitet")}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {perAktivitet.map((a) => (
                  <tr key={a.navn} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-1.5 text-gray-700">{a.navn}</td>
                    <td className="py-1.5 text-right font-mono text-gray-900">
                      {visTimerTall(a.timer)} t
                    </td>
                    <td className="py-1.5 pl-2 text-right text-xs text-gray-500">
                      {oppsummering.totalt > 0
                        ? `${((a.timer / oppsummering.totalt) * 100).toFixed(0)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Per status */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">
              {t("timer.mine.perStatus")}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {perStatus.map((s) => (
                  <tr key={s.status} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-1.5 text-gray-700">
                      {t(`timer.statusType.${s.status}`)}
                    </td>
                    <td className="py-1.5 text-right text-gray-600">{s.antall}</td>
                    <td className="py-1.5 pl-2 text-right font-mono text-gray-900">
                      {visTimerTall(s.timer)} t
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Detaljliste */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-3">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">
              {t("timer.mine.alleSedler")}
            </h2>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left">{t("timer.kol.dato")}</th>
                  <th className="px-2 py-2 text-left">{t("timer.mine.kol.prosjekt")}</th>
                  <th className="px-2 py-2 text-left">{t("timer.kol.aktivitet")}</th>
                  <th className="px-2 py-2 text-right">{t("timer.kol.timer")}</th>
                  <th className="px-2 py-2 text-left">{t("timer.kol.status")}</th>
                  <th className="px-2 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {liste.slice(0, antallVist).map((rad) => (
                  <tr
                    key={rad.id}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="px-2 py-1.5 font-medium text-gray-900">
                      {visDagDato(rad.dato, listeMedAar)}
                    </td>
                    <td className="px-2 py-1.5 text-gray-700">
                      {rad.prosjektIder
                        .map((id) => prosjektNavnMap.get(id))
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-2 py-1.5 text-gray-600">
                      {rad.aktivitet?.navn ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-gray-900">
                      {visTimerTall(rad.totaltimer)}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-500">
                      {t(`timer.statusType.${rad.status}`)}
                      <KorrigertAvDag korrigertAv={rad.korrigertAv} />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={medRetur(`/dashbord/timer/${rad.id}`, MINE_TIMER_STI)}
                          className="text-sm font-medium text-sitedoc-primary hover:underline"
                        >
                          {t("timer.aapne")}
                        </Link>
                        {kanSlettes(rad) && (
                          <button
                            onClick={() => setSlettMål(rad)}
                            className="text-gray-400 hover:text-red-600"
                            title={t("timer.detalj.slett")}
                            aria-label={t("timer.detalj.slett")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {liste.length > antallVist && (
              <div className="mt-3 text-center">
                <Button variant="secondary" onClick={() => setAntallVist((n) => n + 50)}>
                  {t("timer.mine.visMer", { antall: liste.length - antallVist })}
                </Button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Slett-bekreftelse (CLAUDE.md § Slett-bekreftelse — modal, ikke confirm()). */}
      {slettMål && (
        <SlettDagModal
          sheetId={slettMål.id}
          overskrift={t("timer.slettDag.ingressDato", { dato: formatDato(slettMål.dato) })}
          onClose={() => {
            setSlettMål(null);
            slett.reset();
          }}
          onBekreft={() => slett.mutate({ id: slettMål.id })}
          sletter={slett.isPending}
          feil={slett.error?.message ?? null}
        />
      )}
    </div>
  );
}

function OppsummeringKort({
  ikon,
  label,
  verdi,
}: {
  ikon: React.ReactNode;
  label: string;
  verdi: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2">
        {ikon}
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{verdi}</p>
    </div>
  );
}
