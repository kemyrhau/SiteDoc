"use client";

/**
 * Kontakter-flaten — tre nivåer (redesign, ordre 2026-09-08).
 *
 * Nivå 1: fane «Kontakter» — flat kontaktliste (navn · e-post · telefon · firma ·
 *          faggruppe m/fargeprikk). Radklikk → personkort.
 * Nivå 2: fane «Brukergrupper» — kort per gruppe (BrukergruppeFane).
 * Nivå 3: personkort (slide-over, PersonKort) — nås fra begge faner.
 *
 * Erstatter den gruppert 9-kolonners lista. Rotårsak løst: raden bar avledet data
 * fra tre hierarkier uten kilde — provenansen bor nå på personkortets flyt-liste.
 * Flyt-deltakelse redigeres ALDRI herfra (Kenneth-vedtak § 4).
 *
 * Server røres ikke: hele registreringen går gjennom `medlem.registrer` (fase 1).
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";
import { Spinner } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Plus, Users, X, Shield } from "lucide-react";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { OpprettKontaktModal, type FlytForModal, type BrukergruppeForModal } from "../produksjon/_components/OpprettKontaktModal";
import { AnsattVelgerModal } from "@/components/AnsattVelgerModal";
import { erHmsGruppe, finnHmsGruppe, type HmsGruppe } from "@/components/hms/hms-utils";
import { PersonKort, type KontaktMedlem, type DbGruppe, type Dokumentflyt } from "./_components/PersonKort";
import { BrukergruppeFane, type VisGruppe } from "./_components/BrukergruppeFane";
import { ForslagsStripe, type Forslag } from "./_components/ForslagsStripe";

const FARGE_DOT: Record<string, string> = {
  red: "bg-red-500", orange: "bg-orange-500", amber: "bg-amber-500",
  yellow: "bg-yellow-500", lime: "bg-lime-500", green: "bg-green-500",
  emerald: "bg-emerald-500", teal: "bg-teal-500", cyan: "bg-cyan-500",
  sky: "bg-sky-500", blue: "bg-blue-500", indigo: "bg-indigo-500",
  violet: "bg-violet-500", purple: "bg-purple-500", fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500", rose: "bg-rose-500", slate: "bg-slate-500",
};

type Fane = "kontakter" | "brukergrupper";

function KontaktAdmin({ prosjektId }: { prosjektId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [fane, setFane] = useState<Fane>("kontakter");
  const [filterNavn, setFilterNavn] = useState("");
  const [filterFaggruppe, setFilterFaggruppe] = useState("");
  const [filterGruppe, setFilterGruppe] = useState("");

  const [valgtMedlemId, setValgtMedlemId] = useState<string | null>(null);
  const [fokusBrukergruppe, setFokusBrukergruppe] = useState(false);

  const [nyKontaktOpen, setNyKontaktOpen] = useState(false);
  const [ansattVelgerOpen, setAnsattVelgerOpen] = useState(false);
  const [leggTilMedlemGruppeId, setLeggTilMedlemGruppeId] = useState<string | null>(null);

  const [nyGruppeInput, setNyGruppeInput] = useState(false);
  const [nyGruppeNavn, setNyGruppeNavn] = useState("");

  const [forslag, setForslag] = useState<Forslag | null>(null);

  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery({ projectId: prosjektId }, { enabled: !!prosjektId });
  const { data: alleFaggrupper } = trpc.faggruppe.hentForProsjekt.useQuery({ projectId: prosjektId }, { enabled: !!prosjektId });
  const { data: dokumentflyter } = trpc.dokumentflyt.hentForProsjekt.useQuery({ projectId: prosjektId }, { enabled: !!prosjektId });
  const { data: dbGrupper } = trpc.gruppe.hentForProsjekt.useQuery({ projectId: prosjektId }, { enabled: !!prosjektId });

  const ledigeFirmaBrukereQuery = trpc.medlem.hentLedigeFirmaBrukere.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId && (nyKontaktOpen || !!leggTilMedlemGruppeId) },
  );
  const ledigeFirmaBrukere = (ledigeFirmaBrukereQuery.data ?? []) as Array<{ id: string; name: string | null; email: string; role: string }>;

  const leggTilMangeMutation = trpc.medlem.leggTilEksisterendeMange.useMutation({
    onSuccess: () => {
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentLedigeFirmaBrukere.invalidate({ projectId: prosjektId });
      utils.medlem.hentAvdelingerForProsjekt.invalidate({ projectId: prosjektId });
      setAnsattVelgerOpen(false);
    },
  });

  const opprettGruppeMutation = trpc.gruppe.opprett.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      setNyGruppeInput(false);
      setNyGruppeNavn("");
    },
  });

  const kontakter = (medlemmer ?? []) as KontaktMedlem[];
  const grupperListe = (dbGrupper ?? []) as unknown as DbGruppe[];
  const faggrupperListe = (alleFaggrupper ?? []) as Array<{ id: string; name: string; color: string | null }>;
  const flyterListe = (dokumentflyter ?? []) as unknown as Dokumentflyt[];

  const hmsGruppe = useMemo(() => finnHmsGruppe(dbGrupper as unknown as HmsGruppe[] | undefined), [dbGrupper]);

  // Brukergrupper til fanen: kategori "brukergrupper" + HMS-gruppa (auto-provisjonert)
  const visGrupper = useMemo((): VisGruppe[] => {
    return ((dbGrupper as unknown as Array<VisGruppe & { category: string; domains?: unknown }>) ?? [])
      .filter((g) => g.category === "brukergrupper" || erHmsGruppe(g));
  }, [dbGrupper]);

  // userId → gruppenavn[] for evt. framtidig bruk; her: gruppe-medlemskap for filter
  const gruppeUserIder = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const g of grupperListe) {
      const s = new Set<string>();
      for (const gm of g.members) if (gm.projectMember?.user?.id) s.add(gm.projectMember.user.id);
      map.set(g.id, s);
    }
    return map;
  }, [grupperListe]);

  const filtrerteKontakter = useMemo(() => {
    let res = kontakter.filter((m) => m.user);
    if (filterNavn) {
      const s = filterNavn.toLowerCase();
      res = res.filter((m) =>
        (m.user!.name ?? "").toLowerCase().includes(s) ||
        m.user!.email.toLowerCase().includes(s) ||
        (m.user!.phone ?? "").includes(s),
      );
    }
    if (filterFaggruppe) res = res.filter((m) => m.faggruppeKoblinger.some((k) => k.faggruppe.id === filterFaggruppe));
    if (filterGruppe) {
      const s = gruppeUserIder.get(filterGruppe) ?? new Set<string>();
      res = res.filter((m) => s.has(m.user!.id));
    }
    return res;
  }, [kontakter, filterNavn, filterFaggruppe, filterGruppe, gruppeUserIder]);

  const valgtMedlem = valgtMedlemId ? kontakter.find((m) => m.id === valgtMedlemId) ?? null : null;

  const aapnePerson = (projectMemberId: string, fokus = false) => {
    setFokusBrukergruppe(fokus);
    setValgtMedlemId(projectMemberId);
  };

  const invaliderAlt = () => {
    utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId });
    utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    utils.medlem.hentLedigeFirmaBrukere.invalidate({ projectId: prosjektId });
  };

  const brukergrupperForModal: BrukergruppeForModal[] = visGrupper
    .filter((g) => g.category === "brukergrupper")
    .map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="-mx-6 -mt-6">
      {/* Sticky header: tittel + faner + handlingsknapper */}
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-gray-50 px-6 pt-6 pb-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{t("brukere.kontakter")}</h2>
          <div className="flex items-center gap-2">
            {fane === "kontakter" ? (
              <>
                <button
                  onClick={() => setAnsattVelgerOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                >
                  <Users className="h-4 w-4" />
                  {t("ansattvelger.leggTilFraFirmaet")}
                </button>
                <button
                  onClick={() => setNyKontaktOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
                >
                  <Plus className="h-4 w-4" />
                  {t("kontaktside.nyKontakt")}
                </button>
              </>
            ) : nyGruppeInput ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={nyGruppeNavn}
                  onChange={(e) => setNyGruppeNavn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nyGruppeNavn.trim()) opprettGruppeMutation.mutate({ projectId: prosjektId, name: nyGruppeNavn.trim(), category: "brukergrupper" });
                    else if (e.key === "Escape") { setNyGruppeInput(false); setNyGruppeNavn(""); }
                  }}
                  autoFocus
                  placeholder={t("brukere.gruppenavn")}
                  className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button onClick={() => { setNyGruppeInput(false); setNyGruppeNavn(""); }} className="rounded p-1 text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setNyGruppeInput(true)}
                className="flex items-center gap-1.5 rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
              >
                <Plus className="h-4 w-4" />
                {t("kontakter.nyBrukergruppe")}
              </button>
            )}
            <HjelpKnapp>
              <HjelpFane tittel={t("hjelp.faneFirma")}>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{t("hjelp.firmaOverskrift")}</h3>
                    <p className="mt-1 text-sm text-gray-600">{t("hjelp.firmaBeskrivelse")}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{t("hjelp.faggruppeOverskrift")}</h3>
                    <p className="mt-1 text-sm text-gray-600">{t("hjelp.faggruppeBeskrivelse")}</p>
                  </div>
                </div>
              </HjelpFane>
            </HjelpKnapp>
          </div>
        </div>

        {/* Faner */}
        <div className="mt-3 flex gap-1">
          {([["kontakter", t("kontakter.faneKontakter")], ["brukergrupper", t("kontakter.faneBrukergrupper")]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFane(key as Fane)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                fane === key ? "border-b-2 border-sitedoc-primary text-sitedoc-primary" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pt-4 pb-6">
        {forslag && (
          <ForslagsStripe
            forslag={forslag}
            onBrukergruppe={() => {
              if (forslag.projectMemberId) aapnePerson(forslag.projectMemberId, true);
              else setFane("brukergrupper");
              setForslag(null);
            }}
            onFlyt={() => { router.push("/dashbord/oppsett/produksjon/dokumentflyt"); setForslag(null); }}
            onLukk={() => setForslag(null)}
          />
        )}

        {fane === "kontakter" ? (
          <div className="rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5">{t("tabell.navn")}</th>
                  <th className="px-4 py-2.5">{t("brukere.epost")}</th>
                  <th className="px-4 py-2.5">{t("brukere.telefon")}</th>
                  <th className="px-4 py-2.5">{t("brukere.firma")}</th>
                  <th className="px-4 py-2.5">{t("kontakter.kolFaggruppe")}</th>
                </tr>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-1.5" colSpan={3}>
                    <input
                      value={filterNavn}
                      onChange={(e) => setFilterNavn(e.target.value)}
                      placeholder={t("handling.sok")}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
                    />
                  </th>
                  <th className="px-4 py-1.5">
                    <select
                      value={filterGruppe}
                      onChange={(e) => setFilterGruppe(e.target.value)}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-700 focus:border-blue-400 focus:outline-none"
                    >
                      <option value="">{t("kontakter.filterAlleBrukergrupper")}</option>
                      {brukergrupperForModal.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </th>
                  <th className="px-4 py-1.5">
                    <select
                      value={filterFaggruppe}
                      onChange={(e) => setFilterFaggruppe(e.target.value)}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-700 focus:border-blue-400 focus:outline-none"
                    >
                      <option value="">{t("kontakter.filterAlleFaggrupper")}</option>
                      {faggrupperListe.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrerteKontakter.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">{kontakter.length === 0 ? t("kontakter.ingenKontakter") : t("kontakter.ingenTreff")}</td></tr>
                ) : filtrerteKontakter.map((m) => (
                  <tr key={m.id} onClick={() => aapnePerson(m.id)} className="cursor-pointer hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">
                      <div className="flex items-center gap-1.5">
                        {m.role === "admin" && <span title="Admin"><Shield className="h-3.5 w-3.5 shrink-0 text-blue-600" /></span>}
                        {m.erFirmaansvarlig && m.role !== "admin" && <span title={t("brukere.firmaansvarlig")}><Shield className="h-3.5 w-3.5 shrink-0 text-amber-500" /></span>}
                        {m.user!.name ?? "—"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{m.user!.email}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{m.user!.phone ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{m.user!.organization?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {m.faggruppeKoblinger.length === 0 && <span className="text-xs text-gray-300">—</span>}
                        {m.faggruppeKoblinger.map((k) => (
                          <span key={k.faggruppe.id} className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                            <span className={`h-2 w-2 rounded-full ${FARGE_DOT[k.faggruppe.color ?? ""] ?? "bg-gray-400"}`} />
                            {k.faggruppe.name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <BrukergruppeFane
            prosjektId={prosjektId}
            grupper={visGrupper}
            hmsGruppeId={hmsGruppe?.id ?? null}
            onAapnePerson={(pmId) => aapnePerson(pmId)}
            onLeggTilMedlem={(gruppeId) => setLeggTilMedlemGruppeId(gruppeId)}
          />
        )}
      </div>

      {/* Personkort (slide-over) */}
      {valgtMedlem && (
        <PersonKort
          medlem={valgtMedlem}
          prosjektId={prosjektId}
          alleFaggrupper={faggrupperListe}
          dbGrupper={grupperListe}
          dokumentflyter={flyterListe}
          fokusBrukergruppe={fokusBrukergruppe}
          onClose={() => { setValgtMedlemId(null); setFokusBrukergruppe(false); }}
        />
      )}

      {/* Batch: legg til firmaets ansatte */}
      <AnsattVelgerModal
        open={ansattVelgerOpen}
        onClose={() => setAnsattVelgerOpen(false)}
        projectId={prosjektId}
        tittel={t("ansattvelger.tittelProsjekt")}
        bekreftLabel={t("ansattvelger.leggTilIProsjektet")}
        isPending={leggTilMangeMutation.isPending}
        feilmelding={leggTilMangeMutation.error?.message ?? null}
        onInviterNy={() => setNyKontaktOpen(true)}
        onBekreft={(userIds) => leggTilMangeMutation.mutate({ projectId: prosjektId, userIds })}
      />

      {/* Ny kontakt (delt invitasjonsmodal) */}
      <OpprettKontaktModal
        open={nyKontaktOpen}
        onClose={() => setNyKontaktOpen(false)}
        prosjektId={prosjektId}
        faggrupper={faggrupperListe.map((f) => ({ id: f.id, name: f.name, color: f.color ?? null }))}
        dokumentflyter={flyterListe.map((df): FlytForModal => ({
          id: df.id,
          name: df.name,
          faggruppeId: (df as unknown as { faggruppeId: string | null }).faggruppeId ?? null,
          roller: df.roller ?? [],
        }))}
        brukergrupper={brukergrupperForModal}
        ledigeFirmaBrukere={ledigeFirmaBrukere.map((b) => ({ id: b.id, name: b.name, email: b.email }))}
        onFerdig={(navn, pmId) => {
          invaliderAlt();
          setForslag({ navn: navn ?? t("brukere.kontakter"), projectMemberId: pmId, visGruppe: true, visFlyt: true });
        }}
      />

      {/* Legg til medlem i gruppe (delt modal, brukergruppe forhåndslåst) */}
      <OpprettKontaktModal
        open={!!leggTilMedlemGruppeId}
        onClose={() => setLeggTilMedlemGruppeId(null)}
        prosjektId={prosjektId}
        faggrupper={faggrupperListe.map((f) => ({ id: f.id, name: f.name, color: f.color ?? null }))}
        dokumentflyter={flyterListe.map((df): FlytForModal => ({
          id: df.id,
          name: df.name,
          faggruppeId: (df as unknown as { faggruppeId: string | null }).faggruppeId ?? null,
          roller: df.roller ?? [],
        }))}
        brukergrupper={brukergrupperForModal}
        ledigeFirmaBrukere={ledigeFirmaBrukere.map((b) => ({ id: b.id, name: b.name, email: b.email }))}
        forhandsvalgtBrukergruppeId={leggTilMedlemGruppeId ?? undefined}
        forhandsvalgtBrukergruppeNavn={visGrupper.find((g) => g.id === leggTilMedlemGruppeId)?.name}
        laasBrukergruppe
        tittel={leggTilMedlemGruppeId ? t("kontakter.leggTilMedlemITittel", { gruppe: visGrupper.find((g) => g.id === leggTilMedlemGruppeId)?.name ?? "" }) : undefined}
        onFerdig={(navn, pmId) => {
          invaliderAlt();
          setForslag({ navn: navn ?? t("brukere.kontakter"), projectMemberId: pmId, visGruppe: false, visFlyt: true });
        }}
      />
    </div>
  );
}

export default function BrukereSide() {
  useToppbarFiltre({ byggeplass: false });
  const { prosjektId } = useProsjekt();
  if (!prosjektId) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  return <KontaktAdmin prosjektId={prosjektId} />;
}
