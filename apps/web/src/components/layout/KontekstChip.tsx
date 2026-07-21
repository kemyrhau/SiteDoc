"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Building2, ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useFirma } from "@/kontekst/firma-kontekst";
import { FirmaVelgerPanel } from "./FirmaVelger";
import { ProsjektVelgerPanel } from "./ProsjektVelger";

// P1-B (⇄): kun seksjoner med et ekte firma↔prosjekt-par får flatebytte.
// Ledd 1-måling: HMS er eneste rene par (piloten). Utvides seksjon for seksjon
// i den gjennomgående planen (vedtak § 5) — legg til slug her når paret finnes.
// ⚠️ MÅ utvides SAMTIDIG som et nytt par bygges: bygger du en ny firma/prosjekt-
// flate uten å legge sluggen inn her, mangler ⇄ på den flaten uten at noe
// feiler — et usynlig hull, ikke en synlig feil.
const PARBARE_SEKSJONER = new Set(["hms"]);

/**
 * KontekstChip (steg iii) — samlet «{Firma} / {Prosjekt} ▾»-velger bak
 * `nyNavigasjon`-flagget. Erstatter FirmaVelger + ProsjektVelger i Toppbar.
 * Ett popover: firma øverst (kun sitedoc_admin som kan bytte), prosjekter
 * hierarkisk under — gjenbruker panel-innmatene så scope-rader, favoritter
 * og søke-terskler bevares.
 *
 * Funn 1b: prosjekt-delen av chip-teksten viser lastetilstand når et
 * prosjektId er persistert men objektet ennå ikke er resolvet — ikke tom
 * streng, ikke «velg prosjekt» (som ville blinket ved hver fersk økt).
 */
export function KontekstChip() {
  const { t } = useTranslation();
  const { valgtFirma, erSitedocAdmin, tilgjengelige } = useFirma();
  const { valgtProsjekt, prosjektId, lasterValgtProsjekt, prosjektScope } = useProsjekt();
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
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative flex items-center">
      {/* R2 (fabel-fasit § 2a): split-chip «FIRMA ▾ | ⇄». Venstre = velger
          (popover), ⇄ = eget sonefarget klikkmål for flatebytte, med −12px
          overlapp mot chippens avrundede høyrekant (z-10 tucker det over
          hjørnet). ⇄ vises kun med motpart. Vanlig navigasjon, sidebar urørt. */}
      <button
        onClick={() => setApen(!apen)}
        className={`relative z-0 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-black/[0.06] ${soneKlasse}`}
      >
        <Building2 className="h-4 w-4 shrink-0" />
        {/* P1-A: topplinja viser KUN eget nivå. Firmakontekst → kun firmanavn;
            prosjektkontekst → kun prosjekt (firmaprefiks ut). */}
        {erFirmaKontekst ? (
          <span className="max-w-[220px] truncate">
            {firmaNavn ?? t("kontekstChip.velgFirma")}
          </span>
        ) : (
          /* Prosjektkontekst: kun prosjekt-/scope-tekst — aldri firmaprefiks. */
          <span className="max-w-[220px] truncate">{prosjektTekst}</span>
        )}
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
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-xl">
          {/* Popover-header: aktivt firma for ALLE roller (fabel-vilkår).
              Ikke-admin mister firmanavnet fra topplinja (P1-A) og må kunne
              finne det igjen her — ren visning, ingen velger. Admin beholder
              velger-panelet. */}
          {erSitedocAdmin ? (
            <div>
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {t("kontekstChip.firma")}
              </p>
              <FirmaVelgerPanel onValgt={() => setApen(false)} />
            </div>
          ) : firmaNavn ? (
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {t("kontekstChip.firma")}
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-gray-900">{firmaNavn}</p>
            </div>
          ) : null}
          <div>
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {t("kontekstChip.prosjekt")}
            </p>
            <ProsjektVelgerPanel onValgt={() => setApen(false)} autoFocus={!erSitedocAdmin} />
          </div>
        </div>
      )}
    </div>
  );
}
