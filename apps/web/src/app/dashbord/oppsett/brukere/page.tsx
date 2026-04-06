"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { Spinner } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Users,
  Settings,
  X,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  KompaktBadgeListe — viser første verdi + "+N" utvidbar             */
/* ------------------------------------------------------------------ */

function KompaktBadgeListe({
  verdier,
  bgKlasse,
  leggTilKnapp,
}: {
  verdier: string[];
  bgKlasse: string;
  leggTilKnapp?: React.ReactNode;
}) {
  const [utvidet, setUtvidet] = useState(false);

  if (verdier.length === 0) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400">—</span>
        {leggTilKnapp}
      </div>
    );
  }

  if (verdier.length === 1) {
    return (
      <div className="flex items-center gap-1">
        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${bgKlasse}`}>
          {verdier[0]}
        </span>
        {leggTilKnapp}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {utvidet ? (
        <>
          {verdier.map((v) => (
            <span key={v} className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${bgKlasse}`}>
              {v}
            </span>
          ))}
          <button
            onClick={() => setUtvidet(false)}
            className="rounded px-1 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </>
      ) : (
        <>
          <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${bgKlasse}`}>
            {verdier[0]}
          </span>
          <button
            onClick={() => setUtvidet(true)}
            className="inline-flex rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-300"
          >
            +{verdier.length - 1}
          </button>
        </>
      )}
      {leggTilKnapp}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KontaktTabell                                                      */
/* ------------------------------------------------------------------ */

interface KontaktMedlem {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    organization?: { id: string; name: string } | null;
  };
  enterprises: Array<{
    enterprise: { id: string; name: string; color: string | null };
  }>;
}

function KontaktTabell({ prosjektId }: { prosjektId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [leggTilEntrepriseForMedlem, setLeggTilEntrepriseForMedlem] = useState<string | null>(null);
  const [kollapserteGrupper, setKollapserteGrupper] = useState<Set<string>>(new Set());
  const [redigerMedlemId, setRedigerMedlemId] = useState<string | null>(null);
  const [redigerData, setRedigerData] = useState({ name: "", email: "", phone: "", role: "" });
  const [filterNavn, setFilterNavn] = useState("");
  const [filterRolle, setFilterRolle] = useState("");
  const [filterEntreprise, setFilterEntreprise] = useState("");
  const [filterGruppe, setFilterGruppe] = useState("");
  const [redigerGruppeNavn, setRedigerGruppeNavn] = useState<string | null>(null);
  const [nyGruppeNavnVerdi, setNyGruppeNavnVerdi] = useState("");
  const [leggTilMedlemIGruppe, setLeggTilMedlemIGruppe] = useState<string | null>(null);

  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const { data: alleEntrepriser } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const { data: dbGrupper } = trpc.gruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const tilknyttMutation = trpc.medlem.tilknyttEntreprise.useMutation({
    onSuccess: () => {
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
      setLeggTilEntrepriseForMedlem(null);
    },
  });

  const fjernMutation = trpc.medlem.fjernFraEntreprise.useMutation({
    onSuccess: () => {
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const oppdaterGruppeMutation = trpc.gruppe.oppdater.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      setRedigerGruppeNavn(null);
      setNyGruppeNavnVerdi("");
    },
  });

  const slettGruppeMutation = trpc.gruppe.slett.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const leggTilMedlemMutation = trpc.gruppe.leggTilMedlem.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
      setLeggTilMedlemIGruppe(null);
    },
  });

  const fjernMedlemMutation = trpc.gruppe.fjernMedlem.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const oppdaterModulerMutation = trpc.gruppe.oppdaterModuler.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const [redigerModulerGruppe, setRedigerModulerGruppe] = useState<string | null>(null);

  const oppdaterMedlemMutation = trpc.medlem.oppdater.useMutation({
    onSuccess: () => {
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
      setRedigerMedlemId(null);
    },
  });

  const startRediger = (m: KontaktMedlem) => {
    setRedigerMedlemId(m.id);
    setRedigerData({
      name: m.user.name ?? "",
      email: m.user.email,
      phone: m.user.phone ?? "",
      role: m.role,
    });
  };

  const lagreRediger = (medlemId: string) => {
    oppdaterMedlemMutation.mutate({
      id: medlemId,
      projectId: prosjektId,
      name: redigerData.name.trim() || undefined,
      email: redigerData.email.trim() || undefined,
      phone: redigerData.phone.trim() || undefined,
      role: (redigerData.role as "member" | "admin") || undefined,
    });
  };

  // Bygg gruppe-map: userId → gruppenavn[]
  const gruppeMap: Record<string, string[]> = {};
  if (dbGrupper) {
    for (const g of dbGrupper as Array<{ name: string; members: Array<{ projectMember: { user: { id: string } } }> }>) {
      for (const m of g.members) {
        const userId = m.projectMember.user.id;
        if (!gruppeMap[userId]) gruppeMap[userId] = [];
        gruppeMap[userId].push(g.name);
      }
    }
  }

  // Bygg gruppeNavn → gruppeId map og gruppeId → userId → gruppeMedlemId map
  const gruppeNavnTilId = useMemo((): Record<string, string> => {
    const map: Record<string, string> = {};
    if (dbGrupper) {
      for (const g of dbGrupper as Array<{ id: string; name: string }>) {
        map[g.name] = g.id;
      }
    }
    return map;
  }, [dbGrupper]);

  // Bygg gruppeId → modules map
  const gruppeModuler = useMemo((): Record<string, string[]> => {
    const map: Record<string, string[]> = {};
    if (dbGrupper) {
      for (const g of dbGrupper as Array<{ id: string; modules: unknown }>) {
        map[g.id] = (g.modules as string[] | null) ?? [];
      }
    }
    return map;
  }, [dbGrupper]);

  const gruppeMedlemIdMap = useMemo((): Record<string, Record<string, string>> => {
    // gruppeId → userId → gruppeMedlemId
    const map: Record<string, Record<string, string>> = {};
    if (dbGrupper) {
      for (const g of dbGrupper as Array<{ id: string; members: Array<{ id: string; projectMember: { user: { id: string } } | null }> }>) {
        const innerMap: Record<string, string> = {};
        for (const m of g.members) {
          if (m.projectMember?.user?.id) {
            innerMap[m.projectMember.user.id] = m.id;
          }
        }
        map[g.id] = innerMap;
      }
    }
    return map;
  }, [dbGrupper]);

  // Bygg map fra userId → brukerinfo for leggTilMedlem
  const medlemTilPmId = useMemo((): Record<string, { id: string; email: string; name: string | null; phone: string | null }> => {
    const map: Record<string, { id: string; email: string; name: string | null; phone: string | null }> = {};
    if (medlemmer) {
      for (const m of medlemmer as KontaktMedlem[]) {
        map[m.user.id] = { id: m.id, email: m.user.email, name: m.user.name, phone: m.user.phone };
      }
    }
    return map;
  }, [medlemmer]);

  const kontakterRå = (medlemmer ?? []) as KontaktMedlem[];

  // Filtrer kontakter
  const kontakter = useMemo(() => {
    let resultat = kontakterRå;
    if (filterNavn) {
      const søk = filterNavn.toLowerCase();
      resultat = resultat.filter((m) =>
        (m.user.name ?? "").toLowerCase().includes(søk) ||
        m.user.email.toLowerCase().includes(søk) ||
        (m.user.phone ?? "").includes(søk),
      );
    }
    if (filterRolle) {
      resultat = resultat.filter((m) => m.role === filterRolle);
    }
    if (filterEntreprise) {
      resultat = resultat.filter((m) =>
        m.enterprises.some((e) => e.enterprise.id === filterEntreprise),
      );
    }
    if (filterGruppe) {
      const gUserIder = new Set(
        (dbGrupper as Array<{ id: string; members: Array<{ projectMember: { user: { id: string } } | null }> }> ?? [])
          .find((g) => g.id === filterGruppe)?.members
          .map((gm) => gm.projectMember?.user?.id)
          .filter(Boolean) ?? [],
      );
      resultat = resultat.filter((m) => gUserIder.has(m.user.id));
    }
    return resultat;
  }, [kontakterRå, filterNavn, filterRolle, filterEntreprise, filterGruppe, dbGrupper]);

  // Grupper kontakter etter brukergruppe med overskrifter (deduplisert)
  const gruppertKontakter = useMemo(() => {
    const rader: Array<{ type: "header"; gruppeNavn: string; antall: number } | { type: "medlem"; medlem: KontaktMedlem; gruppeNavn: string }> = [];
    const brukteMedlemIder = new Set<string>();

    const brukerGrupperListe = dbGrupper
      ? (dbGrupper as Array<{ id: string; name: string; category: string; members: Array<{ projectMember: { user: { id: string } } | null }> }>)
          .filter((g) => g.category === "brukergrupper")
      : [];

    for (const g of brukerGrupperListe) {
      // Filtrer bort allerede viste medlemmer (deduplisering)
      const gruppeKontakter = kontakter.filter((m) =>
        !brukteMedlemIder.has(m.id) &&
        g.members.some((gm) => gm.projectMember?.user?.id === m.user.id),
      );
      rader.push({ type: "header", gruppeNavn: g.name, antall: gruppeKontakter.length });
      for (const m of gruppeKontakter) {
        rader.push({ type: "medlem", medlem: m, gruppeNavn: g.name });
        brukteMedlemIder.add(m.id);
      }
    }

    const utenGruppe = kontakter.filter((m) => !brukteMedlemIder.has(m.id));
    if (utenGruppe.length > 0) {
      const utenGruppeNavn = t("brukere.utenGruppe");
      rader.push({ type: "header", gruppeNavn: utenGruppeNavn, antall: utenGruppe.length });
      for (const m of utenGruppe) {
        rader.push({ type: "medlem", medlem: m, gruppeNavn: utenGruppeNavn });
      }
    }

    return rader;
  }, [kontakter, dbGrupper, t]);

  return (
    <div className="mb-6">
      <h2 className="mb-4 text-xl font-bold text-gray-900">{t("brukere.kontakter")}</h2>
      <div className="rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5">{t("tabell.navn")}</th>
              <th className="px-4 py-2.5">{t("kontakter.epost")}</th>
              <th className="px-4 py-2.5">{t("kontakter.telefon")}</th>
              <th className="px-4 py-2.5">{t("kontakter.firma")}</th>
              <th className="px-4 py-2.5">{t("kontakter.rolle")}</th>
              <th className="px-4 py-2.5">{t("kontakter.entrepriser")}</th>
              <th className="px-4 py-2.5">{t("kontakter.grupper")}</th>
            </tr>
            {/* Filterrad */}
            <tr className="border-b border-gray-200 bg-gray-50">
              <th colSpan={3} className="px-4 py-1.5">
                <input
                  type="text"
                  value={filterNavn}
                  onChange={(e) => setFilterNavn(e.target.value)}
                  placeholder={t("handling.sok")}
                  className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
                />
              </th>
              <th className="px-4 py-1.5" />
              <th className="px-4 py-1.5">
                <select
                  value={filterRolle}
                  onChange={(e) => setFilterRolle(e.target.value)}
                  className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-700 focus:border-blue-400 focus:outline-none"
                >
                  <option value="">{t("status.alle")}</option>
                  <option value="admin">Admin</option>
                  <option value="member">{t("kontakter.medlem")}</option>
                </select>
              </th>
              <th className="px-4 py-1.5">
                <select
                  value={filterEntreprise}
                  onChange={(e) => setFilterEntreprise(e.target.value)}
                  className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-700 focus:border-blue-400 focus:outline-none"
                >
                  <option value="">{t("status.alle")}</option>
                  {(alleEntrepriser as Array<{ id: string; name: string }> ?? []).map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </th>
              <th className="px-4 py-1.5">
                <select
                  value={filterGruppe}
                  onChange={(e) => setFilterGruppe(e.target.value)}
                  className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-700 focus:border-blue-400 focus:outline-none"
                >
                  <option value="">{t("status.alle")}</option>
                  {(dbGrupper as Array<{ id: string; name: string; category: string }> ?? [])
                    .filter((g) => g.category === "brukergrupper")
                    .map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))
                  }
                </select>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gruppertKontakter.map((rad, idx) => {
              if (rad.type === "header") {
                const erKollapset = kollapserteGrupper.has(rad.gruppeNavn);
                const gruppeId = gruppeNavnTilId[rad.gruppeNavn];
                const erUtenGruppe = !gruppeId;
                const toggleKollaps = () => {
                  setKollapserteGrupper((prev) => {
                    const ny = new Set(prev);
                    ny.has(rad.gruppeNavn) ? ny.delete(rad.gruppeNavn) : ny.add(rad.gruppeNavn);
                    return ny;
                  });
                };

                // Medlemmer som ikke allerede er i denne gruppen (for legg-til-dropdown)
                const medlemmerIkkeIGruppe = gruppeId
                  ? kontakterRå.filter((k) => !gruppeMedlemIdMap[gruppeId]?.[k.user.id])
                  : [];

                return (
                  <tr
                    key={`header-${idx}`}
                    className="group/gheader bg-gray-100 border-t-2 border-gray-200 cursor-pointer hover:bg-gray-200/80"
                  >
                    <td colSpan={7} className="px-4 py-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-600">
                        <span onClick={toggleKollaps} className="flex items-center gap-2">
                          {erKollapset
                            ? <ChevronRight className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />
                          }
                          <Users className="h-3.5 w-3.5" />
                        </span>

                        {/* Inline rename or group name */}
                        {redigerGruppeNavn === rad.gruppeNavn && gruppeId ? (
                          <input
                            type="text"
                            value={nyGruppeNavnVerdi}
                            onChange={(e) => setNyGruppeNavnVerdi(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && nyGruppeNavnVerdi.trim()) {
                                oppdaterGruppeMutation.mutate({
                                  id: gruppeId,
                                  name: nyGruppeNavnVerdi.trim(),
                                  projectId: prosjektId,
                                });
                              } else if (e.key === "Escape") {
                                setRedigerGruppeNavn(null);
                                setNyGruppeNavnVerdi("");
                              }
                            }}
                            onBlur={() => {
                              if (nyGruppeNavnVerdi.trim() && nyGruppeNavnVerdi.trim() !== rad.gruppeNavn) {
                                oppdaterGruppeMutation.mutate({
                                  id: gruppeId,
                                  name: nyGruppeNavnVerdi.trim(),
                                  projectId: prosjektId,
                                });
                              } else {
                                setRedigerGruppeNavn(null);
                                setNyGruppeNavnVerdi("");
                              }
                            }}
                            autoFocus
                            className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs font-semibold uppercase text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span onClick={toggleKollaps}>{rad.gruppeNavn}</span>
                        )}

                        <span className="font-normal text-gray-400" onClick={toggleKollaps}>({rad.antall})</span>

                        {/* Modul-badges */}
                        {!erUtenGruppe && gruppeId && (() => {
                          const moduler = gruppeModuler[gruppeId] ?? [];
                          const MODUL_LABELS: Record<string, { label: string; bg: string }> = {
                            sjekklister: { label: t("nav.sjekklister"), bg: "bg-green-100 text-green-700" },
                            oppgaver: { label: t("nav.oppgaver"), bg: "bg-blue-100 text-blue-700" },
                            tegninger: { label: t("nav.tegninger"), bg: "bg-amber-100 text-amber-700" },
                            "3d": { label: "3D", bg: "bg-purple-100 text-purple-700" },
                          };
                          const erRedigerer = redigerModulerGruppe === gruppeId;
                          const alleModulNavn: Array<"sjekklister" | "oppgaver" | "tegninger" | "3d"> = ["sjekklister", "oppgaver", "tegninger", "3d"];

                          return (
                            <div className="ml-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {erRedigerer ? (
                                <>
                                  {alleModulNavn.map((mod) => {
                                    const info = MODUL_LABELS[mod]!;
                                    const erAktiv = moduler.includes(mod);
                                    return (
                                      <button
                                        key={mod}
                                        onClick={() => {
                                          const nyeModuler = erAktiv
                                            ? moduler.filter((m) => m !== mod) as typeof alleModulNavn
                                            : [...moduler, mod] as typeof alleModulNavn;
                                          oppdaterModulerMutation.mutate({
                                            groupId: gruppeId,
                                            projectId: prosjektId,
                                            modules: nyeModuler,
                                          });
                                        }}
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal transition-colors ${
                                          erAktiv ? info.bg : "bg-gray-100 text-gray-400 line-through"
                                        }`}
                                      >
                                        {info.label}
                                      </button>
                                    );
                                  })}
                                  <button
                                    onClick={() => setRedigerModulerGruppe(null)}
                                    className="rounded p-0.5 text-gray-400 hover:text-gray-600"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {moduler.map((mod) => {
                                    const info = MODUL_LABELS[mod];
                                    if (!info) return null;
                                    return (
                                      <span key={mod} className={`rounded px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal ${info.bg}`}>
                                        {info.label}
                                      </span>
                                    );
                                  })}
                                  {moduler.length === 0 && (
                                    <span className="text-[10px] font-normal normal-case tracking-normal text-gray-400 italic">{t("brukere.ingenModuler")}</span>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })()}

                        {/* Action buttons - visible on hover, only for real groups */}
                        {!erUtenGruppe && (
                          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover/gheader:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRedigerModulerGruppe((prev) => prev === gruppeId ? null : gruppeId!);
                              }}
                              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                              title={t("brukere.redigerModuler")}
                            >
                              <Settings className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRedigerGruppeNavn(rad.gruppeNavn);
                                setNyGruppeNavnVerdi(rad.gruppeNavn);
                              }}
                              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                              title={t("handling.rediger")}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLeggTilMedlemIGruppe((prev) => prev === gruppeId ? null : gruppeId!);
                              }}
                              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                              title={t("brukere.leggTilMedlem")}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(t("brukere.slettGruppeBekreftelse"))) {
                                  slettGruppeMutation.mutate({ id: gruppeId!, projectId: prosjektId });
                                }
                              }}
                              className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                              title={t("brukere.slettGruppe")}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Add member dropdown */}
                      {leggTilMedlemIGruppe === gruppeId && gruppeId && (
                        <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <select
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                            onChange={(e) => {
                              if (e.target.value) {
                                const info = medlemTilPmId[e.target.value];
                                if (info) {
                                  const nameParts = (info.name ?? "").split(" ");
                                  const firstName = nameParts[0] || info.email;
                                  const lastName = nameParts.slice(1).join(" ") || "-";
                                  leggTilMedlemMutation.mutate({
                                    groupId: gruppeId,
                                    projectId: prosjektId,
                                    email: info.email,
                                    firstName,
                                    lastName,
                                    phone: info.phone ?? undefined,
                                  });
                                }
                              }
                            }}
                            onBlur={() => setLeggTilMedlemIGruppe(null)}
                            autoFocus
                            defaultValue=""
                          >
                            <option value="" disabled>{t("brukere.velgMedlem")}</option>
                            {medlemmerIkkeIGruppe.map((k) => {
                              const entrepriseNavn = k.enterprises.map((e) => e.enterprise.name).join(", ");
                              return (
                                <option key={k.user.id} value={k.user.id}>
                                  {k.user.name ?? k.user.email}{entrepriseNavn ? ` · ${entrepriseNavn}` : ""}
                                </option>
                              );
                            })}
                          </select>
                          <button
                            onClick={() => setLeggTilMedlemIGruppe(null)}
                            className="rounded p-0.5 text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }

              if (kollapserteGrupper.has(rad.gruppeNavn)) return null;

              const m = rad.medlem;
              const brukerGrupper = gruppeMap[m.user.id] ?? [];
              const entrepriseIder = new Set(m.enterprises.map((e) => e.enterprise.id));
              const tilgjengeligeEntrepriser = (alleEntrepriser ?? []).filter(
                (e: { id: string }) => !entrepriseIder.has(e.id),
              );
              const radGruppeId = gruppeNavnTilId[rad.gruppeNavn];
              const gruppeMedlemId = radGruppeId
                ? gruppeMedlemIdMap[radGruppeId]?.[m.user.id]
                : undefined;

              const erRedigering = redigerMedlemId === m.id;

              return (
                <tr key={`${m.id}-${rad.gruppeNavn}`} className="group/mrow hover:bg-gray-50">
                  {/* Navn */}
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">
                    <div className="flex items-center gap-1.5">
                      {erRedigering ? (
                        <input
                          value={redigerData.name}
                          onChange={(e) => setRedigerData((p) => ({ ...p, name: e.target.value }))}
                          className="w-full rounded border border-blue-300 px-1.5 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-400"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") lagreRediger(m.id);
                            if (e.key === "Escape") setRedigerMedlemId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span
                            className="cursor-pointer hover:text-blue-600"
                            onClick={() => startRediger(m)}
                            title={t("handling.rediger")}
                          >
                            {m.user.name ?? "—"}
                          </span>
                          {radGruppeId && gruppeMedlemId && (
                            <button
                              onClick={() => fjernMedlemMutation.mutate({ id: gruppeMedlemId, projectId: prosjektId })}
                              className="rounded p-0.5 text-gray-300 opacity-0 group-hover/mrow:opacity-100 hover:bg-red-50 hover:text-red-500 transition-opacity"
                              title={t("brukere.fjernMedlem")}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>

                  {/* E-post */}
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                    {erRedigering ? (
                      <input
                        value={redigerData.email}
                        onChange={(e) => setRedigerData((p) => ({ ...p, email: e.target.value }))}
                        className="w-full rounded border border-blue-300 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") lagreRediger(m.id);
                          if (e.key === "Escape") setRedigerMedlemId(null);
                        }}
                      />
                    ) : (
                      m.user.email
                    )}
                  </td>

                  {/* Telefon */}
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                    {erRedigering ? (
                      <input
                        value={redigerData.phone}
                        onChange={(e) => setRedigerData((p) => ({ ...p, phone: e.target.value }))}
                        className="w-full rounded border border-blue-300 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") lagreRediger(m.id);
                          if (e.key === "Escape") setRedigerMedlemId(null);
                        }}
                      />
                    ) : (
                      m.user.phone ?? "—"
                    )}
                  </td>

                  {/* Firma */}
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                    {(m.user as KontaktMedlem["user"]).organization?.name ?? "—"}
                  </td>

                  {/* Rolle */}
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {erRedigering ? (
                      <select
                        value={redigerData.role}
                        onChange={(e) => setRedigerData((p) => ({ ...p, role: e.target.value }))}
                        className="rounded border border-blue-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="member">{t("kontakter.medlem")}</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                        m.role === "admin"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {m.role === "admin" ? "Admin" : t("kontakter.medlem")}
                      </span>
                    )}
                  </td>

                  {/* Entrepriser (kompakt) */}
                  <td className="px-4 py-2.5">
                    <KompaktBadgeListe
                      verdier={m.enterprises.map((me) => me.enterprise.name)}
                      bgKlasse="bg-gray-100 text-gray-700"
                      leggTilKnapp={
                        leggTilEntrepriseForMedlem === m.id ? (
                          <select
                            className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs"
                            onChange={(e) => {
                              if (e.target.value) {
                                tilknyttMutation.mutate({
                                  projectMemberId: m.id,
                                  enterpriseId: e.target.value,
                                  projectId: prosjektId,
                                });
                              }
                            }}
                            onBlur={() => setLeggTilEntrepriseForMedlem(null)}
                            autoFocus
                            defaultValue=""
                          >
                            <option value="" disabled>{t("kontakter.velgEntreprise")}</option>
                            {tilgjengeligeEntrepriser.map((e: { id: string; name: string }) => (
                              <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setLeggTilEntrepriseForMedlem(m.id)}
                            className="rounded px-1 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title={t("kontakter.leggTilEntreprise")}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )
                      }
                    />
                  </td>

                  {/* Grupper */}
                  <td className="px-4 py-2.5">
                    {erRedigering ? (
                      <div className="space-y-1">
                        {/* Nåværende grupper med fjern-knapp */}
                        <div className="flex flex-wrap gap-1">
                          {brukerGrupper.map((gNavn) => {
                            const gId = gruppeNavnTilId[gNavn];
                            const gmId = gId ? gruppeMedlemIdMap[gId]?.[m.user.id] : undefined;
                            return (
                              <span key={gNavn} className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                                {gNavn}
                                {gmId && (
                                  <button
                                    onClick={() => fjernMedlemMutation.mutate({ id: gmId, projectId: prosjektId })}
                                    className="ml-0.5 rounded-full hover:bg-blue-200 p-0.5"
                                    title={t("handling.fjern")}
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                        {/* Legg til i gruppe */}
                        <select
                          className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs w-full"
                          onChange={(e) => {
                            if (e.target.value) {
                              const nameParts = (m.user.name ?? "").split(" ");
                              leggTilMedlemMutation.mutate({
                                groupId: e.target.value,
                                projectId: prosjektId,
                                email: m.user.email,
                                firstName: nameParts[0] || m.user.email,
                                lastName: nameParts.slice(1).join(" ") || "-",
                              });
                              e.target.value = "";
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="">{t("brukere.leggTilGruppe")}</option>
                          {(dbGrupper as Array<{ id: string; name: string; category: string }> ?? [])
                            .filter((g) => g.category === "brukergrupper" && !brukerGrupper.includes(g.name))
                            .map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))
                          }
                        </select>
                        {/* Lagre/Avbryt */}
                        <div className="flex items-center gap-1 mt-1">
                          <button
                            onClick={() => lagreRediger(m.id)}
                            className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700"
                          >
                            {t("handling.lagre")}
                          </button>
                          <button
                            onClick={() => setRedigerMedlemId(null)}
                            className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                          >
                            {t("handling.avbryt")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <KompaktBadgeListe
                        verdier={brukerGrupper}
                        bgKlasse="bg-blue-50 text-blue-700"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Hovudside                                                          */
/* ------------------------------------------------------------------ */

export default function BrukereSide() {
  const { prosjektId } = useProsjekt();
  if (!prosjektId) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  return <KontaktTabell prosjektId={prosjektId} />;
}
