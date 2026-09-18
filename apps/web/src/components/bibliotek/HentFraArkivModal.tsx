"use client";

import { useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Modal, Button, Spinner, Input } from "@sitedoc/ui";
import { Lock, Check, Search, ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FaggruppeTilknytningModal } from "@/app/dashbord/oppsett/produksjon/_components/FaggruppeTilknytningModal";
import {
  byggKildeIndeks,
  byggSitedocGrupper,
  byggUnderkapittelBlokker,
  filtrerOgFold,
  grupperFirmaMaler,
  type ArkivFane,
  type FoldetGruppe,
  type MedKapittel,
} from "./arkiv-fane-filter";
import {
  flytvalgHandling,
  skalTilbyFlytvalg,
  type FlytvalgUtgang,
} from "./flytvalg-etter-hent";

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
  // Søk over BEGGE faner (Krav 1) — ligger over fanene, deles av dem.
  const [sok, setSok] = useState("");
  // Kollaps per fane, økt-tilstand (L2). Tom = alt sammenslått (Krav 2: sammenslått start).
  // Standard-nivå (Kenneths «kapittel») starter sammenslått.
  const [utfoldedeFirma, setUtfoldedeFirma] = useState<Set<string>>(new Set());
  const [utfoldedeSitedoc, setUtfoldedeSitedoc] = useState<Set<string>>(new Set());
  // Underkapittel-overskrifter (>= terskel) starter ÅPNE (Kenneth-vedtak a) — settet holder
  // dem brukeren har LUKKET. Egen dimensjon per fane.
  const [lukkedeUnderFirma, setLukkedeUnderFirma] = useState<Set<string>>(new Set());
  const [lukkedeUnderSitedoc, setLukkedeUnderSitedoc] = useState<Set<string>>(new Set());
  // Flytvalg-steg (Kenneth 2026-09-18): satt til den nettopp hentede prosjektmalen når
  // steget skal tilbys. null = ikke aktivt. Kun firma-hent (lager prosjektmal).
  const [flytvalgFor, setFlytvalgFor] = useState<{
    malId: string;
    kategori: "oppgave" | "sjekkliste";
  } | null>(null);

  function lukk() {
    setSok("");
    onClose();
  }

  const tilgang = trpc.firmamal.arkivTilgang.useQuery(
    { projectId },
    { enabled: open },
  );
  const kanSitedoc = tilgang.data?.kanHenteFraSitedoc ?? false;
  // rediger-signalene gjør bunntekstene til KLIKKBARE veier (TILLEGG 1). Serveren svarer
  // fra samme matrise — ingen rollelogikk her. les ≠ rediger, så disse er egne felt.
  const kanRedigereFirma = tilgang.data?.kanRedigereFirma ?? false;
  const kanRedigereSitedoc = tilgang.data?.kanRedigereSitedoc ?? false;
  const organizationId = tilgang.data?.organizationId ?? null;

  const firmamaler = trpc.firmamal.listeForProsjekt.useQuery(
    { projectId, fane },
    { enabled: open && aktivFane === "firma" },
  );

  // Sentralarkivet lastes når SiteDoc-fanen åpnes (firmaadmin+, klient-gate) ELLER når
  // firmaarkiv-fanen er aktiv: firma-grupperingen utleder kapittel fra kilden via denne
  // (Krav 2). `hentStandarder` er uten server-gate og innholdet (NS 3420-K) er ikke
  // sensitivt, så oppslaget er trygt også for prosjektadmin — det brukes kun til å
  // navngi grupper, ikke til å eksponere lån.
  const standarder = trpc.bibliotek.hentStandarder.useQuery(undefined, {
    enabled: open && (aktivFane === "firma" || (aktivFane === "sitedoc" && kanSitedoc)),
  });

  // Prosjektets dokumentflyter — brukes bare til å avgjøre OM flytvalg-steget skal
  // tilbys etter hent (tomt prosjekt → skjul steget). Selve velgeren henter på nytt.
  const flyter = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId },
    { enabled: open },
  );

  // Knytter en nettopp hentet prosjektmal til valgte flyter. Gjenbruker den etablerte
  // skriveveien (erstatter koblingssettet); en fersk mal har ingen fra før, så det blir
  // et rent tillegg. Ingen endring av selve henten eller DokumentflytMal-skjemaet.
  const knyttFlytMutation = trpc.mal.oppdaterMal.useMutation({
    onSuccess: () => onImportert(),
    onError: (e) => setFeil(e.message),
  });

  const kopierMutation = trpc.firmamal.kopierTilProsjekt.useMutation({
    onSuccess: (res, variabler) => {
      setHentetFirma((s) => new Set(s).add(variabler.organizationTemplateId));
      onImportert();
      // Tilby flytvalg for den nye prosjektmalen — kun oppgave/sjekkliste (HMS er flyt-løs)
      // og kun når prosjektet faktisk har minst én flyt å velge.
      const hentet = (firmamaler.data as FirmaMal[] | undefined)?.find(
        (m) => m.id === variabler.organizationTemplateId,
      );
      const kategori = hentet?.category;
      if (
        res?.id &&
        (kategori === "oppgave" || kategori === "sjekkliste") &&
        skalTilbyFlytvalg({ antallFlyter: flyter.data?.length ?? 0, kategori })
      ) {
        setFlytvalgFor({ malId: res.id, kategori });
      }
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
    // Dokument-form: gater flytvalg-steget etter hent (HMS-maler er flyt-løse).
    category: "oppgave" | "sjekkliste" | "hms";
    version: number;
    // Avstamning til SiteDoc-sentralmalen (schema.prisma:1145) — bærer kapittelet når
    // malen er lånt. null = egenlagd firmamal (Krav 2).
    laantFraBibliotekMalId: string | null;
    _count: { objects: number };
  };
  type SentralMal = {
    id: string;
    navn: string;
    referanse: string;
    versjon: string;
    kategori: string;
    domene: string;
  };
  type SentralKapittel = { kode: string; navn: string; maler: SentralMal[] };
  type SentralStandard = { kode: string; navn: string; kapitler: SentralKapittel[] };

  const firmaListe = (firmamaler.data ?? []) as FirmaMal[];
  const sentralStandarder = (standarder.data ?? []) as SentralStandard[];
  // Kilde-indeks: bibliotekMalId → kapittel. Utleder firmamalens gruppe fra lånet (Krav 2)
  // og gir den arvede referansen som firma-søket også treffer på.
  const kildeIndeks = byggKildeIndeks(sentralStandarder);

  function byggFirmaRad(fm: FirmaMal & MedKapittel): ArkivRad {
    const kildeRef = fm.laantFraBibliotekMalId
      ? kildeIndeks.get(fm.laantFraBibliotekMalId)?.referanse
      : undefined;
    return {
      id: fm.id,
      navn: fm.name,
      kapittelKode: fm.kapittelKode,
      kapittelNavn: fm.kapittelNavn,
      // Søket treffer navn + arvet referanse (Krav 1) — firmamaler har ingen egen referanse.
      sok: [fm.name, kildeRef].filter(Boolean).join(" ").toLowerCase(),
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

  function byggSitedocRad(m: SentralMal & MedKapittel): ArkivRad {
    return {
      id: m.id,
      navn: m.navn,
      kapittelKode: m.kapittelKode,
      kapittelNavn: m.kapittelNavn,
      sok: [m.navn, m.referanse].join(" ").toLowerCase(),
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

  // SAMME modell i begge faner (Del C): kollaps på STANDARD, kapittel som underetikett,
  // «Egenlagde» som egen gruppe, sammenslått start. Firmaarkivet utleder standard/kapittel
  // fra lånet via kilde-indeksen.
  const firmaGrupper: ArkivGruppe[] = grupperFirmaMaler(
    firmaListe,
    kildeIndeks,
    t("maler.arkiv.gruppeEgenlagde"),
  ).map((g) => ({ key: g.key, tittel: g.tittel, rader: g.maler.map(byggFirmaRad) }));

  // SiteDoc-arkivet: typefilter per flate (Krav 3) kjøres FØR gruppering, så søket aldri
  // kan omgå det. Standarder som tømmes av filteret faller bort.
  const sitedocGrupper: ArkivGruppe[] = byggSitedocGrupper(sentralStandarder, fane).map((g) => ({
    key: g.key,
    tittel: g.tittel,
    rader: g.maler.map(byggSitedocRad),
  }));

  // Søk + kollaps, felles primitiv (Krav 1): treff folder ut sammenslåtte grupper.
  const firmaFoldet = filtrerOgFold(firmaGrupper, sok, utfoldedeFirma);
  const sitedocFoldet = filtrerOgFold(sitedocGrupper, sok, utfoldedeSitedoc);

  // Tom-tilstanden skal si HVORFOR den er tom (TILLEGG 2), ellers leses innholdsgapet som
  // en bug. Seks kombinasjoner (tre flater × to faner):
  //  - SiteDoc-fanen, en flate som er tom: fast fasit — arkivet er i dag KUN NS 3420-K
  //    sjekklistemaler (målt: alle 17 seed-maler er kategori=sjekkliste/domene=kvalitet).
  //    Ordet «i dag» sier at tilstanden er midlertidig, ikke at funksjonen mangler.
  //  - Firmaarkiv-fanen, tom: firmaet har ikke lånt inn den typen ennå. Peker videre.
  //    For prosjektadmin (kanSitedoc=false) er SiteDoc-fanen låst, så teksten peker IKKE
  //    dit — den navngir hvem som henter inn i stedet (TILLEGG 3).
  const sitedocTomTekstBase = fane
    ? t("maler.arkiv.ingenSitedocForklart")
    : t("maler.arkiv.ingenSitedoc");
  const firmaTomTekstBase = !fane
    ? t("maler.arkiv.ingenFirma")
    : kanSitedoc
      ? t("maler.arkiv.ingenFirmaForklart", { type: t(`maler.arkiv.type.${fane}`) })
      : t("maler.arkiv.ingenFirmaForklartLaast", { type: t(`maler.arkiv.type.${fane}`) });
  // Under søk uten treff vinner «ingen treff» over den (irrelevante) tom-forklaringen.
  const firmaTomTekst = firmaFoldet.harSok ? t("maler.arkiv.ingenTreff") : firmaTomTekstBase;
  const sitedocTomTekst = sitedocFoldet.harSok ? t("maler.arkiv.ingenTreff") : sitedocTomTekstBase;

  function toggle(setter: Dispatch<SetStateAction<Set<string>>>, key: string) {
    setter((prev) => {
      const neste = new Set(prev);
      if (neste.has(key)) neste.delete(key);
      else neste.add(key);
      return neste;
    });
  }

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

  // De to likestilte utgangene i flytvalg-steget. «hoppOver» knytter aldri — malen er
  // allerede hentet; steget lukkes uten kobling. «velg» knytter de valgte flytene.
  function fullforFlytvalg(utgang: FlytvalgUtgang, valgteIder: string[]) {
    if (flytvalgFor) {
      const handling = flytvalgHandling(utgang, valgteIder);
      if (handling.knytt) {
        knyttFlytMutation.mutate({ id: flytvalgFor.malId, workflowIds: handling.workflowIds });
      }
    }
    setFlytvalgFor(null);
  }

  return (
    <>
    <Modal open={open} onClose={lukk} title={t("maler.arkiv.tittel")} className="max-w-2xl">
      <p className="-mt-2 mb-3 text-sm text-gray-500">{t("maler.arkiv.undertittel")}</p>

      {/* Søk over BEGGE faner (Krav 1) — over fanene, ikke inni hver fane */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={sok}
          onChange={(e) => setSok(e.target.value)}
          placeholder={t("maler.arkiv.sokPlassholder")}
          className="pl-9"
        />
      </div>

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
          {/* Firmaarkiv-fanen — kollaps på standard; underkapittel-overskrift kun ved >= terskel */}
          {aktivFane === "firma" && (
            <ArkivListe
              laster={firmamaler.isLoading || standarder.isLoading}
              tom={firmaFoldet.synlige.length === 0}
              tomTekst={firmaTomTekst}
              grupper={firmaFoldet.synlige}
              harSok={firmaFoldet.harSok}
              onToggle={(key) => toggle(setUtfoldedeFirma, key)}
              lukkedeUnder={lukkedeUnderFirma}
              onToggleUnder={(key) => toggle(setLukkedeUnderFirma, key)}
              fotnote={
                kanRedigereFirma ? (
                  <Link
                    href="/dashbord/firma/innstillinger/malforvaltning"
                    className="text-sitedoc-primary hover:underline"
                  >
                    {t("maler.arkiv.fotFirmaRediger")}
                  </Link>
                ) : (
                  t("maler.arkiv.fotFirmaLes")
                )
              }
            />
          )}

          {/* SiteDoc-arkiv-fanen (firmaadmin+) — kollaps på standard, underkapittel kun ved >= terskel */}
          {aktivFane === "sitedoc" && kanSitedoc && (
            <ArkivListe
              laster={standarder.isLoading}
              tom={sitedocFoldet.synlige.length === 0}
              tomTekst={sitedocTomTekst}
              grupper={sitedocFoldet.synlige}
              harSok={sitedocFoldet.harSok}
              onToggle={(key) => toggle(setUtfoldedeSitedoc, key)}
              lukkedeUnder={lukkedeUnderSitedoc}
              onToggleUnder={(key) => toggle(setLukkedeUnderSitedoc, key)}
              fotnote={
                kanRedigereSitedoc ? (
                  <Link
                    href="/dashbord/firma/innstillinger/malforvaltning"
                    className="text-sitedoc-primary hover:underline"
                  >
                    {t("maler.arkiv.fotSitedocRediger")}
                  </Link>
                ) : (
                  t("maler.arkiv.fotSitedoc")
                )
              }
            />
          )}
        </div>
      )}
    </Modal>

    {/* Flytvalg rett etter hent (Kenneth 2026-09-18): to likestilte utganger — «Velg»
        knytter malen til valgte flyter, «Hopp over» lukker uten kobling. Lag oppå
        hent-modalen (z-60), som blir stående så flere maler kan hentes. */}
    {flytvalgFor && (
      <FaggruppeTilknytningModal
        open
        prosjektId={projectId}
        kategori={flytvalgFor.kategori}
        valgteWorkflowIds={new Set()}
        onBekreft={(ids) => fullforFlytvalg("velg", Array.from(ids))}
        onClose={() => fullforFlytvalg("hoppOver", [])}
        bekreftTekst={t("handling.velg")}
        avbrytTekst={t("handling.hoppOver")}
      />
    )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  ArkivListe — felles rad-liste for begge faner                      */
/* ------------------------------------------------------------------ */

type ArkivRad = {
  id: string;
  navn: string;
  /** Kapittel-etikett for underoverskrift inne i standard-gruppen (null = «Egenlagde»). */
  kapittelKode: string | null;
  kapittelNavn: string | null;
  /** Ferdig normalisert søkestreng (navn [+ referanse]) — brukes av `filtrerOgFold`. */
  sok: string;
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
  harSok,
  onToggle,
  lukkedeUnder,
  onToggleUnder,
  fotnote,
}: {
  laster: boolean;
  tom: boolean;
  tomTekst: string;
  grupper: FoldetGruppe<ArkivRad>[];
  harSok: boolean;
  onToggle: (key: string) => void;
  lukkedeUnder: Set<string>;
  onToggleUnder: (key: string) => void;
  fotnote: ReactNode;
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
  // Kollaps kun på STANDARD (Kenneths «kapittel»). Underkapittel-overskrift kun når
  // underkapittelet har >= terskel maler (Kenneth 16.09) — da er den KOLLAPSBAR og starter
  // åpen (vedtak a). Færre maler → de står løst rett under standarden, ingen overskrift.
  // Under søk er alt tvunget åpent og chevronene deaktivert (Krav 1); antallet regnes på de
  // filtrerte malene, så en overskrift forsvinner om søket tar underkapittelet under terskel.
  return (
    <>
      <div className="max-h-[55vh] space-y-2 overflow-y-auto">
        {grupper.map((g) => (
          <div key={g.key} className="rounded border border-gray-100">
            <button
              type="button"
              onClick={() => !harSok && onToggle(g.key)}
              disabled={harSok}
              className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent"
            >
              {g.apen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              )}
              <span className="min-w-0 flex-1 truncate">{g.tittel}</span>
              <span className="shrink-0 font-normal text-gray-400">· {g.rader.length}</span>
            </button>
            {g.apen && (
              <div className="space-y-2 px-2 pb-2">
                {byggUnderkapittelBlokker(g.rader, g.key).map((blokk) => {
                  if (blokk.type === "lose") {
                    return (
                      <ul key={`lose-${blokk.maler[0]?.id}`} className="space-y-2">
                        {blokk.maler.map((r) => (
                          <ArkivRadElement key={r.id} r={r} />
                        ))}
                      </ul>
                    );
                  }
                  const apen = harSok || !lukkedeUnder.has(blokk.key);
                  return (
                    <div key={blokk.key} className="rounded border border-gray-100">
                      <button
                        type="button"
                        onClick={() => !harSok && onToggleUnder(blokk.key)}
                        disabled={harSok}
                        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        {apen ? (
                          <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {blokk.kode} — {blokk.navn}
                        </span>
                        <span className="shrink-0 text-gray-400">· {blokk.maler.length}</span>
                      </button>
                      {apen && (
                        <ul className="space-y-2 px-2 pb-2">
                          {blokk.maler.map((r) => (
                            <ArkivRadElement key={r.id} r={r} />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">{fotnote}</p>
    </>
  );
}
