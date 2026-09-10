"use client";

/**
 * BrukergruppeFane — nivå 2 av tre-nivå-designet (ordre DESIGNLÅS § 6, mockup-fasit).
 *
 * Kortrutenett: kort per gruppe (navn + merker + les/rediger-ikon + medlemsnavn
 * klikkbare + tilgangs-chips). Klikk → fullt detaljpanel (tilbake-lenke): medlems-
 * liste + «+ Legg til medlem» + Tilganger delt i Domener og Prosjektmoduler.
 * Rename/slett bor i detaljpanelet. `+`-ikonet i gruppeoverskrift finnes ikke lenger.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Modal } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { Eye, Pencil, Trash2, Plus, X, ArrowLeft } from "lucide-react";

interface GruppeMedlem {
  id: string;
  projectMember: {
    id: string;
    user: { id: string; name: string | null; email: string };
  } | null;
}

export interface VisGruppe {
  id: string;
  name: string;
  category: string;
  modules?: string[] | null;
  domains?: string[] | null;
  members: GruppeMedlem[];
}

/** Prosjektadministrator — utledet av ProjectMember.role="admin", ikke en gruppe. */
export interface Prosjektadmin {
  projectMemberId: string;
  navn: string | null;
  epost: string;
}

const DOMENER: Array<{ key: "bygg" | "hms" | "kvalitet"; labelKey: string; aktivBg: string }> = [
  { key: "bygg", labelKey: "brukere.domene.bygg", aktivBg: "bg-sky-100 text-sky-700" },
  { key: "hms", labelKey: "brukere.domene.hms", aktivBg: "bg-red-100 text-red-700" },
  { key: "kvalitet", labelKey: "brukere.domene.kvalitet", aktivBg: "bg-emerald-100 text-emerald-700" },
];

function initialer(navn: string | null, epost: string): string {
  const kilde = navn ?? epost;
  return kilde.split(/\s+/).map((d) => d[0]).slice(0, 2).join("").toUpperCase();
}

export function BrukergruppeFane({
  prosjektId,
  grupper,
  prosjektadmins,
  hmsGruppeId,
  onAapnePerson,
  onLeggTilMedlem,
}: {
  prosjektId: string;
  grupper: VisGruppe[];
  prosjektadmins: Prosjektadmin[];
  hmsGruppeId: string | null;
  onAapnePerson: (projectMemberId: string) => void;
  onLeggTilMedlem: (gruppeId: string) => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [aapenGruppeId, setAapenGruppeId] = useState<string | null>(null);
  const [redigerNavn, setRedigerNavn] = useState(false);
  const [navnVerdi, setNavnVerdi] = useState("");
  const [slettMaal, setSlettMaal] = useState<{ id: string; navn: string } | null>(null);

  const invalider = () => {
    utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
  };

  const oppdaterMutation = trpc.gruppe.oppdater.useMutation({ onSuccess: () => { invalider(); setRedigerNavn(false); } });
  const slettMutation = trpc.gruppe.slett.useMutation({ onSuccess: () => { invalider(); setSlettMaal(null); setAapenGruppeId(null); } });
  const oppdaterDomenerMutation = trpc.gruppe.oppdaterDomener.useMutation({ onSuccess: invalider });
  const oppdaterModulerMutation = trpc.gruppe.oppdaterModuler.useMutation({ onSuccess: invalider });
  const fjernMedlemMutation = trpc.gruppe.fjernMedlem.useMutation({ onSuccess: invalider });

  const aapenGruppe = aapenGruppeId ? grupper.find((g) => g.id === aapenGruppeId) ?? null : null;

  // ── Detaljpanel ──────────────────────────────────────────────────────────
  if (aapenGruppe) {
    const g = aapenGruppe;
    const erHms = g.id === hmsGruppeId;
    const domener = g.domains ?? [];
    const moduler = g.modules ?? [];
    const har3d = moduler.includes("3d");

    return (
      <>
        <div className="max-w-3xl rounded-lg border border-gray-200 bg-white p-6">
          <button onClick={() => { setAapenGruppeId(null); setRedigerNavn(false); }} className="mb-3 inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> {t("kontakter.faneBrukergrupper")}
          </button>

          <div className="mb-5 flex items-center justify-between gap-2">
            {redigerNavn && !erHms ? (
              <input
                value={navnVerdi}
                autoFocus
                onChange={(e) => setNavnVerdi(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && navnVerdi.trim()) oppdaterMutation.mutate({ id: g.id, name: navnVerdi.trim(), projectId: prosjektId });
                  if (e.key === "Escape") setRedigerNavn(false);
                }}
                onBlur={() => setRedigerNavn(false)}
                className="rounded border border-blue-300 px-2 py-1 text-lg font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{g.name}</h2>
                {erHms && (
                  <>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">{t("kontakter.autoMerke")}</span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">{t("kontakter.hmsMerke")}</span>
                  </>
                )}
              </div>
            )}
            {!erHms && (
              <div className="flex shrink-0 items-center gap-0.5">
                <button onClick={() => { setRedigerNavn(true); setNavnVerdi(g.name); }} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title={t("handling.rediger")}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setSlettMaal({ id: g.id, navn: g.name })} className="rounded p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-600" title={t("brukere.slettGruppe")}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Medlemmer */}
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{t("kontakter.medlemmer")}</h4>
          <div className="mb-5 flex flex-col">
            {g.members.length === 0 && <p className="px-2 text-sm text-gray-400">{t("kontakter.ingenMedlemmer")}</p>}
            {g.members.map((m) => m.projectMember && (
              <div key={m.id} className="group/mem flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-gray-50">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-800">
                  {initialer(m.projectMember.user.name, m.projectMember.user.email)}
                </span>
                <button onClick={() => onAapnePerson(m.projectMember!.id)} className="flex-1 text-left text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline">
                  {m.projectMember.user.name ?? m.projectMember.user.email}
                </button>
                <button
                  onClick={() => fjernMedlemMutation.mutate({ id: m.id, projectId: prosjektId })}
                  className="rounded p-0.5 text-gray-300 opacity-0 hover:bg-red-50 hover:text-red-500 group-hover/mem:opacity-100"
                  title={t("brukere.fjernMedlem")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => onLeggTilMedlem(g.id)}
              className="mt-2 inline-flex w-fit items-center gap-1 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600"
            >
              <Plus className="h-3.5 w-3.5" /> {t("brukere.leggTilMedlem")}
            </button>
          </div>

          {/* Tilganger */}
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{t("kontakter.seksjonTilganger")}</h4>
          <div className="grid grid-cols-[110px_1fr] items-start gap-x-4 gap-y-3 text-sm">
            <span className="pt-1 text-gray-500">{t("kontakter.tilgangerDomener")}</span>
            <div className="flex flex-wrap gap-1">
              {DOMENER.map((d) => {
                const aktiv = domener.includes(d.key);
                return (
                  <button
                    key={d.key}
                    disabled={oppdaterDomenerMutation.isPending}
                    onClick={() => {
                      const nye = (aktiv ? domener.filter((x) => x !== d.key) : [...domener, d.key]) as Array<"bygg" | "hms" | "kvalitet">;
                      oppdaterDomenerMutation.mutate({ groupId: g.id, projectId: prosjektId, domains: nye });
                    }}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${aktiv ? d.aktivBg : "bg-gray-100 text-gray-400 line-through"}`}
                  >
                    {t(d.labelKey)}
                  </button>
                );
              })}
            </div>
            <span className="pt-1 text-gray-500">{t("kontakter.tilgangerModuler")}</span>
            <div className="flex flex-wrap gap-1">
              <button
                disabled={oppdaterModulerMutation.isPending}
                onClick={() => {
                  const nye = (har3d ? moduler.filter((m) => m !== "3d") : [...moduler, "3d"]) as Array<"sjekklister" | "oppgaver" | "tegninger" | "3d">;
                  oppdaterModulerMutation.mutate({ groupId: g.id, projectId: prosjektId, modules: nye });
                }}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${har3d ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-400 line-through"}`}
              >
                3D
              </button>
            </div>
          </div>
        </div>

        <SlettModal slettMaal={slettMaal} onClose={() => setSlettMaal(null)} onSlett={() => slettMaal && slettMutation.mutate({ id: slettMaal.id, projectId: prosjektId })} pending={slettMutation.isPending} />
      </>
    );
  }

  // ── Kortrutenett ─────────────────────────────────────────────────────────
  if (grupper.length === 0 && prosjektadmins.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400">{t("kontakter.ingenGrupper")}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
      {/* Prosjektadministrator-kort: LESEKORT, utledet av ProjectMember.role="admin"
          (ikke gruppa prosjekt-admin, som knapt håndheves). ROLLE-merket + ingen
          rediger-affordanser skiller det fra gruppekortene; rollen endres i
          personkortets Prosjektrolle-nedtrekk, som medlemsnavnet lenker til. */}
      {prosjektadmins.length > 0 && (
        <div className="flex flex-col rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-2.5 flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">{t("kontakter.prosjektadminKort")}</h3>
            <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">{t("kontakter.rolleMerke")}</span>
          </div>
          <div className="mb-3 flex flex-col gap-1">
            {prosjektadmins.map((a) => (
              <button
                key={a.projectMemberId}
                onClick={() => onAapnePerson(a.projectMemberId)}
                className="-mx-1 rounded px-1 py-0.5 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600"
              >
                {a.navn ?? a.epost}
              </button>
            ))}
          </div>
          <div className="mt-auto border-t border-slate-200 pt-3">
            <span className="text-xs text-gray-400">{t("kontakter.rolleEndres")}</span>
          </div>
        </div>
      )}

      {grupper.map((g) => {
        const erHms = g.id === hmsGruppeId;
        const domener = g.domains ?? [];
        const har3d = (g.modules ?? []).includes("3d");
        return (
          <div key={g.id} className="flex flex-col rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-gray-900">{g.name}</h3>
                {erHms && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">{t("kontakter.autoMerke")}</span>}
              </div>
              <button onClick={() => setAapenGruppeId(g.id)} className="shrink-0 rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100" title={t("kontakter.aapneGruppe")}>
                <Eye className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 flex flex-col gap-1">
              {g.members.length === 0 && <span className="text-xs text-gray-400">{t("kontakter.ingenMedlemmer")}</span>}
              {g.members.map((m) => m.projectMember && (
                <button
                  key={m.id}
                  onClick={() => onAapnePerson(m.projectMember!.id)}
                  className="-mx-1 rounded px-1 py-0.5 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                >
                  {m.projectMember.user.name ?? m.projectMember.user.email}
                </button>
              ))}
            </div>

            <div className="mt-auto flex flex-wrap gap-1 border-t border-gray-100 pt-3">
              {domener.length === 0 && !har3d && <span className="text-xs text-gray-300">{t("kontakter.ingenTilganger")}</span>}
              {DOMENER.filter((d) => domener.includes(d.key)).map((d) => (
                <span key={d.key} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{t(d.labelKey)}</span>
              ))}
              {har3d && <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">3D</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SlettModal({ slettMaal, onClose, onSlett, pending }: { slettMaal: { id: string; navn: string } | null; onClose: () => void; onSlett: () => void; pending: boolean }) {
  const { t } = useTranslation();
  return (
    <Modal open={!!slettMaal} onClose={onClose} title={t("brukere.slettGruppe")} className="max-w-md">
      {slettMaal && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">{t("brukere.slettGruppeBekreftelse")}</p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">{t("handling.avbryt")}</button>
            <button disabled={pending} onClick={onSlett} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{t("handling.slett")}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
