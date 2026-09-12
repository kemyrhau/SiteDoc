"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Button, Spinner } from "@sitedoc/ui";
import { Lock, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";

/**
 * «Hent fra arkiv» — grensesnittet mellom prosjekt, firma og SiteDoc-sentralarkiv
 * (ordre hent-fra-arkiv-fabel 2026-09-12, mockup fasit for layout/tekster).
 *
 * To faner, synlighet fra rettighetsmatrisen (`autoriserMalTilgang`):
 *  - Firmaarkiv:   prosjektadmin+ henter en KOPI ned i prosjektet (`kopierTilProsjekt`).
 *  - SiteDoc-arkiv: firmaadmin+ henter en kopi opp i FIRMAARKIVET (`laanFraSentralarkiv`);
 *                   prosjektadmin ser en LÅST fane — lån kun fra nivået rett over.
 *
 * 🔴 KLIENT-GATE, IKKE SERVER-GATE: `bibliotek.hentStandarder` er IKKE strammet med
 * sitedoc/les server-side denne runden (Krav 5 — egen runde, sammen med lånet). Synlighet
 * gates her i klienten via `firmamal.arkivTilgang`, som er ENESTE gate-kilde (fabel-vilkår).
 * Sentralarkiv-innholdet (NS 3420-maler) er ikke sensitivt, så klient-gate er akseptabel
 * mellomlanding. Server-gate hentStandarder med sitedoc/les = egen runde.
 */

type ArkivFane = "oppgave" | "sjekkliste" | "hms";

interface HentFraArkivModalProps {
  projectId: string;
  /** Filtrerer firmaarkiv-fanen per kategori. Utelatt (prosjektsiden) = alle. */
  fane?: ArkivFane;
  open: boolean;
  onClose: () => void;
  onImportert: () => void;
}

export function HentFraArkivModal({
  projectId,
  fane,
  open,
  onClose,
  onImportert,
}: HentFraArkivModalProps) {
  const { t } = useTranslation();
  const [aktivFane, setAktivFane] = useState<"firma" | "sitedoc">("firma");
  const [feil, setFeil] = useState<string | null>(null);
  // Lokal «hentet»-markering per rad — modalen holdes åpen så flere kan hentes (mockup).
  const [hentetFirma, setHentetFirma] = useState<Set<string>>(new Set());
  const [hentetSitedoc, setHentetSitedoc] = useState<Set<string>>(new Set());
  const [aktivRad, setAktivRad] = useState<string | null>(null);

  const tilgang = trpc.firmamal.arkivTilgang.useQuery(
    { projectId },
    { enabled: open },
  );
  const kanSitedoc = tilgang.data?.kanHenteFraSitedoc ?? false;
  const organizationId = tilgang.data?.organizationId ?? null;

  const firmamaler = trpc.firmamal.listeForProsjekt.useQuery(
    { projectId, fane },
    { enabled: open && aktivFane === "firma" },
  );

  // Sentralarkivet lastes bare når firmaadmin+ faktisk åpner den fanen (klient-gate).
  const standarder = trpc.bibliotek.hentStandarder.useQuery(undefined, {
    enabled: open && aktivFane === "sitedoc" && kanSitedoc,
  });

  const kopierMutation = trpc.firmamal.kopierTilProsjekt.useMutation({
    onSuccess: (_res, variabler) => {
      setHentetFirma((s) => new Set(s).add(variabler.organizationTemplateId));
      onImportert();
    },
    onError: (e) => setFeil(e.message),
    onSettled: () => setAktivRad(null),
  });

  const laanMutation = trpc.firmamal.laanFraSentralarkiv.useMutation({
    onSuccess: (_res, variabler) => {
      setHentetSitedoc((s) => new Set(s).add(variabler.bibliotekMalId));
    },
    onError: (e) => setFeil(e.message),
    onSettled: () => setAktivRad(null),
  });

  // Eksplisitte former bryter den dype tRPC-unionen (TS2589 på kald bygg) FØR .map
  // treffer JSX — se feedback_kald_bygg_ts2589.
  type FirmaMal = {
    id: string;
    name: string;
    domain: string;
    version: number;
    _count: { objects: number };
  };
  type SentralMal = { id: string; navn: string; referanse: string; versjon: string };
  type SentralKapittel = { id: string; kode: string; navn: string; maler: SentralMal[] };
  type SentralStandard = { id: string; kode: string; kapitler: SentralKapittel[] };

  const firmaListe = (firmamaler.data ?? []) as FirmaMal[];
  const sentralStandarder = (standarder.data ?? []) as SentralStandard[];

  function byggFirmaRad(fm: FirmaMal): ArkivRad {
    return {
      id: fm.id,
      navn: fm.name,
      meta: [
        t("maler.arkiv.kildeFirma"),
        t(`maler.domain.${fm.domain}`),
        `v${fm.version}`,
        t("maler.firmaarkiv.punkter", { antall: fm._count.objects }),
      ].join(" · "),
      hentet: hentetFirma.has(fm.id),
      laster: kopierMutation.isPending && aktivRad === fm.id,
      hentTekst: t("maler.arkiv.hentKopi"),
      hentetTekst: t("maler.arkiv.hentetTilProsjekt"),
      onHent: () => {
        setAktivRad(fm.id);
        setFeil(null);
        kopierMutation.mutate({ organizationTemplateId: fm.id, projectId });
      },
    };
  }

  function byggSitedocRad(m: SentralMal): ArkivRad {
    return {
      id: m.id,
      navn: m.navn,
      meta: [t("maler.arkiv.kildeSitedoc"), m.referanse, `v${m.versjon}`].join(" · "),
      hentet: hentetSitedoc.has(m.id),
      laster: laanMutation.isPending && aktivRad === m.id,
      hentTekst: t("maler.arkiv.hentKopiTilFirma"),
      hentetTekst: t("maler.arkiv.hentetTilFirma"),
      deaktivert: !organizationId,
      onHent: () => {
        if (!organizationId) return;
        setAktivRad(m.id);
        setFeil(null);
        laanMutation.mutate({ organizationId, bibliotekMalId: m.id });
      },
    };
  }

  // Firmaarkiv har ingen kapittelkobling (OrganizationTemplate mangler den). Grupperer
  // derfor på fagområde (domain) — den eneste ekte akselen i dataene (meldt i rapport).
  const firmaDomener = [...new Set(firmaListe.map((fm) => fm.domain))];
  const firmaGrupper: ArkivGruppe[] = firmaDomener.map((domain) => ({
    key: domain,
    tittel: t(`maler.domain.${domain}`),
    rader: firmaListe.filter((fm) => fm.domain === domain).map(byggFirmaRad),
  }));

  // SiteDoc-arkivet: nøstet standard → kapittel finnes allerede i dataene. Viser
  // kapitteloverskrifter (Kenneth-funn) så 20-30 kapitler ikke blir én lang, flat liste.
  const sitedocGrupper: ArkivGruppe[] = sentralStandarder.flatMap((s) =>
    s.kapitler
      .filter((k) => k.maler.length > 0)
      .map((k) => ({
        key: k.id,
        tittel: `${s.kode} · ${k.kode} ${k.navn}`,
        rader: k.maler.map(byggSitedocRad),
      })),
  );
  const sitedocAntall = sitedocGrupper.reduce((n, g) => n + g.rader.length, 0);

  function faneKnapp(id: "firma" | "sitedoc", label: string, laast: boolean) {
    const aktiv = aktivFane === id;
    return (
      <button
        type="button"
        onClick={() => {
          setAktivFane(id);
          setFeil(null);
        }}
        className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
          aktiv
            ? "border-sitedoc-primary font-semibold text-sitedoc-primary"
            : "border-transparent font-medium text-gray-500 hover:text-gray-700"
        }`}
      >
        {label}
        {laast && <Lock className="h-3.5 w-3.5 text-gray-400" />}
      </button>
    );
  }

  const visLaastPanel = aktivFane === "sitedoc" && !tilgang.isLoading && !kanSitedoc;

  return (
    <Modal open={open} onClose={onClose} title={t("maler.arkiv.tittel")} className="max-w-2xl">
      <p className="-mt-2 mb-3 text-sm text-gray-500">{t("maler.arkiv.undertittel")}</p>

      {/* Faner */}
      <div className="flex gap-1 border-b border-gray-200">
        {faneKnapp("firma", t("maler.arkiv.faneFirmaarkiv"), false)}
        {faneKnapp("sitedoc", t("maler.arkiv.faneSitedoc"), !kanSitedoc)}
      </div>

      {feil && <p className="mt-3 text-sm text-red-600">{feil}</p>}

      {/* Låst SiteDoc-fane (prosjektadmin) — forklaring, ikke død hengelås (mockup bilde-3) */}
      {visLaastPanel ? (
        <div className="px-6 py-10 text-center">
          <Lock className="mx-auto h-6 w-6 text-gray-400" />
          <p className="mt-2 text-sm font-semibold text-gray-700">
            {t("maler.arkiv.laastTittel")}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            {t("maler.arkiv.laastForklaring")}
          </p>
        </div>
      ) : (
        <div className="mt-3">
          {/* Firmaarkiv-fanen — gruppert på fagområde */}
          {aktivFane === "firma" && (
            <ArkivListe
              laster={firmamaler.isLoading}
              tom={firmaListe.length === 0}
              tomTekst={t("maler.arkiv.ingenFirma")}
              grupper={firmaGrupper}
              fotnote={
                kanSitedoc
                  ? t("maler.arkiv.fotFirmaRediger")
                  : t("maler.arkiv.fotFirmaLes")
              }
            />
          )}

          {/* SiteDoc-arkiv-fanen (firmaadmin+) — gruppert på standard → kapittel */}
          {aktivFane === "sitedoc" && kanSitedoc && (
            <ArkivListe
              laster={standarder.isLoading}
              tom={sitedocAntall === 0}
              tomTekst={t("maler.arkiv.ingenSitedoc")}
              grupper={sitedocGrupper}
              fotnote={t("maler.arkiv.fotSitedoc")}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  ArkivListe — felles rad-liste for begge faner                      */
/* ------------------------------------------------------------------ */

type ArkivRad = {
  id: string;
  navn: string;
  meta: string;
  hentet: boolean;
  laster: boolean;
  deaktivert?: boolean;
  hentTekst: string;
  hentetTekst: string;
  onHent: () => void;
};

type ArkivGruppe = { key: string; tittel: string; rader: ArkivRad[] };

function ArkivRadElement({ r }: { r: ArkivRad }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-gray-200 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-900">{r.navn}</div>
        <div className="truncate text-xs text-gray-400">{r.meta}</div>
      </div>
      {r.hentet ? (
        <span className="flex flex-shrink-0 items-center gap-1 text-sm font-medium text-sitedoc-success">
          <Check className="h-4 w-4" />
          {r.hentetTekst}
        </span>
      ) : (
        <Button variant="secondary" onClick={r.onHent} loading={r.laster} disabled={r.deaktivert}>
          {r.hentTekst}
        </Button>
      )}
    </li>
  );
}

function ArkivListe({
  laster,
  tom,
  tomTekst,
  grupper,
  fotnote,
}: {
  laster: boolean;
  tom: boolean;
  tomTekst: string;
  grupper: ArkivGruppe[];
  fotnote: string;
}) {
  if (laster) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (tom) {
    return <p className="py-8 text-center text-sm text-gray-500">{tomTekst}</p>;
  }
  // Overskrifter kun når det er mer enn én gruppe — én gruppe (typisk firmaarkiv med ett
  // fagområde) trenger ingen overskrift, men SiteDoc-arkivets mange kapitler gjør (Krav 6).
  const visOverskrifter = grupper.length > 1;
  return (
    <>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto">
        {grupper.map((g) => (
          <div key={g.key}>
            {visOverskrifter && (
              <h4 className="sticky top-0 bg-white pb-1 pt-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {g.tittel}
              </h4>
            )}
            <ul className="space-y-2">
              {g.rader.map((r) => (
                <ArkivRadElement key={r.id} r={r} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">{fotnote}</p>
    </>
  );
}
