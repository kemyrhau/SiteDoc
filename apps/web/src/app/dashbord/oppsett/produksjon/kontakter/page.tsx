"use client";

import { useState, useMemo } from "react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Spinner, Button } from "@sitedoc/ui";
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
  X,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  LeggTilMedlemDropdown,
  InviterNyMedlemModal,
} from "../_components/dokumentflyt-komponenter";
import type { DokumentflytMedlemData } from "../_components/dokumentflyt-komponenter";

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
  id: string;
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
/*  NyDokumentflytKnapp                                                */
/* ------------------------------------------------------------------ */

function NyDokumentflytKnapp({ entrepriseId: enterpriseId, prosjektId }: { entrepriseId: string; prosjektId: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [visInput, setVisInput] = useState(false);
  const [navn, setNavn] = useState("");

  const opprettMutation = trpc.dokumentflyt.opprett.useMutation({
    onSuccess: () => {
      utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId });
      setVisInput(false);
      setNavn("");
    },
  });

  if (!visInput) {
    return (
      <button
        onClick={() => setVisInput(true)}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("kontakter.nyDokumentflyt")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={navn}
        onChange={(e) => setNavn(e.target.value)}
        placeholder={t("kontakter.dokumentflytNavn")}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && navn.trim()) {
            opprettMutation.mutate({ projectId: prosjektId, enterpriseId, name: navn.trim() });
          }
          if (e.key === "Escape") { setVisInput(false); setNavn(""); }
        }}
      />
      <Button
        size="sm"
        onClick={() => {
          if (navn.trim()) opprettMutation.mutate({ projectId: prosjektId, enterpriseId, name: navn.trim() });
        }}
        disabled={!navn.trim() || opprettMutation.isPending}
        loading={opprettMutation.isPending}
      >
        {t("handling.opprett")}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => { setVisInput(false); setNavn(""); }}>
        {t("handling.avbryt")}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DokumentflytKort — tittel med redigering/sletting + flytbokser     */
/* ------------------------------------------------------------------ */

function DokumentflytKort({
  df, opprettere, svarere, prosjektId,
  alleEntrepriser, alleMedlemmer, alleGrupper, gruppeOppslag, gruppeMedlemNavn,
}: {
  df: Dokumentflyt;
  opprettere: DokumentflytMedlem[];
  svarere: DokumentflytMedlem[];
  prosjektId: string;
  alleEntrepriser: Entreprise[];
  alleMedlemmer: ProsjektMedlem[];
  alleGrupper: Array<{ id: string; name: string }>;
  gruppeOppslag: Map<string, Set<string>>;
  gruppeMedlemNavn: Map<string, Array<{ navn: string; projectMemberId: string; gruppeMedlemId: string; erAdmin: boolean }>>;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [erRedigering, setErRedigering] = useState(false);
  const [navn, setNavn] = useState(df.name);

  const oppdaterMutation = trpc.dokumentflyt.oppdater.useMutation({
    onSuccess: () => {
      utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId });
      setErRedigering(false);
    },
  });

  const slettMutation = trpc.dokumentflyt.slett.useMutation({
    onSuccess: () => {
      utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      {/* Tittel med redigering */}
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
        {erRedigering ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-700 focus:border-blue-400 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && navn.trim()) {
                  oppdaterMutation.mutate({ id: df.id, projectId: prosjektId, name: navn.trim() });
                }
                if (e.key === "Escape") { setErRedigering(false); setNavn(df.name); }
              }}
            />
            <button
              onClick={() => slettMutation.mutate({ id: df.id, projectId: prosjektId })}
              className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
              title={t("handling.slett")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setErRedigering(false); setNavn(df.name); }}
              className="rounded p-1 text-gray-400 hover:bg-gray-100"
              title={t("handling.avbryt")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setErRedigering(true)}
            className="flex-1 text-left text-sm font-semibold text-gray-700 hover:text-blue-600"
            title={t("handling.rediger")}
          >
            {df.name}
          </button>
        )}
      </div>

      {/* Visuell flyt: Bestiller → Utfører → Godkjenner */}
      <div className="flex items-stretch gap-0">
        <FlytBoks
          tittel={t("kontakter.bestiller")}
          ikon={<Send className="h-3 w-3" />}
          farge="blue"
          avrunding="rounded-l-lg"
          dokumentflytId={df.id}
          rolle="bestiller"
          medlemmer={opprettere}
          prosjektId={prosjektId}
          entrepriser={alleEntrepriser}
          alleMedlemmer={alleMedlemmer}
          alleGrupper={alleGrupper}
          gruppeOppslag={gruppeOppslag}
          gruppeMedlemNavn={gruppeMedlemNavn}
        />
        <div className="flex items-center px-2">
          <ArrowRight className="h-5 w-5 text-gray-300" />
        </div>
        <FlytBoks
          tittel={t("kontakter.utforerLabel")}
          ikon={<ClipboardCheck className="h-3 w-3" />}
          farge="purple"
          avrunding=""
          dokumentflytId={df.id}
          rolle="utforer"
          medlemmer={svarere}
          prosjektId={prosjektId}
          entrepriser={alleEntrepriser}
          alleMedlemmer={alleMedlemmer}
          alleGrupper={alleGrupper}
          gruppeOppslag={gruppeOppslag}
          gruppeMedlemNavn={gruppeMedlemNavn}
        />
        <div className="flex items-center px-2">
          <ArrowRight className="h-5 w-5 text-gray-300" />
        </div>
        <FlytBoks
          tittel={t("kontakter.godkjenner")}
          ikon={<CheckCircle2 className="h-3 w-3" />}
          farge="green"
          avrunding="rounded-r-lg"
          dokumentflytId={df.id}
          rolle="bestiller"
          medlemmer={opprettere}
          prosjektId={prosjektId}
          entrepriser={alleEntrepriser}
          alleMedlemmer={alleMedlemmer}
          alleGrupper={alleGrupper}
          gruppeOppslag={gruppeOppslag}
          gruppeMedlemNavn={gruppeMedlemNavn}
        />
      </div>

      {/* Maler */}
      {df.maler.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {df.maler.map((m) => (
            <span key={m.template.id} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {m.template.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FlytBoks — viser rolle med grupper og enkeltpersoner               */
/* ------------------------------------------------------------------ */

const FLYT_FARGER: Record<string, { border: string; bg: string; tittel: string; tekst: string; ikon: string; prikkBg: string; prikkRing: string }> = {
  blue: { border: "border-blue-200", bg: "bg-blue-50/50", tittel: "text-blue-600", tekst: "text-blue-500", ikon: "text-blue-400", prikkBg: "bg-blue-500", prikkRing: "ring-blue-200" },
  purple: { border: "border-purple-200", bg: "bg-purple-50/50", tittel: "text-purple-600", tekst: "text-purple-500", ikon: "text-purple-400", prikkBg: "bg-purple-500", prikkRing: "ring-purple-200" },
  green: { border: "border-green-200", bg: "bg-green-50/50", tittel: "text-green-600", tekst: "text-green-500", ikon: "text-green-400", prikkBg: "bg-green-500", prikkRing: "ring-green-200" },
};

function FlytBoks({
  tittel,
  ikon,
  farge,
  avrunding,
  dokumentflytId,
  rolle,
  medlemmer,
  prosjektId,
  entrepriser,
  alleMedlemmer,
  alleGrupper,
  gruppeOppslag,
  gruppeMedlemNavn,
}: {
  tittel: string;
  ikon: React.ReactNode;
  farge: "blue" | "purple" | "green";
  avrunding: string;
  dokumentflytId: string;
  rolle: "bestiller" | "utforer";
  medlemmer: DokumentflytMedlem[];
  prosjektId: string;
  entrepriser: Entreprise[];
  alleMedlemmer: ProsjektMedlem[];
  alleGrupper: Array<{ id: string; name: string }>;
  gruppeOppslag: Map<string, Set<string>>; // gruppeId → Set<projectMemberId>
  gruppeMedlemNavn: Map<string, Array<{ navn: string; projectMemberId: string; gruppeMedlemId: string; erAdmin: boolean }>>; // gruppeId → info[]
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [visInviterNy, setVisInviterNy] = useState(false);
  const [utvidetGruppe, setUtvidetGruppe] = useState<Set<string>>(new Set());
  const f = FLYT_FARGER[farge] ?? FLYT_FARGER.blue!;

  const settHovedansvarligMutation = trpc.dokumentflyt.settHovedansvarlig.useMutation({
    onSuccess: () => {
      utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const fjernMedlemMutation = trpc.dokumentflyt.fjernMedlem.useMutation({
    onSuccess: () => {
      utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const fjernGruppeMedlemMutation = trpc.gruppe.fjernMedlem.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const settGruppeAdminMutation = trpc.gruppe.settGruppeAdmin.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  // Del medlemmer i grupper og enkeltpersoner
  const gruppeMedlemmer = medlemmer.filter((m) => !!m.group);
  const enkeltpersoner = medlemmer.filter((m) => !m.group && !!m.projectMember);
  const harBegge = gruppeMedlemmer.length > 0 && enkeltpersoner.length > 0;

  // Finn gruppetilhørighet for en enkeltperson
  function finnGrupper(projectMemberId: string): string[] {
    const gruppeNavn: string[] = [];
    for (const [gruppeId, medlemIder] of gruppeOppslag.entries()) {
      if (medlemIder.has(projectMemberId)) {
        const gruppe = alleGrupper.find((g) => g.id === gruppeId);
        if (gruppe) gruppeNavn.push(gruppe.name);
      }
    }
    return gruppeNavn;
  }

  function renderHovedansvarligPrikk(m: DokumentflytMedlem) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          settHovedansvarligMutation.mutate({
            id: m.id,
            projectId: prosjektId,
            erHovedansvarlig: !m.erHovedansvarlig,
          });
        }}
        className={`shrink-0 rounded-full transition-all ${
          m.erHovedansvarlig
            ? `h-2.5 w-2.5 ${f.prikkBg} ring-2 ${f.prikkRing}`
            : "h-2.5 w-2.5 bg-gray-300 opacity-0 group-hover/medlem:opacity-100 hover:bg-gray-400"
        }`}
        title={m.erHovedansvarlig ? t("kontakter.fjernHovedansvarlig") : t("kontakter.settHovedansvarlig")}
      />
    );
  }

  // Eksisterende medlemmer som DokumentflytMedlemData for dropdown-filtrering
  const eksisterende = medlemmer as unknown as DokumentflytMedlemData[];

  const handleLagtTil = () => {
    utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId });
  };

  return (
    <div className={`flex-1 ${avrunding} border ${f.border} ${f.bg} px-3 py-2`}>
      <div className={`mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${f.tittel}`}>
        {ikon}
        {tittel}
      </div>

      {/* Grupper — klikkbar for å se medlemmer */}
      {gruppeMedlemmer.map((m) => {
        const gruppeId = m.group?.id;
        const erUtvidet = gruppeId ? utvidetGruppe.has(gruppeId) : false;
        const medlemNavn = gruppeId ? gruppeMedlemNavn.get(gruppeId) ?? [] : [];

        return (
          <div key={m.id} className="mb-0.5">
            <div className="group/medlem flex items-center gap-1.5 text-sm text-gray-700">
              {renderHovedansvarligPrikk(m)}
              <button
                onClick={() => {
                  if (!gruppeId) return;
                  setUtvidetGruppe((prev) => {
                    const ny = new Set(prev);
                    ny.has(gruppeId) ? ny.delete(gruppeId) : ny.add(gruppeId);
                    return ny;
                  });
                }}
                className="flex flex-1 items-center gap-1.5 hover:underline"
              >
                <Users className={`h-3.5 w-3.5 ${f.ikon} shrink-0`} />
                <span className="font-medium">{m.group?.name}</span>
                {medlemNavn.length > 0 && (
                  <span className="text-xs text-gray-400">({medlemNavn.length})</span>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fjernMedlemMutation.mutate({ id: m.id, projectId: prosjektId });
                }}
                className="rounded p-0.5 opacity-0 transition-opacity group-hover/medlem:opacity-100 hover:bg-red-100 hover:text-red-600"
                title={t("handling.fjern")}
              >
                <X className="h-3 w-3 text-gray-400" />
              </button>
            </div>
            {erUtvidet && medlemNavn.length > 0 && (
              <div className="ml-5 mt-0.5 mb-1 space-y-0.5">
                {medlemNavn.map((gm) => (
                  <div key={gm.gruppeMedlemId} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        settGruppeAdminMutation.mutate({ groupId: gruppeId!, projectMemberId: gm.projectMemberId, projectId: prosjektId, isAdmin: !gm.erAdmin });
                      }}
                      className={`shrink-0 rounded-full transition-all ${
                        gm.erAdmin
                          ? "h-2 w-2 bg-blue-500 ring-2 ring-blue-200"
                          : "h-2 w-2 bg-gray-300 hover:bg-blue-400"
                      }`}
                      title={gm.erAdmin ? t("brukere.fjernGruppeadmin") : t("brukere.settGruppeadmin")}
                    />
                    <User className="h-3 w-3 text-gray-300 shrink-0" />
                    {gm.navn}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fjernGruppeMedlemMutation.mutate({ id: gm.gruppeMedlemId, projectId: prosjektId });
                      }}
                      className="ml-0.5 rounded p-0.5 text-gray-300 hover:bg-red-100 hover:text-red-600"
                      title={t("handling.fjern")}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Skillelinje */}
      {harBegge && <div className="border-t border-dashed border-gray-200 my-1.5" />}

      {/* Enkeltpersoner med gruppetag */}
      {enkeltpersoner.map((m) => {
        const personNavn = m.projectMember?.user?.name;
        const grupperNavn = m.projectMember ? finnGrupper(m.projectMember.id) : [];

        return (
          <div key={m.id} className="group/medlem mb-0.5 flex items-center gap-1.5 text-sm">
            {renderHovedansvarligPrikk(m)}
            <User className={`h-3 w-3 ${f.ikon} shrink-0`} />
            <span className="flex-1 text-gray-700">{personNavn ?? "—"}</span>
            {grupperNavn.length > 0 && (
              <span className="text-[11px] text-gray-400">
                · {grupperNavn.join(", ")}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                fjernMedlemMutation.mutate({ id: m.id, projectId: prosjektId });
              }}
              className="rounded p-0.5 opacity-0 transition-opacity group-hover/medlem:opacity-100 hover:bg-red-100 hover:text-red-600"
              title={t("handling.fjern")}
            >
              <X className="h-3 w-3 text-gray-400" />
            </button>
          </div>
        );
      })}

      {/* Legg til — grupper eller personer via dropdown */}
      <div className="mt-1">
        <LeggTilMedlemDropdown
          dokumentflytId={dokumentflytId}
          prosjektId={prosjektId}
          rolle={rolle}
          steg={1}
          entrepriser={[]}
          medlemmer={alleMedlemmer.map((m) => ({ id: m.id, user: { name: m.user.name, email: m.user.email } }))}
          grupper={alleGrupper}
          eksisterende={eksisterende}
          onLagtTil={handleLagtTil}
          onInviterNy={() => setVisInviterNy(true)}
        />
      </div>

      {/* Inviter ny person modal */}
      <InviterNyMedlemModal
        open={visInviterNy}
        onClose={() => setVisInviterNy(false)}
        prosjektId={prosjektId}
        dokumentflytId={dokumentflytId}
        rolle={rolle}
        steg={1}
        onFerdig={handleLagtTil}
      />
    </div>
  );
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
  const { data: grupper, isLoading: e4 } = trpc.gruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const erLaster = e1 || e2 || e3 || e4;

  // Bygg oppslag: entrepriseId → kontakter
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

  // Bygg oppslag: gruppeId → Set<projectMemberId>
  const gruppeOppslag = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!grupper) return map;
    const alle = grupper as Array<{
      id: string;
      name: string;
      members: Array<{
        projectMember: { id: string; user: { name: string | null } } | null;
      }>;
    }>;
    for (const g of alle) {
      const ider = new Set<string>();
      for (const m of g.members) {
        if (m.projectMember) ider.add(m.projectMember.id);
      }
      map.set(g.id, ider);
    }
    return map;
  }, [grupper]);

  // Bygg oppslag: gruppeId → {navn, projectMemberId, gruppeMedlemId, erAdmin}[]
  const gruppeMedlemNavn = useMemo(() => {
    const map = new Map<string, Array<{ navn: string; projectMemberId: string; gruppeMedlemId: string; erAdmin: boolean }>>();
    if (!grupper) return map;
    const alle = grupper as Array<{
      id: string;
      members: Array<{
        id: string;
        isAdmin: boolean;
        projectMember: { id: string; user: { name: string | null } } | null;
      }>;
    }>;
    for (const g of alle) {
      const info: Array<{ navn: string; projectMemberId: string; gruppeMedlemId: string; erAdmin: boolean }> = [];
      for (const m of g.members) {
        if (m.projectMember?.user?.name) {
          info.push({ navn: m.projectMember.user.name, projectMemberId: m.projectMember.id, gruppeMedlemId: m.id, erAdmin: m.isAdmin });
        }
      }
      map.set(g.id, info);
    }
    return map;
  }, [grupper]);

  // Alle grupper som enkel liste
  const alleGrupper = useMemo(() => {
    if (!grupper) return [];
    return (grupper as Array<{ id: string; name: string; category: string }>)
      .filter((g) => g.category === "brukergrupper")
      .map((g) => ({ id: g.id, name: g.name }));
  }, [grupper]);

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
  const alleMedlemmer = (medlemmer ?? []) as ProsjektMedlem[];

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
                    <span className="font-medium text-blue-700">{ent.name}</span>
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
                    const opprettere = df.medlemmer.filter((m) => m.rolle === "bestiller");
                    const svarere = df.medlemmer.filter((m) => m.rolle === "utforer");

                    return (
                      <DokumentflytKort
                        key={df.id}
                        df={df}
                        opprettere={opprettere}
                        svarere={svarere}
                        prosjektId={prosjektId!}
                        alleEntrepriser={alleEntrepriser}
                        alleMedlemmer={alleMedlemmer}
                        alleGrupper={alleGrupper}
                        gruppeOppslag={gruppeOppslag}
                        gruppeMedlemNavn={gruppeMedlemNavn}
                      />
                    );
                  })}

                  {dflyter.length === 0 && (
                    <p className="text-xs text-gray-400 italic">{t("kontakter.ingenFlyter")}</p>
                  )}

                  {/* Ny dokumentflyt */}
                  <NyDokumentflytKnapp entrepriseId={ent.id} prosjektId={prosjektId!} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
