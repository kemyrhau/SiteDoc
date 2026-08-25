"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ArrowLeftRight, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { ruteErFirmaKontekst } from "@/lib/ruteKontekst";
import { useFavoritter } from "@/hooks/useFavoritter";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useFirma } from "@/kontekst/firma-kontekst";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { useFirmaNavElementer } from "./firma-nav";
import {
  useSidebarElementer,
  prosjektSoneElementer,
  hrefForSidebarElement,
} from "./sidebar-elementer";
// P4b: trakt-primitivene er hevet til delt kilde (gjenbrukt av
// DokumentKontekstChipLinje + P4c). Ikke re-definer lokalt.
import {
  NivåRad,
  TraktRad,
  SeksjonsLabel,
  SøkeFelt,
} from "@/components/kontekst-chip/trakt-primitiver";

type Nivå = "firma" | "prosjekt" | "byggeplass";

interface Byggeplass {
  id: string;
  name: string;
  number: number | null;
}

/** Relativ path etter kontekst-prefikset ("/dashbord/firma" eller
 * "/dashbord/{prosjektId}"). Brukes til å pare firma- og prosjekt-nav-elementer
 * på felles seksjon (timer, hms) uavhengig av prefiks. Kontekst-roten → "". */
function relativPath(href: string, prefiks: string): string {
  if (href === prefiks) return "";
  if (href.startsWith(`${prefiks}/`)) return href.slice(prefiks.length + 1);
  return href;
}

/**
 * Er ruta i FIRMA-kontekst? Alle `/dashbord/firma/*` + firmamodul-ruter som
 * ligger på TOPP-nivå utenfor det prefikset. I dag er `/dashbord/maskin` den
 * eneste (bunnelement med `kreverFirmaModul: "maskin"`, vises i FIRMA-seksjonen)
 * — cowork-verifisert; kompetanse/varelager ligger under `/dashbord/firma/*` og
 * dekkes av prefikset. Grense-sikker match (ikke løs `startsWith`) så
 * `/dashbord/maskinXYZ` ikke feilaktig treffer.
 *
 * ⚠️ FRAMTID: nye topp-nivå-firmamoduler legges til i `ruteErFirmaKontekst`
 * (delt modul `@/lib/ruteKontekst`), som Toppbar og NavSidebar deler.
 */

/**
 * KontekstChip (steg iii + K3-trakt) — samlet «{Firma} / {Prosjekt} ▾»-velger
 * bak `nyNavigasjon`-flagget. Erstatter FirmaVelger + ProsjektVelger i Toppbar.
 *
 * K3 (fabel-fasit § 3a, 2026-07-21): popoveren er en TRAKT firma → prosjekt →
 * byggeplass. Ett nivå åpent om gangen; valgte nivåer kollapser til
 * sammenfoldede rader med «Endre». Prøvestein = kundetelefonen: «jeg er i det
 * prosjektet» → slå opp firma → prosjekt → byggeplass uten å gjette. Alle tre
 * nivåer synlige samtidig (valgte foldet, aktivt åpent).
 *
 * Låste prinsipper (vedtak): firma-steget kun ved flere firmaer; firmabytte
 * nullstiller nedover (effekter i prosjekt-/byggeplass-kontekst); «Hele
 * prosjektet» default byggeplass, byggeplass-steget kun når byggeplasser
 * finnes; Alle/Mine = filter-pille (ikke egne rader); lange lister (>6) = søk
 * + «Sist brukt» øverst; popover lukkes ved prosjektvalg, byggeplass =
 * valgfritt ettervalg.
 *
 * Funn 1b: prosjekt-delen av chip-teksten viser lastetilstand når et
 * prosjektId er persistert men objektet ennå ikke er resolvet — ikke tom
 * streng, ikke «velg prosjekt» (som ville blinket ved hver fersk økt).
 */
export function KontekstChip() {
  const { t } = useTranslation();
  const { valgtFirma, kanAdministrereFirma, tilgjengelige, velgFirma } = useFirma();
  const {
    valgtProsjekt,
    prosjektId,
    lasterValgtProsjekt,
    prosjektScope,
    prosjekter,
    mineProsjekter,
    velgProsjekt,
  } = useProsjekt();
  const { aktivByggeplass, velgByggeplass } = useByggeplass();
  // ⇄-utledning: nav-elementene (begge tilgangs-/modul-filtrert i sine hooks).
  const firmaNav = useFirmaNavElementer();
  const { filtrertHovedelementer } = useSidebarElementer();
  const pathname = usePathname();
  // P1-A: samme kontekst-derivat som Toppbar (`Toppbar.tsx:50`). Chippen var
  // kontekst-blind — det var rotårsaken til firma/prosjekt-forvekslingen.
  const erFirmaKontekst = ruteErFirmaKontekst(pathname);

  // P1-B (⇄): motpart-flate — streng én-til-én-paring på det EIENDE nav-elementet
  // (lengste href-prefiks av pathname), ikke deler[3]. Motpart finnes kun når et
  // nav-element med SAMME relative path finnes i den ANDRE kontekstens nav (begge
  // tilgangs-/modul-filtrert). Slik: timer↔timer, hms↔hms; men firma/timer/rapport
  // (relpath timer/rapport, kun firma) og prosjekt/timer/attestering (relpath
  // timer/attestering, kun prosjekt) → chip UTEN ⇄. Undersider uten eget
  // nav-element (onboarding/oppsett/aktiviteter) eies av «timer» via prefiks →
  // ⇄ vises der (det ER timer-flaten). Kontekst-roten (relpath "") parer aldri.
  const pathnameNaa = pathname ?? "";
  const firmaPar = firmaNav.map((e) => ({
    relpath: relativPath(e.href, "/dashbord/firma"),
    href: e.href,
  }));
  const prosjektPrefiks = prosjektId ? `/dashbord/${prosjektId}` : null;
  const prosjektPar = prosjektPrefiks
    ? prosjektSoneElementer(filtrertHovedelementer)
        .map((e) => {
          const href = hrefForSidebarElement(e, prosjektId);
          return href ? { relpath: relativPath(href, prosjektPrefiks), href } : null;
        })
        .filter((p): p is { relpath: string; href: string } => p !== null)
    : [];
  const gjeldendePar = erFirmaKontekst ? firmaPar : prosjektPar;
  const annenPar = erFirmaKontekst ? prosjektPar : firmaPar;
  // Eiende element = lengste href som er prefiks av pathname (nøyaktig eller
  // på «/»-grense).
  const eiende = [...gjeldendePar]
    .filter((p) => pathnameNaa === p.href || pathnameNaa.startsWith(`${p.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const motpartUrl =
    eiende && eiende.relpath !== ""
      ? annenPar.find((p) => p.relpath === eiende.relpath)?.href ?? null
      : null;

  const [apen, setApen] = useState(false);
  const [åpentNivå, setÅpentNivå] = useState<Nivå>("prosjekt");
  const [prosjektFilter, setProsjektFilter] = useState<"alle" | "mine">(
    prosjektScope === "alle" ? "alle" : "mine",
  );
  const [firmaSøk, setFirmaSøk] = useState("");
  const [prosjektSøk, setProsjektSøk] = useState("");
  const [byggeplassSøk, setByggeplassSøk] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Byggeplasser for aktivt prosjekt — kilde til byggeplass-steget i trakten.
  // Alltid montert (deduplikeres mot toppbarens ByggeplassVelger av react-query)
  // slik at default-nivået i åpne() vet om prosjektet HAR byggeplasser.
  const byggeplassQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const bygninger = (byggeplassQuery.data ?? []) as Byggeplass[];

  // B2: satt når prosjektvalg avanserer til byggeplass-steget i popoveren, mens
  // vi venter på om det nye prosjektet FAKTISK har byggeplasser (async).
  const [avventerByggeplass, setAvventerByggeplass] = useState(false);

  // B3: prosjekt-favoritter (localStorage, delt hook — samme som gamle
  // ProsjektVelger; ingen ny lagring). Stjerne på hver rad + «Favoritter»-seksjon.
  const { data: session } = useSession();
  const { erFavoritt, toggleFavoritt } = useFavoritter(session?.user?.id);

  // K3 «Sist brukt» (v1): Activity-basert liste (distinkte prosjekter, nyeste
  // først) — ikke én sticky-verdi. Løser 4-5-prosjekt-scenariet. Tom Activity
  // → sticky (valgtProsjekt) som fallback (se prosjekt-steget under).
  const { data: _sistBrukte } = trpc.prosjekt.hentSistBrukte.useQuery({
    organizationId: valgtFirma?.id,
  });
  const sistBrukteIder = _sistBrukte ?? [];

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setApen(false);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  // B2: etter prosjektvalg avanserer vi optimistisk til byggeplass-steget. Når
  // lista for det NYE prosjektet er lastet (data definert + ikke fetching):
  // har det ingen byggeplasser → lukk popoveren (som gammel oppførsel); har det
  // byggeplasser → bli stående på byggeplass-steget (A1-autovalgt vises valgt).
  useEffect(() => {
    if (!avventerByggeplass) return;
    if (byggeplassQuery.isFetching || byggeplassQuery.data === undefined) return;
    setAvventerByggeplass(false);
    if (byggeplassQuery.data.length === 0) setApen(false);
  }, [avventerByggeplass, byggeplassQuery.isFetching, byggeplassQuery.data]);

  // c3: aldri «Velg firma / {konkret prosjekt}». Utled firma fra prosjektets
  // primaryOrganization når det ikke er eksplisitt valgt (typisk sitedoc_admin
  // som ikke har plukket firma). company_admin/vanlig bruker har valgtFirma
  // auto-satt, så navnet vises direkte.
  const firmaNavn =
    valgtFirma?.name ??
    (valgtProsjekt?.primaryOrganizationId
      ? tilgjengelige.find((f) => f.id === valgtProsjekt.primaryOrganizationId)?.name ?? null
      : null);

  const laster = !!prosjektId && lasterValgtProsjekt && !valgtProsjekt;

  // Prosjektnavnet (eller scope-/lastetilstand) til topplinjas prosjekt-linje.
  // Kloss 2c: SD-nummeret er ute av topplinja (det bor i trakt-radene,
  // `prosjektEtikett`); byggeplass rendres som egen `shrink-0`-span ved siden av
  // (så den overlever truncate av lange prosjektnavn — se render under).
  const prosjektTekst =
    valgtProsjekt?.name ??
    (laster
      ? t("kontekstChip.laster")
      : prosjektScope === "alle"
        ? t("prosjektVelger.alleProsjekter")
        : prosjektScope === "mine"
          ? t("prosjektVelger.mineProsjekter")
          : t("kontekstChip.velgProsjekt"));

  // P1-B: sonefarger (§ 2B, eksakte tokens). Amber = FIRMA, blå = PROSJEKT
  // (låst grammatikk, del 5).
  const soneKlasse = erFirmaKontekst
    ? "border-[#f5c97b] bg-[#fef3e2] text-[#92400e]"
    : "border-[#a9c4f5] bg-[#e8effc] text-[#1e40af]";
  // ⇄-aria/title: dedikert byttehandling-nøkkel (§ 3b a11y, ikke kosmetikk).
  // Firmakontekst → ⇄ navigerer TIL prosjektvisning, og omvendt. Kun mål-nivåets
  // navn («Prosjekt»/«Firma») sier ikke til skjermleser at det ER en byttehandling.
  const byttLabel = erFirmaKontekst
    ? t("kontekstChip.byttTil.prosjekt")
    : t("kontekstChip.byttTil.firma");

  // --- Trakt-derivat (K3) --------------------------------------------------
  // Firma-raden vises for ALLE roller (R2: popover skal vise prosjektets firma).
  // «Endre» kun når det finnes flere firmaer å bytte mellom (vedtak: firma-
  // steget kun for brukere med flere firmaer).
  const visFirmaSteg = !!firmaNavn;
  const kanBytteFirma = tilgjengelige.length > 1;
  const harByggeplasser = bygninger.length > 0;
  // Fase 2: firma-admin-signalet er nå kanAdministrereFirma (inkluderer sitedoc_admin).
  const visScopePille = kanAdministrereFirma;

  // Prosjektliste: Alle/Mine er en filter-pille (ikke egne rader). Uten pille
  // (menig ansatt) vises hele prosjektsettet som før.
  const prosjektKilde = visScopePille
    ? prosjektFilter === "alle"
      ? prosjekter
      : mineProsjekter
    : prosjekter;
  const pq = prosjektSøk.toLowerCase();
  const prosjektFiltrert = pq
    ? prosjektKilde.filter(
        (p) =>
          p.name.toLowerCase().includes(pq) ||
          (p.internalProjectNumber?.toLowerCase().includes(pq) ?? false),
      )
    : prosjektKilde;
  const visProsjektSøk = prosjektKilde.length > 6;
  // «Sist brukt» (K3 v1): Activity-lista øverst i lange lister, sticky
  // (valgtProsjekt) som fallback når Activity er tom. Snittes mot gjeldende
  // filter/scope/søk (prosjektFiltrert) så seksjonen aldri viser skjulte rader.
  // Kort liste (≤6) vises flatt uten seksjonering.
  const prosjektById = new Map(prosjektFiltrert.map((p) => [p.id, p]));
  const sistKildeIder =
    sistBrukteIder.length > 0 ? sistBrukteIder : valgtProsjekt ? [valgtProsjekt.id] : [];
  const sistProsjektRader = visProsjektSøk
    ? sistKildeIder.filter((id) => prosjektById.has(id)).map((id) => prosjektById.get(id)!)
    : [];
  const sistIderSet = new Set(sistProsjektRader.map((p) => p.id));
  const øvrigeProsjekt = prosjektFiltrert.filter((p) => !sistIderSet.has(p.id));

  // B3: «Favoritter»-seksjon øverst (over «Sist brukt»), samme seksjonering som
  // recency — kun i lange lister (>6); korte lister vises flatt (stjernene er
  // synlige der uansett). Favoritter dedupliseres ut av Sist brukt/Alle så en
  // rad aldri vises to steder.
  const favorittProsjektRader = visProsjektSøk
    ? prosjektFiltrert.filter((p) => erFavoritt(p.id))
    : [];
  const favorittSet = new Set(favorittProsjektRader.map((p) => p.id));
  const sistUtenFav = sistProsjektRader.filter((p) => !favorittSet.has(p.id));
  const øvrigeUtenFav = øvrigeProsjekt.filter((p) => !favorittSet.has(p.id));

  const bq = byggeplassSøk.toLowerCase();
  const byggeplassFiltrert = bq
    ? bygninger.filter((b) => b.name.toLowerCase().includes(bq))
    : bygninger;
  const visByggeplassSøk = bygninger.length > 6;
  // Byggeplass «Sist brukt» beholder sticky (aktivByggeplass) — cowork-målt:
  // Activity logger IKKE byggeplass, så en Activity-basert recency finnes ikke
  // for byggeplass i v1. Byggeplass-recency krever egen logging (v2). Kenneths
  // «4-5»-scenario gjaldt prosjekter, ikke byggeplasser.
  const sistByggeplass =
    visByggeplassSøk && aktivByggeplass && byggeplassFiltrert.some((b) => b.id === aktivByggeplass.id)
      ? aktivByggeplass
      : null;
  const øvrigeByggeplass = sistByggeplass
    ? byggeplassFiltrert.filter((b) => b.id !== sistByggeplass.id)
    : byggeplassFiltrert;

  const fq = firmaSøk.toLowerCase();
  const firmaFiltrert = fq
    ? tilgjengelige.filter((f) => f.name.toLowerCase().includes(fq))
    : tilgjengelige;
  const visFirmaSøk = tilgjengelige.length > 6;

  // Brukervendt etikett: internt nummer (når satt) foran navnet — aldri
  // SD-nummeret. Se terminologi.md § Tre prosjektnumre.
  const prosjektEtikett = valgtProsjekt
    ? valgtProsjekt.internalProjectNumber
      ? `${valgtProsjekt.internalProjectNumber} ${valgtProsjekt.name}`
      : valgtProsjekt.name
    : "";

  // Åpne popover og velg default-nivå = det grunneste uavklarte steget. Speiler
  // kundetelefonen: firma (kun ved flere) → prosjekt → byggeplass.
  function åpne() {
    setFirmaSøk("");
    setProsjektSøk("");
    setByggeplassSøk("");
    setProsjektFilter(prosjektScope === "alle" ? "alle" : "mine");
    if (kanBytteFirma && !valgtFirma) setÅpentNivå("firma");
    else if (!valgtProsjekt) setÅpentNivå("prosjekt");
    else if (harByggeplasser) setÅpentNivå("byggeplass");
    else setÅpentNivå("prosjekt");
    setApen(true);
  }

  // Firmabytte: velgFirma nullstiller nedover via effekter i prosjekt-/
  // byggeplass-kontekst. Traktens jobb er å avansere til prosjekt-steget.
  function velgFirmaTrakt(id: string) {
    velgFirma(id);
    setÅpentNivå("prosjekt");
  }
  // B2 (erstatter vedtak 3 «prosjektvalg lukker»): bli i popoveren og avansér
  // til byggeplass-steget. Om det nye prosjektet har byggeplasser avgjøres når
  // lista er lastet — B2-effekten lukker hvis prosjektet er uten byggeplasser.
  function velgProsjektTrakt(id: string) {
    velgProsjekt(id);
    setByggeplassSøk("");
    setÅpentNivå("byggeplass");
    setAvventerByggeplass(true);
  }
  function velgByggeplassTrakt(b: Byggeplass | null) {
    velgByggeplass(b);
    setApen(false);
  }

  const prosjektRad = (p: (typeof prosjekter)[number]) => {
    const erFav = erFavoritt(p.id);
    return (
      <TraktRad
        key={p.id}
        tittel={`${p.internalProjectNumber ? `${p.internalProjectNumber} ` : ""}${p.name}${p.address ? ` · ${p.address}` : ""}`}
        valgt={valgtProsjekt?.id === p.id && prosjektScope === "enkelt"}
        onVelg={() => velgProsjektTrakt(p.id)}
        handling={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoritt(p.id);
            }}
            title={erFav ? t("kontekstChip.fjernFavoritt") : t("kontekstChip.leggTilFavoritt")}
            aria-label={erFav ? t("kontekstChip.fjernFavoritt") : t("kontekstChip.leggTilFavoritt")}
            aria-pressed={erFav}
            className="flex shrink-0 items-center px-2.5 text-gray-300 transition-colors hover:text-amber-500"
          >
            <Star className={`h-4 w-4 ${erFav ? "fill-amber-400 text-amber-400" : ""}`} />
          </button>
        }
      />
    );
  };

  const byggeplassRad = (b: Byggeplass) => (
    <TraktRad
      key={b.id}
      tittel={b.name}
      valgt={aktivByggeplass?.id === b.id}
      onVelg={() => velgByggeplassTrakt(b)}
    />
  );

  // Popover-innhold (firma/prosjekt/byggeplass-nivåene). Skilt ut som variabel
  // slik at popoveren kan ligge INNI den `relative` knappe-wrapperen (velgerKnapper)
  // og forankres til PROSJEKT-knappen — ikke til hele chip-containeren, som flyter
  // til ~460px etter C6 (fabel-fiks 2026-08-21: `relative` på knappen + popover
  // `right-0`/`top-[calc(100%+6px)]`).
  const popoverInnhold = (
    <>
      {/* --- FIRMA -------------------------------------------------- */}
      {åpentNivå === "firma" ? (
        <div className="border-b border-gray-100">
          <SeksjonsLabel>{t("kontekstChip.velgFirma")}</SeksjonsLabel>
          {visFirmaSøk && (
            <SøkeFelt verdi={firmaSøk} onEndre={setFirmaSøk} placeholder={t("kontekstChip.velgFirma")} autoFokus />
          )}
          <div className="max-h-64 overflow-auto pb-1">
            {firmaFiltrert.map((f) => (
              <TraktRad
                key={f.id}
                tittel={f.name}
                valgt={valgtFirma?.id === f.id}
                onVelg={() => velgFirmaTrakt(f.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        visFirmaSteg && (
          <NivåRad
            etikett={t("kontekstChip.firma")}
            etikettKlasse="text-[#92400e]"
            verdi={firmaNavn ?? ""}
            kanEndre={kanBytteFirma}
            endreTekst={t("kontekstChip.endre")}
            onEndre={() => setÅpentNivå("firma")}
          />
        )
      )}

      {/* --- PROSJEKT ----------------------------------------------- */}
      {åpentNivå === "prosjekt" ? (
        <div className="border-b border-gray-100">
          <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {t("kontekstChip.velgProsjekt")}
            </span>
            {visScopePille && (
              <div className="inline-flex rounded-md bg-gray-100 p-0.5 text-xs font-medium">
                {(["alle", "mine"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setProsjektFilter(s)}
                    className={`rounded px-2 py-0.5 transition-colors ${
                      prosjektFilter === s
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t(s === "alle" ? "kontekstChip.alle" : "kontekstChip.mine")}
                  </button>
                ))}
              </div>
            )}
          </div>
          {visProsjektSøk && (
            <SøkeFelt verdi={prosjektSøk} onEndre={setProsjektSøk} placeholder={t("prosjektVelger.sok")} autoFokus />
          )}
          <div className="max-h-64 overflow-auto pb-1">
            {prosjektFiltrert.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">{t("prosjektVelger.ingen")}</p>
            ) : (
              <>
                {/* B3: Favoritter øverst → Sist brukt → Alle prosjekter. */}
                {favorittProsjektRader.length > 0 && (
                  <>
                    <SeksjonsLabel>{t("kontekstChip.favoritter")}</SeksjonsLabel>
                    {favorittProsjektRader.map(prosjektRad)}
                  </>
                )}
                {sistUtenFav.length > 0 && (
                  <>
                    <SeksjonsLabel>{t("kontekstChip.sistBrukt")}</SeksjonsLabel>
                    {sistUtenFav.map(prosjektRad)}
                  </>
                )}
                {(favorittProsjektRader.length > 0 || sistUtenFav.length > 0) &&
                  øvrigeUtenFav.length > 0 && (
                    <SeksjonsLabel>{t("prosjektVelger.alleProsjekter")}</SeksjonsLabel>
                  )}
                {øvrigeUtenFav.map(prosjektRad)}
              </>
            )}
          </div>
        </div>
      ) : (
        <NivåRad
          etikett={t("kontekstChip.prosjekt")}
          etikettKlasse="text-[#1e40af]"
          verdi={valgtProsjekt ? prosjektEtikett : prosjektTekst}
          kanEndre
          endreTekst={t("kontekstChip.endre")}
          onEndre={() => setÅpentNivå("prosjekt")}
        />
      )}

      {/* --- BYGGEPLASS --------------------------------------------- */}
      {/* B2: åpent byggeplass-steg rendres også mens lista for et nyvalgt
          prosjekt lastes (viser «Laster …»); B2-effekten lukker hvis
          prosjektet viser seg uten byggeplasser. Sammenfoldet NivåRad kun
          når prosjektet HAR byggeplasser. */}
      {åpentNivå === "byggeplass" ? (
        <div>
          <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {t("byggeplassVelger.velg")}{" "}
            {bygninger.length > 0 && (
              <span className="text-gray-300">
                · {t("kontekstChip.antallApne", { antall: bygninger.length })}
              </span>
            )}
          </div>
          {visByggeplassSøk && (
            <SøkeFelt
              verdi={byggeplassSøk}
              onEndre={setByggeplassSøk}
              placeholder={t("byggeplassVelger.sok")}
              autoFokus
            />
          )}
          <div className="max-h-64 overflow-auto pb-1">
            {bygninger.length === 0 && byggeplassQuery.isFetching ? (
              <p className="px-3 py-2 text-sm text-gray-400">{t("kontekstChip.laster")}</p>
            ) : (
              <>
                {sistByggeplass && (
                  <>
                    <SeksjonsLabel>{t("kontekstChip.sistBrukt")}</SeksjonsLabel>
                    {byggeplassRad(sistByggeplass)}
                  </>
                )}
                <SeksjonsLabel>
                  {t("kontekstChip.allePaa", { prosjekt: prosjektEtikett })}
                </SeksjonsLabel>
                <TraktRad
                  tittel={t("kontekstChip.heleProsjektet")}
                  valgt={!aktivByggeplass}
                  onVelg={() => velgByggeplassTrakt(null)}
                />
                {øvrigeByggeplass.map(byggeplassRad)}
              </>
            )}
          </div>
        </div>
      ) : (
        harByggeplasser && (
          <NivåRad
            etikett={t("kontekstChip.byggeplass")}
            etikettKlasse="text-gray-500"
            verdi={aktivByggeplass?.name ?? t("kontekstChip.heleProsjektet")}
            kanEndre
            endreTekst={t("kontekstChip.endre")}
            onEndre={() => setÅpentNivå("byggeplass")}
            sisteRad
          />
        )
      )}
    </>
  );

  // Split-chip «NIVÅORD ▾ | ⇄» (P1/R2, fabel-fasit § 2a) — ligger på den AKTIVE
  // linja (kloss 2c-grammatikk b): linje 2 i prosjektkontekst, linje 1 i
  // firmakontekst. Venstre segment = velger (popover), ⇄ = sonefarget klikkmål
  // for flatebytte (−12px overlapp, z-10 tucker over hjørnet), vises kun med
  // motpart. Delt markup så begge kontekster bruker samme chip.
  const velgerKnapper = (
    // `relative` HER (på knappe-wrapperen), ikke på chip-containeren: popoveren
    // forankres til PROSJEKT-knappen uansett navnelengde (C6-robust — fabel-fiks
    // 2026-08-21). Tidligere lå `relative` på containeren + popover `left-0`, som
    // etter C6-flyten (navn ~460px) skjøv popoveren langt til venstre for knappen.
    <div className="relative flex items-center">
      <button
        onClick={() => (apen ? setApen(false) : åpne())}
        // Fast min-bredde = PROSJEKT-knappens bredde (127px, målt) + justify-center:
        // «FIRMA» (kortere) og «PROSJEKT» får SAMME knappebredde (behold — koster
        // ingenting). Merk (C6, 2026-08-21): 240px-navneankeret er oppgitt, så ⇄ er
        // ikke lenger pikselfast ved firma↔prosjekt-bytte — lik knappbredde beholdes
        // for symmetri, ikke lenger for stabil ⇄.
        className={`relative z-0 flex min-w-[127px] items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold uppercase tracking-wide transition-colors hover:bg-black/[0.06] ${soneKlasse}`}
      >
        {erFirmaKontekst ? t("kontekstChip.firma") : t("kontekstChip.prosjekt")}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${apen ? "rotate-180" : ""}`} />
      </button>
      {motpartUrl && (
        <Link
          href={motpartUrl}
          title={byttLabel}
          aria-label={byttLabel}
          className={`relative z-10 -ml-3 flex items-center rounded-lg border py-1.5 pl-4 pr-2.5 transition-colors hover:bg-black/[0.06] ${soneKlasse}`}
        >
          <ArrowLeftRight className="h-4 w-4 shrink-0" />
        </Link>
      )}
      {apen && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          {popoverInnhold}
        </div>
      )}
    </div>
  );

  return (
    // `relative` er flyttet ned til velgerKnapper (knappe-wrapperen) — popoveren
    // forankres til PROSJEKT-knappen, ikke til denne containeren (som flyter til
    // ~460px etter C6). `ref` beholdes for klikk-utenfor-lukking.
    <div ref={ref}>
      {/* Kloss 2c: to-linjers topplinje. Grammatikk (fabel-gate, ufravikelig):
          (a) sonetonen følger AKTIV kontekst — kun ÉN tone om gangen (to toner
              samtidig = intet signal). Prosjektkontekst: firma-linja er dempet
              grå brødtekst (IKKE amber); amber kun i firmakontekst.
          (b) split-chippen (▾ + ⇄) ligger på den aktive linja; firma-linja i
              prosjektkontekst er ren tekst uten klikkmekanisme.
          Byggeplass-suffikset er `shrink-0` så det overlever truncate av lange
          prosjektnavn (rotårsaken kloss 2b måtte rette). */}
      {erFirmaKontekst ? (
        // Firmakontekst: én linje — firma + amber split-chip.
        <div className="flex items-center gap-2">
          {/* C6: 240px-ankeret oppgitt — navnet flyter (maks ~460px) og trunkerer;
              title gir fullt navn. Lesbare navn prioriteres over pikselfast ⇄
              (Kenneth-vedtak 2026-08-21). */}
          <span
            className="min-w-0 max-w-[460px] truncate text-sm font-medium text-blue-100"
            title={firmaNavn ?? ""}
          >
            {firmaNavn ?? t("kontekstChip.velgFirma")}
          </span>
          {velgerKnapper}
        </div>
      ) : (
        // Prosjektkontekst: to linjer — firma (dempet grå) over prosjekt · byggeplass.
        <div className="flex flex-col gap-0.5">
          {firmaNavn && (
            // Eyebrow (firma-linja): ingen bredde-cap — den har plassen på egen
            // linje; medium vekt for lesbarhet.
            <span className="text-[11px] font-medium leading-none text-slate-300">
              {firmaNavn}
            </span>
          )}
          <div className="flex items-center gap-2">
            {/* C5+C6 (Kenneth-vedtak 2026-08-21): 240px-ankeret er oppgitt —
                navneområdet FLYTER (maks ~460px). Snudd trunkering: prosjektnavnet
                har prioritet (shrink-0 opp til egen maks ~280px, så truncate),
                byggeplass-suffikset yielder (min-w-0 truncate, dempet tone). Før
                spiste et langt byggeplassnavn prosjektnavnet. title = full tekst. */}
            <span
              className="flex min-w-0 max-w-[460px] items-center text-sm font-medium text-blue-100"
              title={
                valgtProsjekt && aktivByggeplass
                  ? `${prosjektTekst} · ${aktivByggeplass.name}`
                  : prosjektTekst
              }
            >
              <span className="max-w-[280px] shrink-0 truncate">{prosjektTekst}</span>
              {valgtProsjekt && aktivByggeplass && (
                <span className="ml-1 min-w-0 truncate whitespace-nowrap text-blue-200/70">
                  · {aktivByggeplass.name}
                </span>
              )}
            </span>
            {velgerKnapper}
          </div>
        </div>
      )}
    </div>
  );
}

/* Trakt-primitivene (NivåRad/TraktRad/SeksjonsLabel/SøkeFelt) er flyttet til
   @/components/kontekst-chip/trakt-primitiver og importeres øverst. */
