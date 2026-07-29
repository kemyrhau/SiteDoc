"use client";

import { useRef, useState, useEffect, type ReactNode, type ButtonHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TraktRad, SøkeFelt, SeksjonsLabel } from "./trakt-primitiver";

/**
 * DokumentKontekstChipLinje (P4b) — delt kontekst-chip-linje for dokument-
 * detaljsider i utfyllingsmodus. Viser prosjekt · byggeplass · faggruppe · mal
 * som en rad kompakte chips; hver «velger»-chip åpner en trakt-popover
 * (sist brukt + søk). «display»-chips (prosjekt, mal) viser bare verdien.
 *
 * ⚠️ Delt komponent (fabel-ufravikelig): gjenbrukes av sjekkliste/oppgave/HMS
 * OG P4c (timer ett-trykk). Bygget generisk (chip-array) nettopp for det —
 * ikke hardkod dokumenttype-spesifikk logikk her; kalleren wirer alternativer +
 * onVelg (server-fritt: onVelg kaller kallerens `oppdater`-mutasjon).
 */

export type ChipAlternativ = {
  /** null = «tom»-valget (f.eks. «Hele prosjektet» for byggeplass). */
  id: string | null;
  navn: string;
  undertekst?: string;
};

export type Chip =
  | {
      etikett: string;
      verdi: string;
      ikon?: ReactNode;
      type: "display";
    }
  | {
      etikett: string;
      verdi: string;
      ikon?: ReactNode;
      type: "velger";
      valgtId: string | null;
      alternativer: ChipAlternativ[];
      onVelg: (id: string | null) => void;
      /** Tekst for «tom»-raden øverst (id=null). Utelates → ingen tom-rad. */
      tomLabel?: string;
      /** Deaktivert (f.eks. faggruppe utenfor utkast) + grunn som tittel. */
      deaktivert?: boolean;
      deaktivertGrunn?: string;
    };

export function DokumentKontekstChipLinje({ chips }: { chips: Chip[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip, i) =>
        chip.type === "display" ? (
          <DisplayChip key={i} etikett={chip.etikett} verdi={chip.verdi} ikon={chip.ikon} />
        ) : (
          <VelgerChip key={i} chip={chip} />
        ),
      )}
    </div>
  );
}

function ChipRamme({
  etikett,
  verdi,
  ikon,
  ...knappProps
}: {
  etikett: string;
  verdi: string;
  ikon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const erKnapp = typeof knappProps.onClick === "function" && !knappProps.disabled;
  return (
    <button
      type="button"
      {...knappProps}
      // ≥44px hit-target (min-h-11) — mobil/nettbrett-vennlig.
      className={`flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-left transition-colors ${
        erKnapp ? "hover:border-gray-300 hover:bg-gray-50" : "cursor-default"
      } ${knappProps.disabled ? "opacity-60" : ""}`}
    >
      {ikon && <span className="shrink-0 text-gray-400">{ikon}</span>}
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          {etikett}
        </span>
        <span className="max-w-[10rem] truncate text-sm font-medium text-gray-800">{verdi}</span>
      </span>
      {erKnapp && <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
    </button>
  );
}

function DisplayChip({ etikett, verdi, ikon }: { etikett: string; verdi: string; ikon?: ReactNode }) {
  return <ChipRamme etikett={etikett} verdi={verdi} ikon={ikon} />;
}

function VelgerChip({ chip }: { chip: Extract<Chip, { type: "velger" }> }) {
  const { t } = useTranslation();
  const [åpen, setÅpen] = useState(false);
  const [søk, setSøk] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setÅpen(false);
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  const q = søk.toLowerCase();
  const filtrert = q
    ? chip.alternativer.filter(
        (a) => a.navn.toLowerCase().includes(q) || (a.undertekst?.toLowerCase().includes(q) ?? false),
      )
    : chip.alternativer;
  const visSøk = chip.alternativer.length > 6;

  function velg(id: string | null) {
    chip.onVelg(id);
    setÅpen(false);
    setSøk("");
  }

  return (
    <div ref={ref} className="relative">
      <ChipRamme
        etikett={chip.etikett}
        verdi={chip.verdi}
        ikon={chip.ikon}
        disabled={chip.deaktivert}
        title={chip.deaktivert ? chip.deaktivertGrunn : undefined}
        onClick={chip.deaktivert ? undefined : () => setÅpen((v) => !v)}
      />
      {åpen && !chip.deaktivert && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          <SeksjonsLabel>{chip.etikett}</SeksjonsLabel>
          {visSøk && <SøkeFelt verdi={søk} onEndre={setSøk} placeholder={t("handling.sok")} />}
          <div className="max-h-64 overflow-auto pb-1">
            {chip.tomLabel && !q && (
              <TraktRad
                tittel={chip.tomLabel}
                valgt={chip.valgtId === null}
                onVelg={() => velg(null)}
              />
            )}
            {filtrert.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">{t("felles.ingenTreff")}</p>
            ) : (
              filtrert.map((a) => (
                <TraktRad
                  key={a.id ?? "__tom__"}
                  tittel={a.navn}
                  undertekst={a.undertekst}
                  valgt={chip.valgtId === a.id}
                  onVelg={() => velg(a.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
