"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState } from "@sitedoc/ui";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { useTranslation } from "react-i18next";
import { Plus, LayoutGrid, List, Copy, FileText, Upload } from "lucide-react";
import { genererSluttrapportHtml } from "@sitedoc/pdf";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { MatriseVisning } from "@/components/kontrollplan/MatriseVisning";
import { ListeVisning } from "@/components/kontrollplan/ListeVisning";
import { OpprettPunktDialog } from "@/components/kontrollplan/OpprettPunktDialog";
import { RedigerPunktDialog } from "@/components/kontrollplan/RedigerPunktDialog";
import { ImportFremdriftsplanDialog } from "@/components/kontrollplan/ImportFremdriftsplanDialog";
import { FilterPanel } from "@/components/ui/FilterPanel";

// Faste filter-alternativer (labelKey → i18n)
const STATUS_ALT = [
  { id: "planlagt", labelKey: "kontrollplan.statusPlanlagt" },
  { id: "pagar", labelKey: "kontrollplan.statusPagar" },
  { id: "utfort", labelKey: "kontrollplan.statusUtfort" },
  { id: "godkjent", labelKey: "kontrollplan.statusGodkjent" },
];
const OMRADE_ALT = [
  { id: "fukt", labelKey: "kontrollplan.omrade.fukt" },
  { id: "brann", labelKey: "kontrollplan.omrade.brann" },
  { id: "konstruksjon", labelKey: "kontrollplan.omrade.konstruksjon" },
  { id: "geo", labelKey: "kontrollplan.omrade.geo" },
  { id: "grunnarbeid", labelKey: "kontrollplan.omrade.grunnarbeid" },
  { id: "sha", labelKey: "kontrollplan.omrade.sha" },
];

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
  const [visImportDialog, setVisImportDialog] = useState(false);
  const [visKopierDialog, setVisKopierDialog] = useState(false);
  const [valgtPunkt, setValgtPunkt] = useState<PunktType | null>(null);
  const [statusValg, setStatusValg] = useState<string[]>([]);
  const [faggruppeValg, setFaggruppeValg] = useState<string[]>([]);
  const [kontrollomradeValg, setKontrollomradeValg] = useState<string[]>([]);
  const [tekstSok, setTekstSok] = useState("");

  const lagToggle =
    (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
      setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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
    const q = tekstSok.trim().toLowerCase();
    return kontrollplan.punkter.filter((p) => {
      if (statusValg.length > 0 && !statusValg.includes(p.status)) return false;
      if (faggruppeValg.length > 0 && !faggruppeValg.includes(p.faggruppeId)) return false;
      if (kontrollomradeValg.length > 0 && !kontrollomradeValg.includes(p.sjekklisteMal.kontrollomrade ?? "")) return false;
      if (q) {
        const navn = (p.sjekklisteMal?.name ?? "").toLowerCase();
        const omr = (p.omrade?.navn ?? "").toLowerCase();
        if (!navn.includes(q) && !omr.includes(q)) return false;
      }
      return true;
    });
  }, [kontrollplan?.punkter, statusValg, faggruppeValg, kontrollomradeValg, tekstSok]);

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

  const handleSluttrapport = useCallback(async () => {
    if (!kontrollplan) return;
    try {
      const data = await utils.client.kontrollplan.hentSluttrapportData.query({
        kontrollplanId: kontrollplan.id,
        // Sluttrapport tar ett kontrollområde: bruk det valgte kun når nøyaktig
        // ett er filtrert, ellers full rapport (uendret router-kontrakt)
        kontrollomrade: kontrollomradeValg.length === 1 ? (kontrollomradeValg[0] ?? null) : null,
      });
      const naa = new Date();
      const dd = String(naa.getDate()).padStart(2, "0");
      const mm = String(naa.getMonth() + 1).padStart(2, "0");
      const yyyy = naa.getFullYear();
      const html = genererSluttrapportHtml({
        ...data,
        dato: `${dd}.${mm}.${yyyy}`,
      });
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 500);
      }
    } catch (_e) {
      // Feil håndteres av tRPC
    }
  }, [kontrollplan, kontrollomradeValg, utils]);

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
          {kontrollplan && (
            <button
              onClick={() => setVisImportDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border text-gray-600 text-sm rounded hover:bg-gray-50 transition"
            >
              <Upload className="h-4 w-4" />
              {t("kontrollplan.importFremdriftsplan")}
            </button>
          )}
          {kontrollplan && kontrollplan.punkter.length > 0 && (
            <>
              <button
                onClick={() => setVisKopierDialog(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border text-gray-600 text-sm rounded hover:bg-gray-50 transition"
              >
                <Copy className="h-4 w-4" />
                Kopier
              </button>
              <button
                onClick={() => handleSluttrapport()}
                className="flex items-center gap-1.5 px-3 py-1.5 border text-gray-600 text-sm rounded hover:bg-gray-50 transition"
              >
                <FileText className="h-4 w-4" />
                Sluttrapport
              </button>
            </>
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

      {/* Delt filter-panel: fritekst + status/faggruppe/kontrollområde (multi-select) */}
      <div className="mb-4">
        <FilterPanel
          sok={{
            verdi: tekstSok,
            onChange: setTekstSok,
            placeholder: t("kontrollplan.sokPlaceholder"),
          }}
          dimensjoner={[
            {
              id: "status",
              label: t("kontrollplan.filterStatus"),
              options: STATUS_ALT.map((s) => ({ id: s.id, name: t(s.labelKey) })),
              valgte: statusValg,
              onToggle: lagToggle(setStatusValg),
            },
            {
              id: "faggruppe",
              label: t("kontrollplan.filterFaggruppe"),
              options: (faggrupper ?? []).map((fg: { id: string; name: string }) => ({ id: fg.id, name: fg.name })),
              valgte: faggruppeValg,
              onToggle: lagToggle(setFaggruppeValg),
            },
            {
              id: "omrade",
              label: t("kontrollplan.filterOmrade"),
              options: OMRADE_ALT.map((o) => ({ id: o.id, name: t(o.labelKey) })),
              valgte: kontrollomradeValg,
              onToggle: lagToggle(setKontrollomradeValg),
            },
          ]}
          tomLabel={t("filter.tom")}
          onTom={() => { setStatusValg([]); setFaggruppeValg([]); setKontrollomradeValg([]); setTekstSok(""); }}
          visTom={statusValg.length > 0 || faggruppeValg.length > 0 || kontrollomradeValg.length > 0 || tekstSok.length > 0}
          kolonner={3}
        />
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

      {/* Importer fremdriftsplan */}
      {visImportDialog && kontrollplan && (
        <ImportFremdriftsplanDialog
          kontrollplanId={kontrollplan.id}
          projectId={params.prosjektId}
          byggeplassId={aktivByggeplass.id}
          onLukk={() => setVisImportDialog(false)}
          onImportert={handleRefresh}
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
