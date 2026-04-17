"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { X, Plus, ChevronDown, ChevronRight } from "lucide-react";

interface Milepel {
  id: string;
  navn: string;
  maalUke: number;
  maalAar: number;
}

interface OpprettPunktDialogProps {
  kontrollplanId: string;
  projectId: string;
  byggeplassId: string;
  milepeler: Milepel[];
  onLukk: () => void;
  onOpprettet: () => void;
}

interface PunktFrist {
  omradeId: string | null;
  omradeNavn: string;
  fristUke: number | null;
  fristAar: number | null;
}

const naaAar = new Date().getFullYear();

export function OpprettPunktDialog({
  kontrollplanId,
  projectId,
  byggeplassId,
  milepeler,
  onLukk,
  onOpprettet,
}: OpprettPunktDialogProps) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // Hent maler og områder
  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId });
  const { data: omrader } = trpc.omrade.hentForByggeplass.useQuery({ byggeplassId });
  const { data: faggrupper } = trpc.faggruppe.hentForProsjekt.useQuery({ projectId });

  // Formstate
  const [valgtMalId, setValgtMalId] = useState<string>("");
  const [valgtFaggruppeId, setValgtFaggruppeId] = useState<string>("");
  const [valgtMilepelId, setValgtMilepelId] = useState<string>("");
  const [valgteOmradeIder, setValgteOmradeIder] = useState<Set<string>>(new Set());
  const [punktFrister, setPunktFrister] = useState<PunktFrist[]>([]);
  const [malSok, setMalSok] = useState("");

  // Inline opprettelse
  const [visNyttOmrade, setVisNyttOmrade] = useState(false);
  const [nyttOmradeNavn, setNyttOmradeNavn] = useState("");
  const [nyttOmradeType, setNyttOmradeType] = useState<"sone" | "rom" | "etasje">("sone");
  const [visNyMilepel, setVisNyMilepel] = useState(false);
  const [nyMilepelNavn, setNyMilepelNavn] = useState("");
  const [nyMilepelUke, setNyMilepelUke] = useState<number>(1);
  const [nyMilepelAar, setNyMilepelAar] = useState<number>(naaAar);

  // Mutations
  const opprettPunkter = trpc.kontrollplan.opprettPunkter.useMutation({
    onSuccess: () => {
      utils.kontrollplan.hentForByggeplass.invalidate({ byggeplassId });
      onOpprettet();
      onLukk();
    },
  });
  const opprettOmrade = trpc.omrade.opprett.useMutation({
    onSuccess: () => {
      utils.omrade.hentForByggeplass.invalidate({ byggeplassId });
      setVisNyttOmrade(false);
      setNyttOmradeNavn("");
    },
  });
  const opprettMilepel = trpc.kontrollplan.opprettMilepel.useMutation({
    onSuccess: () => {
      utils.kontrollplan.hentForByggeplass.invalidate({ byggeplassId });
      setVisNyMilepel(false);
      setNyMilepelNavn("");
    },
  });

  // Filtrerte maler (kun sjekklister)
  const filteredMaler = useMemo(() => {
    if (!maler) return [];
    return maler
      .filter((m: { category: string; name: string }) =>
        m.category === "sjekkliste" &&
        (malSok === "" || m.name.toLowerCase().includes(malSok.toLowerCase()))
      );
  }, [maler, malSok]);

  // Bygg forhåndsvisning
  const forhåndsvisning = useMemo(() => {
    if (!valgtMalId || !valgtFaggruppeId) return [];
    const mal = maler?.find((m: { id: string }) => m.id === valgtMalId);
    const fg = faggrupper?.find((f: { id: string }) => f.id === valgtFaggruppeId);
    if (!mal || !fg) return [];

    if (valgteOmradeIder.size === 0) {
      // Ingen områder → ett punkt uten område
      return [{ omradeId: null, omradeNavn: "—", malNavn: mal.name, fgNavn: fg.name, fristUke: null, fristAar: naaAar }];
    }

    return [...valgteOmradeIder].map((oid) => {
      const omr = omrader?.find((o: { id: string }) => o.id === oid);
      const eksisterendeFrist = punktFrister.find((f) => f.omradeId === oid);
      return {
        omradeId: oid,
        omradeNavn: omr?.navn ?? "?",
        malNavn: mal.name,
        fgNavn: fg.name,
        fristUke: eksisterendeFrist?.fristUke ?? null,
        fristAar: eksisterendeFrist?.fristAar ?? naaAar,
      };
    });
  }, [valgtMalId, valgtFaggruppeId, valgteOmradeIder, maler, faggrupper, omrader, punktFrister]);

  // Toggle område-valg
  function toggleOmrade(omradeId: string) {
    const ny = new Set(valgteOmradeIder);
    if (ny.has(omradeId)) {
      ny.delete(omradeId);
      setPunktFrister((prev) => prev.filter((f) => f.omradeId !== omradeId));
    } else {
      ny.add(omradeId);
      const omr = omrader?.find((o: { id: string }) => o.id === omradeId);
      setPunktFrister((prev) => [...prev, { omradeId, omradeNavn: omr?.navn ?? "", fristUke: null, fristAar: naaAar }]);
    }
    setValgteOmradeIder(ny);
  }

  // Oppdater frist for et område
  function oppdaterFrist(omradeId: string | null, felt: "fristUke" | "fristAar", verdi: number | null) {
    setPunktFrister((prev) =>
      prev.map((f) => (f.omradeId === omradeId ? { ...f, [felt]: verdi } : f))
    );
  }

  // Submit
  function handleSubmit() {
    if (!valgtMalId || !valgtFaggruppeId) return;

    const punkterData = valgteOmradeIder.size === 0
      ? [{ omradeId: null, fristUke: punktFrister[0]?.fristUke ?? null, fristAar: punktFrister[0]?.fristAar ?? null }]
      : [...valgteOmradeIder].map((oid) => {
          const frist = punktFrister.find((f) => f.omradeId === oid);
          return { omradeId: oid, fristUke: frist?.fristUke ?? null, fristAar: frist?.fristAar ?? null };
        });

    opprettPunkter.mutate({
      kontrollplanId,
      sjekklisteMalId: valgtMalId,
      faggruppeId: valgtFaggruppeId,
      milepelId: valgtMilepelId || null,
      punkter: punkterData,
    });
  }

  const kanSubmit = !!valgtMalId && !!valgtFaggruppeId;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[10vh] overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">{t("kontrollplan.leggTilPunkt")}</h2>
          <button onClick={onLukk} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 1. Sjekkliste-mal */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("kontrollplan.sjekklisteMal")}</label>
            <input
              type="text"
              value={malSok}
              onChange={(e) => setMalSok(e.target.value)}
              placeholder={`${t("kontrollplan.sjekklisteMal")}...`}
              className="w-full border rounded px-2 py-1.5 text-sm mb-1"
            />
            <select
              value={valgtMalId}
              onChange={(e) => setValgtMalId(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm"
              size={Math.min(filteredMaler.length + 1, 6)}
            >
              <option value="">—</option>
              {filteredMaler.map((m: { id: string; prefix: string | null; name: string }) => (
                <option key={m.id} value={m.id}>
                  {m.prefix ? `${m.prefix} — ` : ""}{m.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Områder (flervalg) */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("kontrollplan.omrader")}</label>
            {omrader && omrader.length > 0 ? (
              <div className="border rounded max-h-36 overflow-y-auto p-2 space-y-1">
                {omrader.map((o: { id: string; navn: string; type: string }) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={valgteOmradeIder.has(o.id)}
                      onChange={() => toggleOmrade(o.id)}
                      className="rounded text-sitedoc-primary"
                    />
                    <span>{o.navn}</span>
                    <span className="text-[10px] text-gray-400">{o.type}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">{t("kontrollplan.velgByggeplass")}</p>
            )}
            {/* Inline opprett område */}
            {!visNyttOmrade ? (
              <button onClick={() => setVisNyttOmrade(true)} className="text-xs text-sitedoc-secondary hover:underline mt-1 flex items-center gap-1">
                <Plus className="h-3 w-3" /> {t("kontrollplan.opprettOmrade")}
              </button>
            ) : (
              <div className="mt-2 border rounded p-2 space-y-2 bg-gray-50">
                <input
                  type="text"
                  value={nyttOmradeNavn}
                  onChange={(e) => setNyttOmradeNavn(e.target.value)}
                  placeholder={t("kontrollplan.navn")}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
                <div className="flex gap-3">
                  {(["sone", "rom", "etasje"] as const).map((tp) => (
                    <label key={tp} className="flex items-center gap-1 text-xs">
                      <input
                        type="radio"
                        checked={nyttOmradeType === tp}
                        onChange={() => setNyttOmradeType(tp)}
                      />
                      {tp}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (nyttOmradeNavn) {
                        opprettOmrade.mutate({ projectId, byggeplassId, navn: nyttOmradeNavn, type: nyttOmradeType });
                      }
                    }}
                    disabled={!nyttOmradeNavn || opprettOmrade.isPending}
                    className="text-xs px-2 py-1 bg-sitedoc-primary text-white rounded disabled:opacity-50"
                  >
                    {t("kontrollplan.opprettOmrade")}
                  </button>
                  <button onClick={() => setVisNyttOmrade(false)} className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">
                    {t("handling.avbryt")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Faggruppe */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("kontrollplan.faggruppe")}</label>
            <select
              value={valgtFaggruppeId}
              onChange={(e) => setValgtFaggruppeId(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {faggrupper?.map((fg: { id: string; name: string }) => (
                <option key={fg.id} value={fg.id}>{fg.name}</option>
              ))}
            </select>
          </div>

          {/* 4. Milepæl (valgfri) */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("kontrollplan.milepel")}</label>
            <select
              value={valgtMilepelId}
              onChange={(e) => setValgtMilepelId(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {milepeler.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.navn} ({t("kontrollplan.maalUke", { uke: m.maalUke })})
                </option>
              ))}
            </select>
            {/* Inline opprett milepæl */}
            {!visNyMilepel ? (
              <button onClick={() => setVisNyMilepel(true)} className="text-xs text-sitedoc-secondary hover:underline mt-1 flex items-center gap-1">
                <Plus className="h-3 w-3" /> {t("kontrollplan.opprettMilepel")}
              </button>
            ) : (
              <div className="mt-2 border rounded p-2 space-y-2 bg-gray-50">
                <input
                  type="text"
                  value={nyMilepelNavn}
                  onChange={(e) => setNyMilepelNavn(e.target.value)}
                  placeholder={t("kontrollplan.navn")}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400">{t("kontrollplan.fristUke")}</label>
                    <input type="number" value={nyMilepelUke} onChange={(e) => setNyMilepelUke(Number(e.target.value))} min={1} max={53} className="w-full border rounded px-2 py-1 text-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400">{t("kontrollplan.fristAar")}</label>
                    <input type="number" value={nyMilepelAar} onChange={(e) => setNyMilepelAar(Number(e.target.value))} min={2024} max={2100} className="w-full border rounded px-2 py-1 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (nyMilepelNavn) {
                        opprettMilepel.mutate({ kontrollplanId, navn: nyMilepelNavn, maalUke: nyMilepelUke, maalAar: nyMilepelAar });
                      }
                    }}
                    disabled={!nyMilepelNavn || opprettMilepel.isPending}
                    className="text-xs px-2 py-1 bg-sitedoc-primary text-white rounded disabled:opacity-50"
                  >
                    {t("kontrollplan.opprettMilepel")}
                  </button>
                  <button onClick={() => setVisNyMilepel(false)} className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">
                    {t("handling.avbryt")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 5. Forhåndsvisning med editerbare frister */}
          {forhåndsvisning.length > 0 && (
            <div className="border rounded p-3 bg-gray-50">
              <p className="text-xs font-medium text-gray-600 mb-2">{t("kontrollplan.forhandsvisning")}</p>
              <div className="space-y-2">
                {forhåndsvisning.map((fv, idx) => (
                  <div key={fv.omradeId ?? idx} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">•</span>
                    <span className="font-medium">{fv.omradeNavn}</span>
                    <span className="text-gray-400">×</span>
                    <span>{fv.malNavn}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-500">{fv.fgNavn}</span>
                    <span className="text-gray-400 ml-auto">{t("kontrollplan.fristUke")}:</span>
                    <input
                      type="number"
                      value={punktFrister.find((f) => f.omradeId === fv.omradeId)?.fristUke ?? ""}
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : null;
                        if (fv.omradeId) {
                          oppdaterFrist(fv.omradeId, "fristUke", v);
                        } else {
                          setPunktFrister([{ omradeId: null, omradeNavn: "—", fristUke: v, fristAar: naaAar }]);
                        }
                      }}
                      min={1}
                      max={53}
                      className="w-14 border rounded px-1 py-0.5 text-xs"
                      placeholder="—"
                    />
                    <span className="text-gray-400">/</span>
                    <input
                      type="number"
                      value={punktFrister.find((f) => f.omradeId === fv.omradeId)?.fristAar ?? naaAar}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (fv.omradeId) {
                          oppdaterFrist(fv.omradeId, "fristAar", v);
                        } else {
                          setPunktFrister([{ omradeId: null, omradeNavn: "—", fristUke: punktFrister[0]?.fristUke ?? null, fristAar: v }]);
                        }
                      }}
                      min={2024}
                      max={2100}
                      className="w-16 border rounded px-1 py-0.5 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
          <button onClick={onLukk} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
            {t("handling.avbryt")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!kanSubmit || opprettPunkter.isPending}
            className="px-3 py-1.5 text-sm bg-sitedoc-primary text-white rounded hover:bg-sitedoc-primary/90 disabled:opacity-50"
          >
            {t("kontrollplan.opprettPunkter", { antall: Math.max(forhåndsvisning.length, 1) })}
          </button>
        </div>
      </div>
    </div>
  );
}
