"use client";

import { useState, useMemo } from "react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  User,
  Users,
  FileText,
  Mail,
  Phone,
  ArrowRight,
  Send,
  ClipboardCheck,
  CheckCircle2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface Entreprise {
  id: string;
  name: string;
  color: string | null;
  industry: string | null;
  ansvarligId: string | null;
}

interface ProsjektMedlem {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
  enterprises: Array<{
    enterprise: { id: string; name: string };
  }>;
}

interface DokumentflytMedlem {
  rolle: string;
  erHovedansvarlig: boolean;
  steg: number;
  projectMember?: { id: string; user: { id: string; name: string | null } } | null;
  group?: { id: string; name: string } | null;
}

interface Dokumentflyt {
  id: string;
  name: string;
  enterpriseId: string | null;
  medlemmer: DokumentflytMedlem[];
  maler: Array<{ template: { id: string; name: string; category: string } }>;
}

/* ------------------------------------------------------------------ */
/*  Fargeprikk                                                         */
/* ------------------------------------------------------------------ */

const FARGE_MAP: Record<string, string> = {
  "red": "bg-red-500", "orange": "bg-orange-500", "amber": "bg-amber-500",
  "yellow": "bg-yellow-500", "lime": "bg-lime-500", "green": "bg-green-500",
  "emerald": "bg-emerald-500", "teal": "bg-teal-500", "cyan": "bg-cyan-500",
  "sky": "bg-sky-500", "blue": "bg-blue-500", "indigo": "bg-indigo-500",
  "violet": "bg-violet-500", "purple": "bg-purple-500", "fuchsia": "bg-fuchsia-500",
  "pink": "bg-pink-500", "rose": "bg-rose-500", "slate": "bg-slate-500",
};

function EntrepriseFargePrikk({ farge }: { farge: string | null }) {
  const bg = farge ? FARGE_MAP[farge] ?? "bg-gray-400" : "bg-gray-400";
  return <span className={`inline-block h-3 w-3 rounded-full ${bg} shrink-0`} />;
}

/* ------------------------------------------------------------------ */
/*  Hovedkomponent                                                     */
/* ------------------------------------------------------------------ */

export default function KontakterSide() {
  const { prosjektId } = useProsjekt();
  const { t } = useTranslation();
  const [utvidetEntreprise, setUtvidetEntreprise] = useState<Set<string>>(new Set());

  // Hent data
  const { data: entrepriser, isLoading: e1 } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const { data: medlemmer, isLoading: e2 } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const { data: dokumentflyter, isLoading: e3 } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const erLaster = e1 || e2 || e3;

  // Bygg oppslag: entrepriseId → kontakter (prosjektmedlemmer tilknyttet entreprisen)
  const entrepriseKontakter = useMemo(() => {
    const map = new Map<string, ProsjektMedlem[]>();
    if (!medlemmer) return map;
    const alle = medlemmer as ProsjektMedlem[];
    for (const m of alle) {
      for (const me of m.enterprises) {
        const liste = map.get(me.enterprise.id) ?? [];
        liste.push(m);
        map.set(me.enterprise.id, liste);
      }
    }
    return map;
  }, [medlemmer]);

  // Bygg oppslag: entrepriseId → dokumentflyter
  const entrepriseDokumentflyter = useMemo(() => {
    const map = new Map<string, Dokumentflyt[]>();
    if (!dokumentflyter) return map;
    const alle = dokumentflyter as Dokumentflyt[];
    for (const df of alle) {
      if (!df.enterpriseId) continue;
      const liste = map.get(df.enterpriseId) ?? [];
      liste.push(df);
      map.set(df.enterpriseId, liste);
    }
    return map;
  }, [dokumentflyter]);

  // Finn ansvarlig (🔵) og godkjenner (🟡) per entreprise fra dokumentflyt
  const entrepriseAnsvarlige = useMemo(() => {
    const map = new Map<string, { sjekklisteAnsvarlig: string | null; godkjennerAnsvarlig: string | null }>();
    if (!dokumentflyter) return map;
    const alle = dokumentflyter as Dokumentflyt[];

    for (const df of alle) {
      if (!df.enterpriseId) continue;

      // Finn svarer-hovedansvarlig
      const svarere = df.medlemmer.filter((m) => m.rolle === "svarer");
      const hovedansvarlig = svarere.find((m) => m.erHovedansvarlig) ?? svarere[0];
      const ansvarligNavn = hovedansvarlig?.projectMember?.user?.name
        ?? hovedansvarlig?.group?.name
        ?? null;

      // Finn oppretter-hovedansvarlig (godkjenner)
      const opprettere = df.medlemmer.filter((m) => m.rolle === "oppretter");
      const hovedoppretter = opprettere.find((m) => m.erHovedansvarlig) ?? opprettere[0];
      const godkjennerNavn = hovedoppretter?.projectMember?.user?.name
        ?? hovedoppretter?.group?.name
        ?? null;

      const eksisterende = map.get(df.enterpriseId);
      map.set(df.enterpriseId, {
        sjekklisteAnsvarlig: ansvarligNavn ?? eksisterende?.sjekklisteAnsvarlig ?? null,
        godkjennerAnsvarlig: godkjennerNavn ?? eksisterende?.godkjennerAnsvarlig ?? null,
      });
    }
    return map;
  }, [dokumentflyter]);

  const toggleUtvidet = (id: string) => {
    setUtvidetEntreprise((prev) => {
      const ny = new Set(prev);
      ny.has(id) ? ny.delete(id) : ny.add(id);
      return ny;
    });
  };

  if (erLaster) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const alleEntrepriser = (entrepriser ?? []) as Entreprise[];

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{t("kontakter.tittel")}</h2>
        <p className="text-sm text-gray-500">{t("kontakter.beskrivelse")}</p>
      </div>

      {/* Tabell-header */}
      <div className="rounded-t-lg border border-gray-200 bg-gray-50 px-4 py-2">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          <div className="col-span-4">{t("tabell.entreprise")}</div>
          <div className="col-span-5">{t("kontakter.dokumentflyter")}</div>
          <div className="col-span-3">{t("kontakter.kontakter")}</div>
        </div>
      </div>

      {/* Entreprise-rader */}
      <div className="divide-y divide-gray-200 rounded-b-lg border-x border-b border-gray-200">
        {alleEntrepriser.map((ent) => {
          const erUtvidet = utvidetEntreprise.has(ent.id);
          const kontakter = entrepriseKontakter.get(ent.id) ?? [];
          const dflyter = entrepriseDokumentflyter.get(ent.id) ?? [];
          const ansvarlige = entrepriseAnsvarlige.get(ent.id);
          const antallMaler = dflyter.reduce((sum, df) => sum + df.maler.length, 0);

          return (
            <div key={ent.id}>
              {/* Hovedrad */}
              <button
                onClick={() => toggleUtvidet(ent.id)}
                className="flex w-full items-center px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="grid grid-cols-12 gap-2 w-full items-center">
                  <div className="col-span-4 flex items-center gap-2">
                    {erUtvidet
                      ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                    }
                    <EntrepriseFargePrikk farge={ent.color} />
                    <span className="font-medium text-gray-900">{ent.name}</span>
                  </div>
                  <div className="col-span-5 flex flex-wrap gap-1.5">
                    {dflyter.length === 0
                      ? <span className="text-xs text-gray-300">{t("kontakter.ingenFlyter")}</span>
                      : dflyter.map((df) => (
                          <span key={df.id} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                            {df.name}
                          </span>
                        ))
                    }
                  </div>
                  <div className="col-span-3 text-sm text-gray-400">
                    {kontakter.length > 0 ? `${kontakter.length} ${t("kontakter.personerSuffix")}` : "—"}
                  </div>
                </div>
              </button>

              {/* Utvidet innhold */}
              {erUtvidet && (
                <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4 space-y-4">

                  {/* Dokumentflyter — visuell flyt */}
                  {dflyter.map((df) => {
                    const opprettere = df.medlemmer.filter((m) => m.rolle === "oppretter");
                    const svarere = df.medlemmer.filter((m) => m.rolle === "svarer");

                    return (
                      <div key={df.id} className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-700">{df.name}</span>
                        </div>

                        {/* Visuell flyt: Oppretter → Svarer → Godkjenner */}
                        <div className="flex items-stretch gap-0">
                          {/* Oppretter-boks */}
                          <div className="flex-1 rounded-l-lg border border-blue-200 bg-blue-50/50 p-3">
                            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600">
                              <Send className="h-3 w-3" />
                              {t("kontakter.oppretter")}
                            </div>
                            <div className="text-xs text-blue-500 mb-2">{t("kontakter.oppretterBeskrivelse")}</div>
                            {opprettere.length === 0
                              ? <span className="text-xs text-gray-400">—</span>
                              : opprettere.map((m, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-sm text-gray-700">
                                    {m.group ? <Users className="h-3.5 w-3.5 text-blue-400" /> : <User className="h-3.5 w-3.5 text-blue-400" />}
                                    <span className={m.erHovedansvarlig ? "font-semibold" : ""}>
                                      {m.projectMember?.user?.name ?? m.group?.name ?? "—"}
                                    </span>
                                    {m.erHovedansvarlig && <span className="ml-1 text-blue-500 text-xs">●</span>}
                                  </div>
                                ))
                            }
                          </div>

                          {/* Pil */}
                          <div className="flex items-center px-2">
                            <ArrowRight className="h-5 w-5 text-gray-300" />
                          </div>

                          {/* Svarer-boks */}
                          <div className="flex-1 border border-purple-200 bg-purple-50/50 p-3">
                            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-600">
                              <ClipboardCheck className="h-3 w-3" />
                              {t("kontakter.svarerLabel")}
                            </div>
                            <div className="text-xs text-purple-500 mb-2">{t("kontakter.svarerBeskrivelse")}</div>
                            {svarere.length === 0
                              ? <span className="text-xs text-gray-400">—</span>
                              : svarere.map((m, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-sm text-gray-700">
                                    {m.group ? <Users className="h-3.5 w-3.5 text-purple-400" /> : <User className="h-3.5 w-3.5 text-purple-400" />}
                                    <span className={m.erHovedansvarlig ? "font-semibold" : ""}>
                                      {m.projectMember?.user?.name ?? m.group?.name ?? "—"}
                                    </span>
                                    {m.erHovedansvarlig && <span className="ml-1 text-purple-500 text-xs">●</span>}
                                  </div>
                                ))
                            }
                          </div>

                          {/* Pil */}
                          <div className="flex items-center px-2">
                            <ArrowRight className="h-5 w-5 text-gray-300" />
                          </div>

                          {/* Godkjenner-boks (oppretter godkjenner etter besvarelse) */}
                          <div className="flex-1 rounded-r-lg border border-green-200 bg-green-50/50 p-3">
                            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("kontakter.godkjenner")}
                            </div>
                            <div className="text-xs text-green-500 mb-2">{t("kontakter.godkjennerBeskrivelse")}</div>
                            {opprettere.length === 0
                              ? <span className="text-xs text-gray-400">—</span>
                              : opprettere.map((m, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-sm text-gray-700">
                                    {m.group ? <Users className="h-3.5 w-3.5 text-green-400" /> : <User className="h-3.5 w-3.5 text-green-400" />}
                                    <span className={m.erHovedansvarlig ? "font-semibold" : ""}>
                                      {m.projectMember?.user?.name ?? m.group?.name ?? "—"}
                                    </span>
                                    {m.erHovedansvarlig && <span className="ml-1 text-green-500 text-xs">●</span>}
                                  </div>
                                ))
                            }
                          </div>
                        </div>

                        {/* Maler */}
                        {df.maler.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {df.maler.map((m) => (
                              <span
                                key={m.template.id}
                                className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                              >
                                {m.template.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {dflyter.length === 0 && (
                    <p className="text-xs text-gray-400 italic">{t("kontakter.ingenFlyter")}</p>
                  )}

                  {/* Kontaktliste */}
                  {kontakter.length > 0 && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                        <Users className="h-3.5 w-3.5" />
                        {t("kontakter.kontakter")} ({kontakter.length})
                      </h4>
                      <div className="space-y-1">
                        {kontakter.map((k) => (
                          <div
                            key={k.id}
                            className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-sm"
                          >
                            <User className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="font-medium text-gray-700 min-w-[140px]">
                              {k.user.name ?? "—"}
                            </span>
                            <span className="text-xs text-gray-400">{k.role === "admin" ? "Admin" : ""}</span>
                            <div className="ml-auto flex items-center gap-4 text-xs text-gray-400">
                              {k.user.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {k.user.email}
                                </span>
                              )}
                              {k.user.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {k.user.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
