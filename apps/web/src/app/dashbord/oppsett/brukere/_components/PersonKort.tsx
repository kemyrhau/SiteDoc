"use client";

/**
 * PersonKort — slide-over på Kontakter-flaten (nivå 3 av tre-nivå-designet).
 *
 * Seksjonsrekkefølge er LÅST (ordre DESIGNLÅS § 7):
 *   1. Kontaktinfo (e-post/telefon/firma/faggruppe — redigeres HER)
 *   2. Kapabiliteter i prosjektet (datadrevet radliste: rolle + attestering i dag,
 *      vokser via kapabilitetsfelter på ProjectMember, aldri via nye roller)
 *   3. Brukergrupper (chips)
 *   4. Deltar i dokumentflyter (VISNING m/provenans — aldri redigerbar herfra)
 *   + lenke «Administrer deltakelse i Dokumentflyt-oppsettet →»
 *
 * Provenans (§ 8) avledes klientside fra de tre kildene (direkte/gruppe/faggruppe);
 * samme flyt med to koblinger vises som to rader. Ingen ny tilgangsberegning.
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Modal } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { X, Pencil, Check, Shield, Plus, CreditCard } from "lucide-react";

const FARGE_DOT: Record<string, string> = {
  red: "bg-red-500", orange: "bg-orange-500", amber: "bg-amber-500",
  yellow: "bg-yellow-500", lime: "bg-lime-500", green: "bg-green-500",
  emerald: "bg-emerald-500", teal: "bg-teal-500", cyan: "bg-cyan-500",
  sky: "bg-sky-500", blue: "bg-blue-500", indigo: "bg-indigo-500",
  violet: "bg-violet-500", purple: "bg-purple-500", fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500", rose: "bg-rose-500", slate: "bg-slate-500",
};

export interface KontaktMedlem {
  id: string;
  role: string;
  erFirmaansvarlig: boolean;
  kanAttestere: boolean;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    canLogin?: boolean;
    hmsKortNr?: string | null;
    hmsKortUtloper?: string | Date | null;
    organization?: { id: string; name: string } | null;
  } | null;
  faggruppeKoblinger: Array<{
    faggruppe: { id: string; name: string; color: string | null };
  }>;
}

export interface DbGruppe {
  id: string;
  name: string;
  category: string;
  members: Array<{ projectMember: { user: { id: string } } | null }>;
}

export interface Dokumentflyt {
  id: string;
  name: string;
  roller?: Array<{ rolle: string; label?: string | null }> | null;
  medlemmer: Array<{
    rolle: string;
    projectMember?: { id: string } | null;
    group?: { id: string; name: string } | null;
    faggruppe?: { id: string; name: string } | null;
  }>;
}

type FlytRad = {
  key: string;
  flytNavn: string;
  rolleLabel: string;
  provenans: string;
};

export function PersonKort({
  medlem,
  prosjektId,
  alleFaggrupper,
  dbGrupper,
  dokumentflyter,
  fokusBrukergruppe = false,
  onClose,
}: {
  medlem: KontaktMedlem;
  prosjektId: string;
  alleFaggrupper: Array<{ id: string; name: string; color: string | null }>;
  dbGrupper: DbGruppe[];
  dokumentflyter: Dokumentflyt[];
  // Åpnet fra forslagsstripens «+ Brukergruppe» → åpne gruppe-nedtrekket direkte.
  fokusBrukergruppe?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();

  const bruker = medlem.user;
  const [redigerKontakt, setRedigerKontakt] = useState(false);
  const [kontaktData, setKontaktData] = useState({
    name: bruker?.name ?? "",
    email: bruker?.email ?? "",
    phone: bruker?.phone ?? "",
  });
  const [leggTilFaggruppeAapen, setLeggTilFaggruppeAapen] = useState(false);
  const [leggTilGruppeAapen, setLeggTilGruppeAapen] = useState(fokusBrukergruppe);
  const [fjernFaggruppeMaal, setFjernFaggruppeMaal] = useState<
    { faggruppeId: string; faggruppeNavn: string } | null
  >(null);

  const invalider = () => {
    utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
  };

  const oppdaterMutation = trpc.medlem.oppdater.useMutation({ onSuccess: () => { invalider(); setRedigerKontakt(false); } });
  const settFirmaansvarligMutation = trpc.medlem.settFirmaansvarlig.useMutation({ onSuccess: invalider });
  const settKanAttestereMutation = trpc.medlem.settKanAttestere.useMutation({ onSuccess: invalider });
  const leggTilFaggruppeMutation = trpc.medlem.leggTilFaggruppe.useMutation({ onSuccess: () => { invalider(); setLeggTilFaggruppeAapen(false); } });
  const fjernFaggruppeMutation = trpc.medlem.fjernFraFaggruppe.useMutation({ onSuccess: () => { invalider(); setFjernFaggruppeMaal(null); } });
  const registrerMutation = trpc.medlem.registrer.useMutation({ onSuccess: () => { invalider(); setLeggTilGruppeAapen(false); } });
  const fjernMedlemMutation = trpc.gruppe.fjernMedlem.useMutation({ onSuccess: invalider });

  // Brukergrupper personen er i (kun kategori "brukergrupper")
  const minesGrupper = useMemo(() => {
    if (!bruker) return [] as Array<{ id: string; name: string; gruppeMedlemId?: string }>;
    return dbGrupper
      .filter((g) => g.category === "brukergrupper")
      .filter((g) => g.members.some((gm) => gm.projectMember?.user?.id === bruker.id))
      .map((g) => ({ id: g.id, name: g.name }));
  }, [dbGrupper, bruker]);

  const gruppeMedlemIdFor = (gruppeId: string): string | undefined => {
    const g = dbGrupper.find((x) => x.id === gruppeId) as
      | { members: Array<{ id?: string; projectMember: { user: { id: string } } | null }> }
      | undefined;
    return g?.members.find((gm) => gm.projectMember?.user?.id === bruker?.id)?.id;
  };

  const ledigeGrupper = dbGrupper
    .filter((g) => g.category === "brukergrupper")
    .filter((g) => !minesGrupper.some((mg) => mg.id === g.id));

  const faggruppeIder = useMemo(
    () => new Set(medlem.faggruppeKoblinger.map((k) => k.faggruppe.id)),
    [medlem.faggruppeKoblinger],
  );
  const ledigeFaggrupper = alleFaggrupper.filter((f) => !faggruppeIder.has(f.id));

  // Provenans-avledning: én rad per (flyt × rolle × kilde). To kilder → to rader.
  const flytRader = useMemo((): FlytRad[] => {
    if (!bruker) return [];
    const rader: FlytRad[] = [];
    for (const df of dokumentflyter) {
      const roller = df.roller ?? [];
      for (const dm of df.medlemmer) {
        const rolleLabel = roller.find((r) => r.rolle === dm.rolle)?.label ?? t(`dokumentflyt.${dm.rolle}`);
        if (dm.projectMember?.id === medlem.id) {
          rader.push({ key: `${df.id}-${dm.rolle}-direkte`, flytNavn: df.name, rolleLabel, provenans: t("kontakter.provenansDirekte") });
        }
        if (dm.group?.id) {
          const g = dbGrupper.find((x) => x.id === dm.group!.id);
          if (g?.members.some((gm) => gm.projectMember?.user?.id === bruker.id)) {
            rader.push({ key: `${df.id}-${dm.rolle}-gruppe-${dm.group.id}`, flytNavn: df.name, rolleLabel, provenans: t("kontakter.provenansGruppe", { navn: dm.group.name }) });
          }
        }
        if (dm.faggruppe?.id && faggruppeIder.has(dm.faggruppe.id)) {
          rader.push({ key: `${df.id}-${dm.rolle}-faggruppe-${dm.faggruppe.id}`, flytNavn: df.name, rolleLabel, provenans: t("kontakter.provenansFaggruppe", { navn: dm.faggruppe.name }) });
        }
      }
    }
    return rader;
  }, [dokumentflyter, dbGrupper, medlem.id, bruker, faggruppeIder, t]);

  if (!bruker) return null;

  const attestererPaa = medlem.role === "admin" || medlem.kanAttestere;

  const hmsUtloperTekst = bruker.hmsKortUtloper
    ? new Date(bruker.hmsKortUtloper).toLocaleDateString("nb-NO")
    : null;

  return (
    <>
      {/* Bakteppe */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Slide-over */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-800">
              {(bruker.name ?? bruker.email).split(/\s+/).map((d) => d[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {medlem.role === "admin" && <span title="Admin"><Shield className="h-4 w-4 text-blue-600" /></span>}
                {medlem.erFirmaansvarlig && medlem.role !== "admin" && (
                  <span title={t("brukere.firmaansvarlig")}><Shield className="h-4 w-4 text-amber-500" /></span>
                )}
                <h3 className="truncate text-lg font-bold text-gray-900">{bruker.name ?? bruker.email}</h3>
              </div>
              {bruker.organization?.name && <span className="text-xs text-gray-500">{bruker.organization.name}</span>}
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title={t("kontakter.lukkKort")}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* 1. Kontaktinfo */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400">{t("kontakter.seksjonKontaktinfo")}</h4>
              {!redigerKontakt && (
                <button
                  onClick={() => { setKontaktData({ name: bruker.name ?? "", email: bruker.email, phone: bruker.phone ?? "" }); setRedigerKontakt(true); }}
                  className="inline-flex items-center gap-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                  title={t("handling.rediger")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {redigerKontakt ? (
              <div className="space-y-2">
                <label className="block">
                  <span className="text-[11px] font-medium text-gray-500">{t("kontaktside.navn")}</span>
                  <input
                    value={kontaktData.name}
                    onChange={(e) => setKontaktData((p) => ({ ...p, name: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-gray-500">{t("brukere.epost")}</span>
                  <input
                    type="email"
                    value={kontaktData.email}
                    onChange={(e) => setKontaktData((p) => ({ ...p, email: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-gray-500">{t("brukere.telefon")}</span>
                  <input
                    value={kontaktData.phone}
                    onChange={(e) => setKontaktData((p) => ({ ...p, phone: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </label>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => oppdaterMutation.mutate({ id: medlem.id, projectId: prosjektId, name: kontaktData.name.trim() || undefined, email: kontaktData.email.trim() || undefined, phone: kontaktData.phone.trim() || undefined })}
                    disabled={oppdaterMutation.isPending}
                    className="rounded bg-sitedoc-primary px-3 py-1 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {t("handling.lagre")}
                  </button>
                  <button onClick={() => setRedigerKontakt(false)} className="rounded px-3 py-1 text-xs text-gray-500 hover:bg-gray-100">
                    {t("handling.avbryt")}
                  </button>
                </div>
              </div>
            ) : (
              <dl className="space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-gray-400">{t("brukere.epost")}</dt>
                  <dd className="text-gray-800">{bruker.email}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-gray-400">{t("brukere.telefon")}</dt>
                  <dd className="text-gray-800">{bruker.phone ?? "—"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-gray-400">{t("brukere.firma")}</dt>
                  <dd className="text-gray-800">
                    {bruker.organization?.name ?? "—"}
                    <span className="mt-0.5 block text-xs text-gray-400">{t("kontakter.firmaEndresAvAdmin")}</span>
                  </dd>
                </div>
                {(bruker.hmsKortNr || hmsUtloperTekst) && (
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-gray-400">{t("kontakter.hmsKort")}</dt>
                    <dd className="inline-flex items-center gap-1 text-gray-800">
                      <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                      {bruker.hmsKortNr ?? "—"}
                      {hmsUtloperTekst && <span className="text-xs text-gray-400">({t("kontakter.hmsKortUtloper", { dato: hmsUtloperTekst })})</span>}
                    </dd>
                  </div>
                )}
                {bruker.canLogin === false && (
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-gray-400">&nbsp;</dt>
                    <dd className="text-xs text-gray-400">{t("kontakter.kanIkkeLogge")}</dd>
                  </div>
                )}
              </dl>
            )}

            {/* Faggruppe — redigeres her */}
            <div className="mt-3">
              <span className="text-[11px] font-medium text-gray-500">{t("kontakter.kolFaggruppe")}</span>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {medlem.faggruppeKoblinger.length === 0 && <span className="text-xs text-gray-400">—</span>}
                {medlem.faggruppeKoblinger.map((k) => (
                  <span key={k.faggruppe.id} className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                    <span className={`h-2 w-2 rounded-full ${FARGE_DOT[k.faggruppe.color ?? ""] ?? "bg-gray-400"}`} />
                    {k.faggruppe.name}
                    <button
                      onClick={() => setFjernFaggruppeMaal({ faggruppeId: k.faggruppe.id, faggruppeNavn: k.faggruppe.name })}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                      title={t("handling.fjern")}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                {ledigeFaggrupper.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setLeggTilFaggruppeAapen((v) => !v)}
                      className="inline-flex items-center rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-blue-600"
                      title={t("brukere.leggTilFaggruppe")}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    {leggTilFaggruppeAapen && (
                      <div className="absolute left-0 top-6 z-10 min-w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        {ledigeFaggrupper.map((f) => (
                          <button
                            key={f.id}
                            disabled={leggTilFaggruppeMutation.isPending}
                            onClick={() => leggTilFaggruppeMutation.mutate({ projectMemberId: medlem.id, faggruppeId: f.id, projectId: prosjektId })}
                            className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 2. Kapabiliteter i prosjektet — datadrevet radliste */}
          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{t("kontakter.seksjonKapabiliteter")}</h4>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {/* Prosjektrolle */}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-gray-700">{t("kontakter.kapProsjektrolle")}</span>
                <select
                  value={medlem.erFirmaansvarlig && medlem.role !== "admin" ? "firmaansvarlig" : medlem.role}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "admin") {
                      oppdaterMutation.mutate({ id: medlem.id, projectId: prosjektId, role: "admin" });
                      if (medlem.erFirmaansvarlig) settFirmaansvarligMutation.mutate({ id: medlem.id, projectId: prosjektId, erFirmaansvarlig: false });
                    } else if (val === "firmaansvarlig") {
                      oppdaterMutation.mutate({ id: medlem.id, projectId: prosjektId, role: "member" });
                      settFirmaansvarligMutation.mutate({ id: medlem.id, projectId: prosjektId, erFirmaansvarlig: true });
                    } else {
                      oppdaterMutation.mutate({ id: medlem.id, projectId: prosjektId, role: "member" });
                      if (medlem.erFirmaansvarlig) settFirmaansvarligMutation.mutate({ id: medlem.id, projectId: prosjektId, erFirmaansvarlig: false });
                    }
                  }}
                  className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="member">{t("brukere.medlem")}</option>
                  <option value="firmaansvarlig">{t("brukere.firmaansvarlig")}</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {/* Attesterer timer */}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-gray-700">{t("kontakter.kapAttesterer")}</span>
                {medlem.role === "admin" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 opacity-60" title={t("oppsett.attesteringImplisittAdmin") ?? ""}>
                    <Check className="h-3 w-3" /> {t("kontakter.kapVerdiPaa")}
                  </span>
                ) : (
                  <button
                    onClick={() => settKanAttestereMutation.mutate({ id: medlem.id, projectId: prosjektId, kanAttestere: !medlem.kanAttestere })}
                    disabled={settKanAttestereMutation.isPending}
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                      attestererPaa ? "bg-green-50 text-green-700 hover:bg-green-100" : "border border-gray-300 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {attestererPaa ? <><Check className="h-3 w-3" /> {t("kontakter.kapVerdiPaa")}</> : t("kontakter.kapVerdiAv")}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 3. Brukergrupper */}
          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{t("kontakter.seksjonBrukergrupper")}</h4>
            <div className="flex flex-wrap items-center gap-1.5">
              {minesGrupper.length === 0 && !leggTilGruppeAapen && (
                <span className="text-sm text-gray-400">{t("kontakter.tomBrukergrupper")}</span>
              )}
              {minesGrupper.map((g) => {
                const gmId = gruppeMedlemIdFor(g.id);
                return (
                  <span key={g.id} className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {g.name}
                    {gmId && (
                      <button onClick={() => fjernMedlemMutation.mutate({ id: gmId, projectId: prosjektId })} className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200" title={t("handling.fjern")}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                );
              })}
              {ledigeGrupper.length > 0 && (
                leggTilGruppeAapen ? (
                  <select
                    autoFocus
                    defaultValue=""
                    onChange={(e) => {
                      const gruppeId = e.target.value;
                      if (!gruppeId) return;
                      const deler = (bruker.name ?? "").split(" ");
                      registrerMutation.mutate({
                        projectId: prosjektId,
                        userId: bruker.id,
                        email: bruker.email,
                        firstName: deler[0] || bruker.email,
                        lastName: deler.slice(1).join(" ") || "-",
                        phone: bruker.phone ?? undefined,
                        gruppeIder: [gruppeId],
                      });
                    }}
                    className="rounded border border-blue-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">{t("kontakter.velgBrukergruppe")}…</option>
                    {ledigeGrupper.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => setLeggTilGruppeAapen(true)}
                    className="inline-flex items-center gap-0.5 rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600"
                  >
                    <Plus className="h-3 w-3" /> {t("kontakter.leggTil")}
                  </button>
                )
              )}
            </div>
          </section>

          {/* 4. Deltar i dokumentflyter — visning m/provenans */}
          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{t("kontakter.seksjonFlyter")}</h4>
            {flytRader.length === 0 ? (
              <p className="text-sm text-gray-400">{t("kontakter.tomFlyter")}</p>
            ) : (
              <ul className="space-y-1.5">
                {flytRader.map((rad) => (
                  <li key={rad.key} className="rounded-lg border border-gray-200 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{rad.flytNavn}</span>
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700">{rad.rolleLabel}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{rad.provenans}</p>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => router.push("/dashbord/oppsett/produksjon/dokumentflyt")}
              className="mt-3 text-xs font-semibold text-sitedoc-primary hover:underline"
            >
              {t("kontakter.administrerFlytLenke")}
            </button>
          </section>
        </div>
      </div>

      {/* Bekreft fjerning fra faggruppe — destruktiv for en tilgangskobling */}
      <Modal open={!!fjernFaggruppeMaal} onClose={() => setFjernFaggruppeMaal(null)} title={t("brukere.fjernFraFaggruppeTittel")} className="max-w-md">
        {fjernFaggruppeMaal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {t("brukere.fjernFraFaggruppeTekst", { navn: bruker.name ?? bruker.email, faggruppe: fjernFaggruppeMaal.faggruppeNavn })}
            </p>
            {fjernFaggruppeMutation.error && <p className="text-sm text-red-600">{fjernFaggruppeMutation.error.message}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setFjernFaggruppeMaal(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                {t("handling.avbryt")}
              </button>
              <button
                disabled={fjernFaggruppeMutation.isPending}
                onClick={() => fjernFaggruppeMutation.mutate({ projectMemberId: medlem.id, faggruppeId: fjernFaggruppeMaal.faggruppeId, projectId: prosjektId })}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t("handling.fjern")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
