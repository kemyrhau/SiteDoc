"use client";

import { useState, useMemo } from "react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Spinner, Modal, Input, Button } from "@sitedoc/ui";
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
  Plus,
  UserPlus,
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
/*  GruppeMedlemInfo                                                    */
/* ------------------------------------------------------------------ */

interface GruppeMedlemInfo {
  navn: string;
  projectMemberId: string;
}

/* ------------------------------------------------------------------ */
/*  LeggTilGruppeMedlemModal                                            */
/* ------------------------------------------------------------------ */

function LeggTilGruppeMedlemModal({
  open,
  onClose,
  gruppeId,
  prosjektId,
  eksisterendeMedlemIder,
}: {
  open: boolean;
  onClose: () => void;
  gruppeId: string;
  prosjektId: string;
  eksisterendeMedlemIder: Set<string>;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // Skjema-state for ny person
  const [epost, setEpost] = useState("");
  const [fornavn, setFornavn] = useState("");
  const [etternavn, setEtternavn] = useState("");
  const [telefon, setTelefon] = useState("");
  const [valgtMedlemId, setValgtMedlemId] = useState("");

  // Hent eksisterende prosjektmedlemmer for dropdown
  const { data: alleMedlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );

  const leggTilMutation = trpc.gruppe.leggTilMedlem.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
      onClose();
    },
  });

  // Reset skjema ved åpning
  const [forrigeOpen, setForrigeOpen] = useState(false);
  if (open && !forrigeOpen) {
    setEpost("");
    setFornavn("");
    setEtternavn("");
    setTelefon("");
    setValgtMedlemId("");
  }
  if (open !== forrigeOpen) setForrigeOpen(open);

  // Filtrer bort de som allerede er i gruppen
  const tilgjengeligeMedlemmer = useMemo(() => {
    if (!alleMedlemmer) return [];
    return (alleMedlemmer as ProsjektMedlem[]).filter(
      (m) => !eksisterendeMedlemIder.has(m.id) && m.user.name,
    );
  }, [alleMedlemmer, eksisterendeMedlemIder]);

  async function handleLeggTilEksisterende() {
    if (!valgtMedlemId) return;
    const medlem = tilgjengeligeMedlemmer.find((m) => m.id === valgtMedlemId);
    if (!medlem) return;

    const [fornavn_, ...resten] = (medlem.user.name ?? "").split(" ");
    await leggTilMutation.mutateAsync({
      groupId: gruppeId,
      projectId: prosjektId,
      email: medlem.user.email,
      firstName: fornavn_ ?? "",
      lastName: resten.join(" ") || (fornavn_ ?? ""),
    });
  }

  async function handleOpprettNy(e: React.FormEvent) {
    e.preventDefault();
    if (!epost.trim() || !fornavn.trim() || !etternavn.trim()) return;

    await leggTilMutation.mutateAsync({
      groupId: gruppeId,
      projectId: prosjektId,
      email: epost.trim(),
      firstName: fornavn.trim(),
      lastName: etternavn.trim(),
      phone: telefon.trim() || undefined,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={t("kontakter.leggTilMedlem")} className="z-[60]">
      <div className="flex flex-col gap-5">
        {/* Velg eksisterende */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {t("kontakter.velgEksisterende")}
          </label>
          <div className="flex gap-2">
            <select
              value={valgtMedlemId}
              onChange={(e) => setValgtMedlemId(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{t("kontakter.velgPerson")}</option>
              {tilgjengeligeMedlemmer.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.user.name} ({m.user.email})
                </option>
              ))}
            </select>
            <Button
              onClick={handleLeggTilEksisterende}
              disabled={!valgtMedlemId || leggTilMutation.isPending}
              loading={leggTilMutation.isPending && !!valgtMedlemId}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("handling.leggTil")}
            </Button>
          </div>
        </div>

        {/* Skillelinje */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400">{t("kontakter.opprettNy")}</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        {/* Opprett ny person */}
        <form onSubmit={handleOpprettNy} className="flex flex-col gap-3">
          <Input
            label={t("dokumentflyt.epostadresse")}
            type="email"
            placeholder="navn@firma.no"
            value={epost}
            onChange={(e) => setEpost(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("dokumentflyt.fornavn")}
              value={fornavn}
              onChange={(e) => setFornavn(e.target.value)}
              required
            />
            <Input
              label={t("dokumentflyt.etternavn")}
              value={etternavn}
              onChange={(e) => setEtternavn(e.target.value)}
              required
            />
          </div>
          <Input
            label={t("dokumentflyt.telefonValgfritt")}
            type="tel"
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
          />

          {leggTilMutation.error && (
            <p className="text-sm text-red-600">{leggTilMutation.error.message}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              {t("handling.avbryt")}
            </Button>
            <Button
              type="submit"
              loading={leggTilMutation.isPending && !valgtMedlemId}
              disabled={!epost.trim() || !fornavn.trim() || !etternavn.trim()}
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              {t("kontakter.opprettOgLeggTil")}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  FlytBoks — viser rolle med gruppemedlemmer                         */
/* ------------------------------------------------------------------ */

const FLYT_FARGER: Record<string, { border: string; bg: string; tittel: string; tekst: string; ikon: string; prikk: string; prikkBg: string; prikkRing: string }> = {
  blue: { border: "border-blue-200", bg: "bg-blue-50/50", tittel: "text-blue-600", tekst: "text-blue-500", ikon: "text-blue-400", prikk: "text-blue-500", prikkBg: "bg-blue-500", prikkRing: "ring-blue-200" },
  purple: { border: "border-purple-200", bg: "bg-purple-50/50", tittel: "text-purple-600", tekst: "text-purple-500", ikon: "text-purple-400", prikk: "text-purple-500", prikkBg: "bg-purple-500", prikkRing: "ring-purple-200" },
  green: { border: "border-green-200", bg: "bg-green-50/50", tittel: "text-green-600", tekst: "text-green-500", ikon: "text-green-400", prikk: "text-green-500", prikkBg: "bg-green-500", prikkRing: "ring-green-200" },
};

function FlytBoks({
  tittel,
  ikon,
  farge,
  avrunding,
  medlemmer,
  gruppemedlemmer,
  prosjektId,
}: {
  tittel: string;
  ikon: React.ReactNode;
  farge: "blue" | "purple" | "green";
  avrunding: string;
  medlemmer: DokumentflytMedlem[];
  gruppemedlemmer: Map<string, GruppeMedlemInfo[]>;
  prosjektId: string;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [utvidetGruppe, setUtvidetGruppe] = useState<Set<string>>(new Set());
  const [leggTilGruppeId, setLeggTilGruppeId] = useState<string | null>(null);
  const f = FLYT_FARGER[farge] ?? FLYT_FARGER.blue!;

  const settHovedansvarligMutation = trpc.dokumentflyt.settHovedansvarlig.useMutation({
    onSuccess: () => {
      utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const toggleGruppe = (id: string) => {
    setUtvidetGruppe((prev) => {
      const ny = new Set(prev);
      ny.has(id) ? ny.delete(id) : ny.add(id);
      return ny;
    });
  };

  // Del medlemmer i grupper og enkeltpersoner
  const gruppeMedlemmer = medlemmer.filter((m) => !!m.group);
  const enkeltpersoner = medlemmer.filter((m) => !m.group && !!m.projectMember);
  const harBegge = gruppeMedlemmer.length > 0 && enkeltpersoner.length > 0;

  // Eksisterende medlemmer i valgt gruppe (for modal-filtrering)
  const eksisterendeMedlemIder = useMemo(() => {
    if (!leggTilGruppeId) return new Set<string>();
    const personer = gruppemedlemmer.get(leggTilGruppeId) ?? [];
    return new Set(personer.map((p) => p.projectMemberId));
  }, [leggTilGruppeId, gruppemedlemmer]);

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

  function renderGruppeMedlem(m: DokumentflytMedlem) {
    const gruppeNavn = m.group?.name;
    const gruppePersoner = m.group ? gruppemedlemmer.get(m.group.id) ?? [] : [];
    const erUtvidet = m.group ? utvidetGruppe.has(m.group.id) : false;

    return (
      <div key={m.id} className="mb-0.5">
        <div className="group/medlem flex items-center gap-1.5 text-sm text-gray-700">
          {renderHovedansvarligPrikk(m)}
          <button
            onClick={() => m.group && toggleGruppe(m.group.id)}
            className="flex items-center gap-1.5 hover:underline"
          >
            <Users className={`h-3.5 w-3.5 ${f.ikon} shrink-0`} />
            <span className="font-medium">{gruppeNavn}</span>
            {gruppePersoner.length > 0 && (
              <span className="text-xs text-gray-400">({gruppePersoner.length})</span>
            )}
          </button>
          {m.erHovedansvarlig && gruppePersoner.length > 0 && (
            <span className="text-xs text-gray-400">
              {gruppePersoner[0]?.navn}
            </span>
          )}
        </div>
        {/* Utvidet gruppemedlemmer */}
        {erUtvidet && gruppePersoner.length > 0 && (
          <div className="ml-5 mt-0.5 mb-1 space-y-0.5">
            {gruppePersoner.map((gm, gIdx) => (
              <div key={gIdx} className="flex items-center gap-1.5 text-xs text-gray-500">
                <User className="h-3 w-3 text-gray-300 shrink-0" />
                {gm.navn}
              </div>
            ))}
            <button
              onClick={() => m.group && setLeggTilGruppeId(m.group.id)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-0.5"
            >
              <Plus className="h-3 w-3" />
              {t("kontakter.leggTilMedlem")}
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderEnkeltperson(m: DokumentflytMedlem) {
    const personNavn = m.projectMember?.user?.name;

    return (
      <div key={m.id} className="group/medlem mb-0.5 flex items-center gap-1.5 text-xs text-gray-500 italic">
        {renderHovedansvarligPrikk(m)}
        <User className={`h-3 w-3 ${f.ikon} shrink-0 opacity-60`} />
        <span>{personNavn ?? "—"}</span>
      </div>
    );
  }

  return (
    <div className={`flex-1 ${avrunding} border ${f.border} ${f.bg} px-3 py-2`}>
      <div className={`mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${f.tittel}`}>
        {ikon}
        {tittel}
      </div>
      {medlemmer.length === 0
        ? <span className="text-xs text-gray-400">—</span>
        : (
          <>
            {gruppeMedlemmer.map(renderGruppeMedlem)}
            {harBegge && <div className="border-t border-dashed border-gray-200 my-1.5" />}
            {enkeltpersoner.map(renderEnkeltperson)}
          </>
        )
      }

      {/* Modal for å legge til gruppemedlem */}
      {leggTilGruppeId && (
        <LeggTilGruppeMedlemModal
          open={!!leggTilGruppeId}
          onClose={() => setLeggTilGruppeId(null)}
          gruppeId={leggTilGruppeId}
          prosjektId={prosjektId}
          eksisterendeMedlemIder={eksisterendeMedlemIder}
        />
      )}
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

  // Bygg oppslag: gruppeId → liste med medlemsnavn og projectMemberId
  const gruppemedlemmer = useMemo(() => {
    const map = new Map<string, GruppeMedlemInfo[]>();
    if (!grupper) return map;
    const alle = grupper as Array<{
      id: string;
      members: Array<{
        isAdmin: boolean;
        projectMember: { id: string; user: { name: string | null } } | null;
      }>;
    }>;
    for (const g of alle) {
      const medlemsListe: GruppeMedlemInfo[] = [];
      for (const m of g.members) {
        if (m.projectMember?.user?.name) {
          medlemsListe.push({
            navn: m.projectMember.user.name,
            projectMemberId: m.projectMember.id,
          });
        }
      }
      map.set(g.id, medlemsListe);
    }
    return map;
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
                          <FlytBoks
                            tittel={t("kontakter.oppretter")}
                            ikon={<Send className="h-3 w-3" />}
                            farge="blue"
                            avrunding="rounded-l-lg"
                            medlemmer={opprettere}
                            gruppemedlemmer={gruppemedlemmer}
                            prosjektId={prosjektId!}
                          />
                          <div className="flex items-center px-2">
                            <ArrowRight className="h-5 w-5 text-gray-300" />
                          </div>
                          {/* Svarer-boks */}
                          <FlytBoks
                            tittel={t("kontakter.svarerLabel")}
                            ikon={<ClipboardCheck className="h-3 w-3" />}
                            farge="purple"
                            avrunding=""
                            medlemmer={svarere}
                            gruppemedlemmer={gruppemedlemmer}
                            prosjektId={prosjektId!}
                          />
                          <div className="flex items-center px-2">
                            <ArrowRight className="h-5 w-5 text-gray-300" />
                          </div>
                          {/* Godkjenner-boks */}
                          <FlytBoks
                            tittel={t("kontakter.godkjenner")}
                            ikon={<CheckCircle2 className="h-3 w-3" />}
                            farge="green"
                            avrunding="rounded-r-lg"
                            medlemmer={opprettere}
                            gruppemedlemmer={gruppemedlemmer}
                            prosjektId={prosjektId!}
                          />
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
