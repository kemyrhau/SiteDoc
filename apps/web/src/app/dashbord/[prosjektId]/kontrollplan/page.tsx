"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState } from "@sitedoc/ui";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { useTranslation } from "react-i18next";
import { Plus, LayoutGrid, List, Copy } from "lucide-react";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { MatriseVisning } from "@/components/kontrollplan/MatriseVisning";
import { ListeVisning } from "@/components/kontrollplan/ListeVisning";
import { OpprettPunktDialog } from "@/components/kontrollplan/OpprettPunktDialog";
import { RedigerPunktDialog } from "@/components/kontrollplan/RedigerPunktDialog";

interface PunktType {
  id: string;
  kontrollplanId: string;
  omradeId: string | null;
  milepelId: string | null;
  sjekklisteMalId: string;
  faggruppeId: string;
  fristUke: number | null;
  fristAar: number | null;
  status: string;
  avhengerAvId: string | null;
  sjekklisteMal: { id: string; name: string; prefix: string | null; kontrollomrade: string | null };
  faggruppe: { id: string; name: string; color: string | null };
  omrade: { id: string; navn: string; type: string } | null;
  sjekkliste: { id: string; status: string } | null;
  avhengerAv: { id: string; status: string; sjekklisteMal: { name: string }; omrade: { navn: string } | null } | null;
}

export default function KontrollplanSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const { aktivByggeplass } = useByggeplass();
  const [matriseVisning, setMatriseVisning] = useState(true);
  const [visOpprettDialog, setVisOpprettDialog] = useState(false);
  const [visKopierDialog, setVisKopierDialog] = useState(false);
  const [valgtPunkt, setValgtPunkt] = useState<PunktType | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [faggruppeFilter, setFaggruppeFilter] = useState<string>("");
  const [kontrollomradeFilter, setKontrollomradeFilter] = useState<string>("");

  const utils = trpc.useUtils();

  // Auto-opprett kontrollplan for aktiv byggeplass
  const opprettEllerHent = trpc.kontrollplan.opprettEllerHent.useMutation({
    onSuccess: () => {
      if (aktivByggeplass?.id) {
        utils.kontrollplan.hentForByggeplass.invalidate({ byggeplassId: aktivByggeplass.id });
      }
    },
  });

  // Hent kontrollplan
  const { data: kontrollplan, isLoading } = trpc.kontrollplan.hentForByggeplass.useQuery(
    { byggeplassId: aktivByggeplass?.id ?? "" },
    { enabled: !!aktivByggeplass?.id }
  );

  // Hent faggrupper for filter
  const { data: faggrupper } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId }
  );

  // Auto-opprett kontrollplan når byggeplass byttes
  useEffect(() => {
    if (aktivByggeplass?.id && params.prosjektId && !kontrollplan && !isLoading) {
      opprettEllerHent.mutate({
        projectId: params.prosjektId,
        byggeplassId: aktivByggeplass.id,
      });
    }
  }, [aktivByggeplass?.id, params.prosjektId, kontrollplan, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtrerte punkter
  const filteredPunkter = useMemo(() => {
    if (!kontrollplan?.punkter) return [];
    return kontrollplan.punkter.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (faggruppeFilter && p.faggruppeId !== faggruppeFilter) return false;
      if (kontrollomradeFilter && (p.sjekklisteMal.kontrollomrade ?? "") !== kontrollomradeFilter) return false;
      return true;
    });
  }, [kontrollplan?.punkter, statusFilter, faggruppeFilter]);

  // Fremdrift
  const fremdrift = useMemo(() => {
    if (!kontrollplan?.punkter?.length) return { godkjent: 0, total: 0 };
    const total = kontrollplan.punkter.length;
    const godkjent = kontrollplan.punkter.filter((p) => p.status === "godkjent").length;
    return { godkjent, total };
  }, [kontrollplan?.punkter]);

  // Auto-detect: vis liste hvis ingen punkter har områder
  useEffect(() => {
    if (kontrollplan?.punkter?.length) {
      const harOmrader = kontrollplan.punkter.some((p) => p.omradeId !== null);
      if (!harOmrader) setMatriseVisning(false);
    }
  }, [kontrollplan?.punkter]);

  const handlePunktKlikk = useCallback((punkt: PunktType) => {
    setValgtPunkt(punkt);
  }, []);

  const handleRefresh = useCallback(() => {
    if (aktivByggeplass?.id) {
      utils.kontrollplan.hentForByggeplass.invalidate({ byggeplassId: aktivByggeplass.id });
    }
  }, [aktivByggeplass?.id, utils]);

  const oppdaterMilepel = trpc.kontrollplan.oppdaterMilepel.useMutation({
    onSuccess: handleRefresh,
  });

  const handleMilepelRediger = useCallback((milepelId: string, navn: string, maalUke: number, maalAar: number) => {
    oppdaterMilepel.mutate({ milepelId, navn, maalUke, maalAar });
  }, [oppdaterMilepel]);

  if (!aktivByggeplass) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">{t("kontrollplan.velgByggeplass")}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-[1400px] mx-auto">
      {/* Topplinje */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">{t("kontrollplan.tittel")}</h1>
          {fremdrift.total > 0 && (
            <span className="text-xs text-gray-500">
              {fremdrift.godkjent}/{fremdrift.total} {t("kontrollplan.statusGodkjent").toLowerCase()} ({Math.round((fremdrift.godkjent / fremdrift.total) * 100)}%)
            </span>
          )}
          <HjelpKnapp>
            <HjelpFane tittel={t("hjelp.kontrollplan.tittel")}>
              <p className="mb-3">{t("hjelp.kontrollplan.beskrivelse")}</p>
              <h4 className="font-semibold mb-1">{t("hjelp.kontrollplan.matriseTittel")}</h4>
              <p className="mb-3">{t("hjelp.kontrollplan.matriseBeskrivelse")}</p>
              <h4 className="font-semibold mb-1">{t("hjelp.kontrollplan.milepelTittel")}</h4>
              <p>{t("hjelp.kontrollplan.milepelBeskrivelse")}</p>
            </HjelpFane>
          </HjelpKnapp>
        </div>
        <div className="flex items-center gap-2">
          {/* Visning-toggle */}
          <div className="flex items-center border rounded overflow-hidden">
            <button
              onClick={() => setMatriseVisning(true)}
              className={`p-1.5 ${matriseVisning ? "bg-sitedoc-primary text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              title={t("kontrollplan.matrise")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMatriseVisning(false)}
              className={`p-1.5 ${!matriseVisning ? "bg-sitedoc-primary text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              title={t("kontrollplan.liste")}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          {kontrollplan && kontrollplan.punkter.length > 0 && (
            <button
              onClick={() => setVisKopierDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border text-gray-600 text-sm rounded hover:bg-gray-50 transition"
            >
              <Copy className="h-4 w-4" />
              Kopier
            </button>
          )}
          <button
            onClick={() => setVisOpprettDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sitedoc-primary text-white text-sm rounded hover:bg-sitedoc-primary/90 transition"
          >
            <Plus className="h-4 w-4" />
            {t("kontrollplan.leggTilPunkt")}
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border rounded px-2 py-1.5 text-gray-600 bg-white"
        >
          <option value="">{t("kontrollplan.filterStatus")}</option>
          <option value="planlagt">{t("kontrollplan.statusPlanlagt")}</option>
          <option value="pagar">{t("kontrollplan.statusPagar")}</option>
          <option value="utfort">{t("kontrollplan.statusUtfort")}</option>
          <option value="godkjent">{t("kontrollplan.statusGodkjent")}</option>
        </select>
        <select
          value={faggruppeFilter}
          onChange={(e) => setFaggruppeFilter(e.target.value)}
          className="text-xs border rounded px-2 py-1.5 text-gray-600 bg-white"
        >
          <option value="">{t("kontrollplan.filterFaggruppe")}</option>
          {faggrupper?.map((fg: { id: string; name: string }) => (
            <option key={fg.id} value={fg.id}>{fg.name}</option>
          ))}
        </select>
        <select
          value={kontrollomradeFilter}
          onChange={(e) => setKontrollomradeFilter(e.target.value)}
          className="text-xs border rounded px-2 py-1.5 text-gray-600 bg-white"
        >
          <option value="">Kontrollomr. — {t("status.alle")}</option>
          <option value="fukt">Fukt</option>
          <option value="brann">Brann</option>
          <option value="konstruksjon">Konstruksjon</option>
          <option value="geo">Geoteknikk</option>
          <option value="grunnarbeid">Grunnarbeid</option>
          <option value="sha">SHA</option>
        </select>
      </div>

      {/* Innhold */}
      {filteredPunkter.length === 0 ? (
        <EmptyState
          title={t("kontrollplan.ingenPunkter")}
          description={t("kontrollplan.ingenPunkterBeskrivelse")}
        />
      ) : matriseVisning ? (
        <MatriseVisning
          punkter={filteredPunkter}
          milepeler={kontrollplan?.milepeler ?? []}
          onPunktKlikk={handlePunktKlikk}
          onMilepelRediger={handleMilepelRediger}
        />
      ) : (
        <ListeVisning
          punkter={filteredPunkter}
          milepeler={kontrollplan?.milepeler ?? []}
          onPunktKlikk={handlePunktKlikk}
        />
      )}

      {/* Opprett punkt-dialog */}
      {visOpprettDialog && kontrollplan && (
        <OpprettPunktDialog
          kontrollplanId={kontrollplan.id}
          projectId={params.prosjektId}
          byggeplassId={aktivByggeplass.id}
          milepeler={kontrollplan.milepeler}
          onLukk={() => setVisOpprettDialog(false)}
          onOpprettet={handleRefresh}
        />
      )}

      {/* Rediger punkt-dialog */}
      {valgtPunkt && kontrollplan && (
        <RedigerPunktDialog
          punkt={valgtPunkt}
          allePunkter={kontrollplan.punkter}
          projectId={params.prosjektId}
          onLukk={() => setValgtPunkt(null)}
          onOppdatert={handleRefresh}
        />
      )}

      {/* Kopier mellom områder */}
      {visKopierDialog && kontrollplan && aktivByggeplass && (
        <KopierDialog
          kontrollplanId={kontrollplan.id}
          byggeplassId={aktivByggeplass.id}
          onLukk={() => setVisKopierDialog(false)}
          onKopiert={handleRefresh}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KopierDialog — kopier punkter fra kilde-områder til mål-områder    */
/* ------------------------------------------------------------------ */

function KopierDialog({
  kontrollplanId,
  byggeplassId,
  onLukk,
  onKopiert,
}: {
  kontrollplanId: string;
  byggeplassId: string;
  onLukk: () => void;
  onKopiert: () => void;
}) {
  const { t } = useTranslation();
  const { data: omrader } = trpc.omrade.hentForByggeplass.useQuery({ byggeplassId });
  const [kildeIder, setKildeIder] = useState<Set<string>>(new Set());
  const [maalIder, setMaalIder] = useState<Set<string>>(new Set());
  const [fristForskyvning, setFristForskyvning] = useState(0);

  const utils = trpc.useUtils();
  const kopier = trpc.kontrollplan.kopierPunkter.useMutation({
    onSuccess: (data) => {
      utils.kontrollplan.hentForByggeplass.invalidate({ byggeplassId });
      onKopiert();
      onLukk();
    },
  });

  const toggle = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
    const ny = new Set(set);
    if (ny.has(id)) ny.delete(id); else ny.add(id);
    setFn(ny);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[10vh]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">Kopier kontrollpunkter</h2>
          <button onClick={onLukk} className="p-1 hover:bg-gray-100 rounded text-gray-400">✕</button>
        </div>
        <div className="p-4 space-y-4">
          {/* Kilde */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Kopier fra:</label>
            <div className="border rounded max-h-28 overflow-y-auto p-2 space-y-1">
              {omrader?.map((o: { id: string; navn: string }) => (
                <label key={o.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={kildeIder.has(o.id)} onChange={() => toggle(kildeIder, setKildeIder, o.id)} className="rounded h-3 w-3" />
                  {o.navn}
                </label>
              ))}
            </div>
          </div>
          {/* Mål */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Kopier til:</label>
            <div className="border rounded max-h-28 overflow-y-auto p-2 space-y-1">
              {omrader?.filter((o: { id: string }) => !kildeIder.has(o.id)).map((o: { id: string; navn: string }) => (
                <label key={o.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={maalIder.has(o.id)} onChange={() => toggle(maalIder, setMaalIder, o.id)} className="rounded h-3 w-3" />
                  {o.navn}
                </label>
              ))}
            </div>
          </div>
          {/* Frist-forskyvning */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Forskyv frister:</label>
            <input type="number" value={fristForskyvning} onChange={(e) => setFristForskyvning(Number(e.target.value))} className="w-16 border rounded px-2 py-1 text-xs" />
            <span className="text-xs text-gray-500">{t("kontrollplan.skyvUker")}</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
          <button onClick={onLukk} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">{t("handling.avbryt")}</button>
          <button
            onClick={() => kopier.mutate({ kontrollplanId, kildeOmradeIder: [...kildeIder], maalOmradeIder: [...maalIder], fristForskyvningUker: fristForskyvning })}
            disabled={kildeIder.size === 0 || maalIder.size === 0 || kopier.isPending}
            className="px-3 py-1.5 text-sm bg-sitedoc-primary text-white rounded disabled:opacity-50"
          >
            Kopier
          </button>
        </div>
      </div>
    </div>
  );
}
