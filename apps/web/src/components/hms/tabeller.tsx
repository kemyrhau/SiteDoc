// Delte HMS-tabell-komponenter (prosjekt- og firma-nivå).
// 2026-05-28: konvertert fra plain HTML-tabell til @sitedoc/ui Table — gir
// sortering, kolonnefilter, kolonnebredde-resize, status-snarvei.
// Filter-state holdes lokalt per komponent-instans (tab-bytte i firma-HMS
// nullstiller tilstand — akseptert trade-off; tabs har uansett ulike kolonner).

import { useState, useMemo, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, StatusBadge, Table } from "@sitedoc/ui";
import { formaterDato, formaterLopenummer, hentDataVerdi } from "./visning";
import type { DokumentRad } from "./types";

type TabellProps = {
  rader: DokumentRad[];
  onKlikk: (rad: DokumentRad) => void;
  visProsjektKolonne?: boolean;
  visByggeplassKolonne?: boolean;
  onHurtigBehandle?: (rad: DokumentRad) => void;
};

type KolDef = {
  id: string;
  header: string;
  celle: (rad: DokumentRad) => JSX.Element;
  bredde?: string;
  sorterbar?: boolean;
  sorterVerdi?: (rad: DokumentRad) => string | number | null;
  filtrerbar?: boolean;
  filterAlternativer?: { value: string; label: string }[];
  filterSnarveier?: { label: string; verdier: string[] }[];
};

// «Åpne» statuser — brukes av Avvik-snarveien
const ALLE_APNE_STATUSER = ["draft", "sent", "received", "in_progress", "responded"];

// Bygg filter-alternativer ut fra unike verdier i radene
function unikeVerdier(rader: DokumentRad[], hent: (r: DokumentRad) => string): { value: string; label: string }[] {
  const sett = new Set<string>();
  for (const r of rader) {
    const v = hent(r);
    if (v && v !== "—") sett.add(v);
  }
  return Array.from(sett)
    .sort((a, b) => a.localeCompare(b, "nb-NO"))
    .map((v) => ({ value: v, label: v }));
}

function byggeplassNavnAvvik(r: DokumentRad): string {
  return r.drawing?.byggeplass?.name ?? "—";
}
function byggeplassNavnSjekkliste(r: DokumentRad): string {
  return r.byggeplass?.name ?? "—";
}

// Generisk filtrerings-funksjon — kalt med kolonne-id → rad-verdi-mapping
function filtrerRader(
  rader: DokumentRad[],
  filterVerdier: Record<string, string>,
  feltMapping: Record<string, (r: DokumentRad) => string>,
): DokumentRad[] {
  let resultat = rader;
  for (const [kolId, verdi] of Object.entries(filterVerdier)) {
    if (!verdi) continue;
    const valgteSet = new Set(verdi.split(","));
    const hentFelt = feltMapping[kolId];
    if (!hentFelt) continue;
    resultat = resultat.filter((r) => valgteSet.has(hentFelt(r)));
  }
  return resultat;
}

/* ============================================================================
 *  AvvikTabell
 * ============================================================================ */

export function AvvikTabell({
  rader,
  onKlikk,
  visProsjektKolonne = false,
  visByggeplassKolonne = false,
  onHurtigBehandle,
}: TabellProps) {
  const { t } = useTranslation();
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});
  const [kolonneBredder, setKolonneBredder] = useState<Record<string, number>>({});

  if (rader.length === 0) {
    return (
      <EmptyState title={t("hms.tom.avvik")} description={t("hms.tom.avvikBeskrivelse")} />
    );
  }

  const hentProsjekt = (r: DokumentRad) => r.template.project?.name ?? "—";
  const hentAlvorlighet = (r: DokumentRad) =>
    hentDataVerdi(r, (l) => l.toLowerCase().includes("alvorlig"));

  const feltMapping: Record<string, (r: DokumentRad) => string> = {
    prosjekt: hentProsjekt,
    byggeplass: byggeplassNavnAvvik,
    alvorlighet: hentAlvorlighet,
    status: (r) => r.status,
  };

  const filtrerte = filtrerRader(rader, filterVerdier, feltMapping);

  const kolonner: KolDef[] = useMemo(() => {
    const k: KolDef[] = [];
    k.push({
      id: "nr",
      header: t("tabell.nr"),
      celle: (r) => (
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
          {r.template.prefix ? `${r.template.prefix}-${formaterLopenummer(r)}` : formaterLopenummer(r)}
        </span>
      ),
      bredde: "90px",
      sorterbar: true,
      sorterVerdi: (r) => r.number ?? 0,
    });
    k.push({
      id: "tittel",
      header: t("tabell.tittel"),
      celle: (r) => <span className="font-medium text-gray-900">{r.title}</span>,
      sorterbar: true,
      sorterVerdi: (r) => r.title,
    });
    if (visProsjektKolonne) {
      k.push({
        id: "prosjekt",
        header: t("firma.hms.kolonne.prosjekt"),
        celle: (r) => <span className="text-sm text-gray-700">{r.template.project?.name ?? "—"}</span>,
        sorterbar: true,
        sorterVerdi: (r) => r.template.project?.name ?? "",
        filtrerbar: true,
        filterAlternativer: unikeVerdier(rader, hentProsjekt),
      });
    }
    if (visByggeplassKolonne) {
      k.push({
        id: "byggeplass",
        header: t("firma.hms.kolonne.byggeplass"),
        celle: (r) => <span className="text-sm text-gray-700">{byggeplassNavnAvvik(r)}</span>,
        sorterbar: true,
        sorterVerdi: byggeplassNavnAvvik,
        filtrerbar: true,
        filterAlternativer: unikeVerdier(rader, byggeplassNavnAvvik),
      });
    }
    k.push({
      id: "alvorlighet",
      header: t("hms.kolonne.alvorlighet"),
      celle: (r) => <span className="text-sm text-gray-700">{hentAlvorlighet(r)}</span>,
      sorterbar: true,
      sorterVerdi: hentAlvorlighet,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, hentAlvorlighet),
    });
    k.push({
      id: "status",
      header: t("tabell.status"),
      celle: (r) => <StatusBadge status={r.status} />,
      bredde: "140px",
      sorterbar: true,
      sorterVerdi: (r) => r.status,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, (r) => r.status),
      filterSnarveier: [{ label: t("status.alleApne"), verdier: ALLE_APNE_STATUSER }],
    });
    k.push({
      id: "tidsfrist",
      header: t("tabell.tidsfrist"),
      celle: (r) => <span className="text-sm text-gray-700">{formaterDato(r.dueDate ?? null)}</span>,
      bredde: "120px",
      sorterbar: true,
      sorterVerdi: (r) => r.dueDate ?? "",
    });
    if (onHurtigBehandle) {
      k.push({
        id: "behandle",
        header: "",
        celle: (r) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHurtigBehandle(r);
            }}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            {t("firma.hms.hurtig.knapp")}
          </button>
        ),
        bredde: "100px",
      });
    }
    return k;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rader, visProsjektKolonne, visByggeplassKolonne, onHurtigBehandle, t]);

  return (
    <Table<DokumentRad>
      kolonner={kolonner}
      data={filtrerte}
      radNokkel={(r) => r.id}
      onRadKlikk={onKlikk}
      tomMelding={t("hms.tom.avvik")}
      filterVerdier={filterVerdier}
      onFilterEndring={(kolId, verdi) => setFilterVerdier((prev) => ({ ...prev, [kolId]: verdi }))}
      kolonneBredder={kolonneBredder}
      onKolonneBreddeEndring={setKolonneBredder}
    />
  );
}

/* ============================================================================
 *  SjaTabell
 * ============================================================================ */

export function SjaTabell({
  rader,
  onKlikk,
  visProsjektKolonne = false,
  visByggeplassKolonne = false,
}: TabellProps) {
  const { t } = useTranslation();
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});
  const [kolonneBredder, setKolonneBredder] = useState<Record<string, number>>({});

  if (rader.length === 0) {
    return <EmptyState title={t("hms.tom.sja")} description={t("hms.tom.sjaBeskrivelse")} />;
  }

  const hentProsjekt = (r: DokumentRad) => r.template.project?.name ?? "—";
  const hentArbeidsleder = (r: DokumentRad) =>
    hentDataVerdi(r, (l) => l.toLowerCase().includes("arbeidsleder"));

  const feltMapping: Record<string, (r: DokumentRad) => string> = {
    prosjekt: hentProsjekt,
    byggeplass: byggeplassNavnSjekkliste,
    arbeidsleder: hentArbeidsleder,
    status: (r) => r.status,
  };

  const filtrerte = filtrerRader(rader, filterVerdier, feltMapping);

  const kolonner: KolDef[] = useMemo(() => {
    const k: KolDef[] = [];
    k.push({
      id: "nr",
      header: t("tabell.nr"),
      celle: (r) => (
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
          {r.template.prefix ? `${r.template.prefix}-${formaterLopenummer(r)}` : formaterLopenummer(r)}
        </span>
      ),
      bredde: "90px",
      sorterbar: true,
      sorterVerdi: (r) => r.number ?? 0,
    });
    k.push({
      id: "tittel",
      header: t("tabell.tittel"),
      celle: (r) => <span className="font-medium text-gray-900">{r.title}</span>,
      sorterbar: true,
      sorterVerdi: (r) => r.title,
    });
    if (visProsjektKolonne) {
      k.push({
        id: "prosjekt",
        header: t("firma.hms.kolonne.prosjekt"),
        celle: (r) => <span className="text-sm text-gray-700">{r.template.project?.name ?? "—"}</span>,
        sorterbar: true,
        sorterVerdi: (r) => r.template.project?.name ?? "",
        filtrerbar: true,
        filterAlternativer: unikeVerdier(rader, hentProsjekt),
      });
    }
    if (visByggeplassKolonne) {
      k.push({
        id: "byggeplass",
        header: t("firma.hms.kolonne.byggeplass"),
        celle: (r) => <span className="text-sm text-gray-700">{byggeplassNavnSjekkliste(r)}</span>,
        sorterbar: true,
        sorterVerdi: byggeplassNavnSjekkliste,
        filtrerbar: true,
        filterAlternativer: unikeVerdier(rader, byggeplassNavnSjekkliste),
      });
    }
    k.push({
      id: "dato",
      header: t("tabell.dato"),
      celle: (r) => (
        <span className="text-sm text-gray-700">
          {hentDataVerdi(r, (l) => l.toLowerCase() === "dato")}
        </span>
      ),
      sorterbar: true,
      sorterVerdi: (r) => hentDataVerdi(r, (l) => l.toLowerCase() === "dato"),
    });
    k.push({
      id: "arbeidsleder",
      header: t("hms.kolonne.arbeidsleder"),
      celle: (r) => <span className="text-sm text-gray-700">{hentArbeidsleder(r)}</span>,
      sorterbar: true,
      sorterVerdi: hentArbeidsleder,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, hentArbeidsleder),
    });
    k.push({
      id: "status",
      header: t("tabell.status"),
      celle: (r) => <StatusBadge status={r.status} />,
      bredde: "140px",
      sorterbar: true,
      sorterVerdi: (r) => r.status,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, (r) => r.status),
    });
    return k;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rader, visProsjektKolonne, visByggeplassKolonne, t]);

  return (
    <Table<DokumentRad>
      kolonner={kolonner}
      data={filtrerte}
      radNokkel={(r) => r.id}
      onRadKlikk={onKlikk}
      tomMelding={t("hms.tom.sja")}
      filterVerdier={filterVerdier}
      onFilterEndring={(kolId, verdi) => setFilterVerdier((prev) => ({ ...prev, [kolId]: verdi }))}
      kolonneBredder={kolonneBredder}
      onKolonneBreddeEndring={setKolonneBredder}
    />
  );
}

/* ============================================================================
 *  RuhTabell
 * ============================================================================ */

export function RuhTabell({
  rader,
  onKlikk,
  visProsjektKolonne = false,
  visByggeplassKolonne = false,
}: TabellProps) {
  const { t } = useTranslation();
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});
  const [kolonneBredder, setKolonneBredder] = useState<Record<string, number>>({});

  if (rader.length === 0) {
    return <EmptyState title={t("hms.tom.ruh")} description={t("hms.tom.ruhBeskrivelse")} />;
  }

  const hentProsjekt = (r: DokumentRad) => r.template.project?.name ?? "—";
  const hentTypeObservasjon = (r: DokumentRad) =>
    hentDataVerdi(r, (l) => l.toLowerCase().includes("type"));
  const hentInnmelder = (r: DokumentRad) =>
    hentDataVerdi(r, (l) => l.toLowerCase().includes("innmelder"));

  const feltMapping: Record<string, (r: DokumentRad) => string> = {
    prosjekt: hentProsjekt,
    byggeplass: byggeplassNavnSjekkliste,
    typeObservasjon: hentTypeObservasjon,
    innmelder: hentInnmelder,
    status: (r) => r.status,
  };

  const filtrerte = filtrerRader(rader, filterVerdier, feltMapping);

  const kolonner: KolDef[] = useMemo(() => {
    const k: KolDef[] = [];
    k.push({
      id: "nr",
      header: t("tabell.nr"),
      celle: (r) => (
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
          {r.template.prefix ? `${r.template.prefix}-${formaterLopenummer(r)}` : formaterLopenummer(r)}
        </span>
      ),
      bredde: "90px",
      sorterbar: true,
      sorterVerdi: (r) => r.number ?? 0,
    });
    k.push({
      id: "typeObservasjon",
      header: t("hms.kolonne.typeObservasjon"),
      celle: (r) => <span className="text-sm text-gray-700">{hentTypeObservasjon(r)}</span>,
      sorterbar: true,
      sorterVerdi: hentTypeObservasjon,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, hentTypeObservasjon),
    });
    if (visProsjektKolonne) {
      k.push({
        id: "prosjekt",
        header: t("firma.hms.kolonne.prosjekt"),
        celle: (r) => <span className="text-sm text-gray-700">{r.template.project?.name ?? "—"}</span>,
        sorterbar: true,
        sorterVerdi: (r) => r.template.project?.name ?? "",
        filtrerbar: true,
        filterAlternativer: unikeVerdier(rader, hentProsjekt),
      });
    }
    if (visByggeplassKolonne) {
      k.push({
        id: "byggeplass",
        header: t("firma.hms.kolonne.byggeplass"),
        celle: (r) => <span className="text-sm text-gray-700">{byggeplassNavnSjekkliste(r)}</span>,
        sorterbar: true,
        sorterVerdi: byggeplassNavnSjekkliste,
        filtrerbar: true,
        filterAlternativer: unikeVerdier(rader, byggeplassNavnSjekkliste),
      });
    }
    k.push({
      id: "innmelder",
      header: t("hms.kolonne.innmelder"),
      celle: (r) => <span className="text-sm text-gray-700">{hentInnmelder(r)}</span>,
      sorterbar: true,
      sorterVerdi: hentInnmelder,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, hentInnmelder),
    });
    k.push({
      id: "opprettelsesdato",
      header: t("tabell.opprettelsesdato"),
      celle: (r) => <span className="text-sm text-gray-700">{formaterDato(r.createdAt)}</span>,
      bredde: "120px",
      sorterbar: true,
      sorterVerdi: (r) => r.createdAt,
    });
    k.push({
      id: "status",
      header: t("tabell.status"),
      celle: (r) => <StatusBadge status={r.status} />,
      bredde: "140px",
      sorterbar: true,
      sorterVerdi: (r) => r.status,
      filtrerbar: true,
      filterAlternativer: unikeVerdier(rader, (r) => r.status),
    });
    return k;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rader, visProsjektKolonne, visByggeplassKolonne, t]);

  return (
    <Table<DokumentRad>
      kolonner={kolonner}
      data={filtrerte}
      radNokkel={(r) => r.id}
      onRadKlikk={onKlikk}
      tomMelding={t("hms.tom.ruh")}
      filterVerdier={filterVerdier}
      onFilterEndring={(kolId, verdi) => setFilterVerdier((prev) => ({ ...prev, [kolId]: verdi }))}
      kolonneBredder={kolonneBredder}
      onKolonneBreddeEndring={setKolonneBredder}
    />
  );
}
