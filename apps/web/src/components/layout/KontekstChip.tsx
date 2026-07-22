"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ArrowLeftRight, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useFirma } from "@/kontekst/firma-kontekst";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";

// P1-B (⇄): kun seksjoner med et ekte firma↔prosjekt-par får flatebytte.
// Ledd 1-måling: HMS er eneste rene par (piloten). Utvides seksjon for seksjon
// i den gjennomgående planen (vedtak § 5) — legg til slug her når paret finnes.
// ⚠️ MÅ utvides SAMTIDIG som et nytt par bygges: bygger du en ny firma/prosjekt-
// flate uten å legge sluggen inn her, mangler ⇄ på den flaten uten at noe
// feiler — et usynlig hull, ikke en synlig feil.
const PARBARE_SEKSJONER = new Set(["hms"]);

type Nivå = "firma" | "prosjekt" | "byggeplass";

interface Byggeplass {
  id: string;
  name: string;
  number: number | null;
}

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
  const { valgtFirma, erSitedocAdmin, erCompanyAdmin, tilgjengelige, velgFirma } = useFirma();
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
  const pathname = usePathname();
  const router = useRouter();
  // P1-A: samme kontekst-derivat som Toppbar (`Toppbar.tsx:50`). Chippen var
  // kontekst-blind — det var rotårsaken til firma/prosjekt-forvekslingen.
  const erFirmaKontekst = pathname?.startsWith("/dashbord/firma") ?? false;

  // P1-B (⇄): motpart-flate for gjeldende seksjon. Både firma- og prosjektruter
  // har seksjons-sluggen på indeks 3 (`/dashbord/firma/hms` og
  // `/dashbord/{id}/hms` → deler[3] = "hms"). Vanlig navigasjon, ingen ny
  // mekanisme (§ 2B, K5). Null → chip uten bytte (ingen motpart, eller firma→
  // prosjekt uten et sticky prosjekt å bytte til).
  const seksjon = (pathname ?? "").split("/")[3] ?? "";
  const motpartUrl = !PARBARE_SEKSJONER.has(seksjon)
    ? null
    : erFirmaKontekst
      ? prosjektId
        ? `/dashbord/${prosjektId}/${seksjon}`
        : null
      : `/dashbord/firma/${seksjon}`;

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
  const { data: _bygninger } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const bygninger = (_bygninger ?? []) as Byggeplass[];

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

  const prosjektTekst = valgtProsjekt?.name
    ?? (laster
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
  // ⇄-aria/title: mål-nivået. Gjenbruker eksisterende nøkler (ingen generator).
  const byttLabel = erFirmaKontekst ? t("kontekstChip.prosjekt") : t("kontekstChip.firma");

  // P1 lapp (fabel-fasit § 3a, 2026-07-21): entitetsnavnet er nivå-derivert,
  // samme kilde som før — kun flyttet ut av chippen til ren tekst.
  const entitetTekst = erFirmaKontekst ? (firmaNavn ?? t("kontekstChip.velgFirma")) : prosjektTekst;

  // --- Trakt-derivat (K3) --------------------------------------------------
  // Firma-raden vises for ALLE roller (R2: popover skal vise prosjektets firma).
  // «Endre» kun når det finnes flere firmaer å bytte mellom (vedtak: firma-
  // steget kun for brukere med flere firmaer).
  const visFirmaSteg = !!firmaNavn;
  const kanBytteFirma = tilgjengelige.length > 1;
  const harByggeplasser = bygninger.length > 0;
  const visScopePille = erSitedocAdmin || erCompanyAdmin;

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
        (p) => p.name.toLowerCase().includes(pq) || p.projectNumber.toLowerCase().includes(pq),
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

  const prosjektEtikett = valgtProsjekt
    ? `${valgtProsjekt.projectNumber} ${valgtProsjekt.name}`
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
  // Prosjektvalg lukker popoveren (vedtak 3). Byggeplass er valgfritt ettervalg
  // — brukeren åpner chippen på nytt og går til byggeplass-steget.
  function velgProsjektTrakt(id: string) {
    velgProsjekt(id);
    setApen(false);
  }
  function velgByggeplassTrakt(b: Byggeplass | null) {
    velgByggeplass(b);
    setApen(false);
  }

  const prosjektRad = (p: (typeof prosjekter)[number]) => (
    <TraktRad
      key={p.id}
      tittel={`${p.projectNumber} ${p.name}${p.address ? ` · ${p.address}` : ""}`}
      valgt={valgtProsjekt?.id === p.id && prosjektScope === "enkelt"}
      onVelg={() => velgProsjektTrakt(p.id)}
    />
  );

  const byggeplassRad = (b: Byggeplass) => (
    <TraktRad
      key={b.id}
      tittel={b.name}
      valgt={aktivByggeplass?.id === b.id}
      onVelg={() => velgByggeplassTrakt(b)}
    />
  );

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      {/* P1-A + lapp § 3a: topplinja viser KUN eget nivå, som ren tekst UTENFOR
          chippen. Firmakontekst → kun firmanavn; prosjektkontekst → kun
          prosjekt (firmaprefiks ut). Fabels begrunnelse: nivåordet ER
          nivåsignalet — uten det (§ 3a under) bæres signalet av farge alene,
          som svikter for fargeblinde. */}
      <span className="max-w-[220px] truncate text-sm font-medium text-blue-100">
        {entitetTekst}
      </span>
      {/* R2 (fabel-fasit § 2a) + lapp § 3a: split-chip «FIRMA ▾ | ⇄». Chippen
          bærer NIVÅORDET (ikke navnet — det står til venstre over). Venstre
          segment = velger (popover), ⇄ = eget sonefarget klikkmål for
          flatebytte, med −12px overlapp mot chippens avrundede høyrekant
          (z-10 tucker det over hjørnet). ⇄ vises kun med motpart. Vanlig
          navigasjon, sidebar urørt. */}
      <button
        onClick={() => (apen ? setApen(false) : åpne())}
        className={`relative z-0 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold uppercase tracking-wide transition-colors hover:bg-black/[0.06] ${soneKlasse}`}
      >
        {erFirmaKontekst ? t("kontekstChip.firma") : t("kontekstChip.prosjekt")}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${apen ? "rotate-180" : ""}`} />
      </button>
      {motpartUrl && (
        <button
          type="button"
          onClick={() => router.push(motpartUrl)}
          title={byttLabel}
          aria-label={byttLabel}
          className={`relative z-10 -ml-3 flex items-center rounded-lg border py-1.5 pl-4 pr-2.5 transition-colors hover:bg-black/[0.06] ${soneKlasse}`}
        >
          <ArrowLeftRight className="h-4 w-4 shrink-0" />
        </button>
      )}

      {apen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          {/* --- FIRMA -------------------------------------------------- */}
          {åpentNivå === "firma" ? (
            <div className="border-b border-gray-100">
              <SeksjonsLabel>{t("kontekstChip.velgFirma")}</SeksjonsLabel>
              {visFirmaSøk && (
                <SøkeFelt verdi={firmaSøk} onEndre={setFirmaSøk} placeholder={t("kontekstChip.velgFirma")} />
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
                <SøkeFelt verdi={prosjektSøk} onEndre={setProsjektSøk} placeholder={t("prosjektVelger.sok")} />
              )}
              <div className="max-h-64 overflow-auto pb-1">
                {prosjektFiltrert.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-400">{t("prosjektVelger.ingen")}</p>
                ) : (
                  <>
                    {sistProsjektRader.length > 0 && (
                      <>
                        <SeksjonsLabel>{t("kontekstChip.sistBrukt")}</SeksjonsLabel>
                        {sistProsjektRader.map(prosjektRad)}
                        {øvrigeProsjekt.length > 0 && (
                          <SeksjonsLabel>{t("prosjektVelger.alleProsjekter")}</SeksjonsLabel>
                        )}
                      </>
                    )}
                    {øvrigeProsjekt.map(prosjektRad)}
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

          {/* --- BYGGEPLASS (kun når prosjektet har byggeplasser) ------- */}
          {harByggeplasser &&
            (åpentNivå === "byggeplass" ? (
              <div>
                <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {t("byggeplassVelger.velg")}{" "}
                  <span className="text-gray-300">
                    · {t("kontekstChip.antallApne", { antall: bygninger.length })}
                  </span>
                </div>
                {visByggeplassSøk && (
                  <SøkeFelt
                    verdi={byggeplassSøk}
                    onEndre={setByggeplassSøk}
                    placeholder={t("byggeplassVelger.sok")}
                  />
                )}
                <div className="max-h-64 overflow-auto pb-1">
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
                </div>
              </div>
            ) : (
              <NivåRad
                etikett={t("kontekstChip.byggeplass")}
                etikettKlasse="text-gray-500"
                verdi={aktivByggeplass?.name ?? t("kontekstChip.heleProsjektet")}
                kanEndre
                endreTekst={t("kontekstChip.endre")}
                onEndre={() => setÅpentNivå("byggeplass")}
                sisteRad
              />
            ))}
        </div>
      )}
    </div>
  );
}

/** Sammenfoldet nivårad: farget etikett + valgt verdi + «Endre»-lenke. */
function NivåRad({
  etikett,
  etikettKlasse,
  verdi,
  kanEndre,
  endreTekst,
  onEndre,
  sisteRad = false,
}: {
  etikett: string;
  etikettKlasse: string;
  verdi: string;
  kanEndre: boolean;
  endreTekst: string;
  onEndre: () => void;
  sisteRad?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 ${sisteRad ? "" : "border-b border-gray-100"}`}
    >
      <span
        className={`w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide ${etikettKlasse}`}
      >
        {etikett}
      </span>
      <span className="flex-1 truncate text-sm font-medium text-gray-900">{verdi}</span>
      {kanEndre && (
        <button
          type="button"
          onClick={onEndre}
          className="shrink-0 text-xs font-medium text-sitedoc-secondary hover:underline"
        >
          {endreTekst}
        </button>
      )}
    </div>
  );
}

/** Valgbar rad i en åpen liste (firma/prosjekt/byggeplass). */
function TraktRad({
  tittel,
  valgt,
  onVelg,
}: {
  tittel: string;
  valgt: boolean;
  onVelg: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onVelg}
      className={`flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-blue-50 ${
        valgt ? "bg-blue-50" : ""
      }`}
    >
      <span
        className={`text-sm ${valgt ? "font-semibold text-sitedoc-primary" : "font-medium text-gray-900"}`}
      >
        {tittel}
      </span>
    </button>
  );
}

function SeksjonsLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </p>
  );
}

function SøkeFelt({
  verdi,
  onEndre,
  placeholder,
}: {
  verdi: string;
  onEndre: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="px-3 pb-1 pt-1">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={verdi}
          onChange={(e) => onEndre(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
