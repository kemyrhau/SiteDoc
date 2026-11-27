"use client";
/* eslint-disable i18next/no-literal-string -- utviklerverktøy som aldri bygges inn i prod; faste norske strenger etter ordre 2026-11-27 pkt 5 */

import { useCallback, useEffect, useState } from "react";
import { aktivtSteg, kanNeste, type Runde, type Vurdering } from "./schema";

/**
 * Testpanel — fast rute nederst på lokal testflate (lokal-dev.md § 7). Utviklerverktøy,
 * bygges aldri inn i prod (se TestpanelPort), derfor faste norske strenger uten i18n.
 */

const HØYDE_ÅPEN = 260;
const HØYDE_MINIMERT = 32;
const POLL_MS = 2000;
const MINIMERT_NØKKEL = "sitedoc-testpanel-minimert";

// Krymper sider låst til skjermhøyden (f.eks. dashbord-layouten) mens panelet er montert.
const BUNNMARG_CSS = `
html[data-testpanel] body { padding-bottom: var(--testpanel-h); }
html[data-testpanel] .h-screen { height: calc(100vh - var(--testpanel-h)); }
html[data-testpanel] .min-h-screen { min-height: calc(100vh - var(--testpanel-h)); }
`;

function lesMinimert(): boolean {
  try {
    return window.localStorage.getItem(MINIMERT_NØKKEL) === "1";
  } catch {
    return false;
  }
}

function skrivMinimert(v: boolean) {
  try {
    window.localStorage.setItem(MINIMERT_NØKKEL, v ? "1" : "0");
  } catch {
    // Lagring utilgjengelig — panelet virker uten.
  }
}

export function Testpanel() {
  const [runde, setRunde] = useState<Runde | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [minimert, setMinimert] = useState(false);
  const [vurdering, setVurdering] = useState<Vurdering | null>(null);
  const [merknad, setMerknad] = useState("");
  const [forbedring, setForbedring] = useState("");
  const [sender, setSender] = useState(false);

  const hent = useCallback(async () => {
    try {
      const svar = await fetch("/api/testpanel", { cache: "no-store" });
      const data = (await svar.json()) as { runde?: Runde | null; feil?: string };
      if (!svar.ok) {
        setFeil(data.feil ?? `HTTP ${svar.status}`);
        return;
      }
      setFeil(null);
      setRunde(data.runde ?? null);
    } catch (e) {
      setFeil(String(e));
    }
  }, []);

  useEffect(() => {
    setMinimert(lesMinimert());
    void hent();
    const id = window.setInterval(() => void hent(), POLL_MS);
    return () => window.clearInterval(id);
  }, [hent]);

  const høyde = minimert ? HØYDE_MINIMERT : HØYDE_ÅPEN;
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-testpanel", "");
    html.style.setProperty("--testpanel-h", `${høyde}px`);
    return () => {
      html.removeAttribute("data-testpanel");
      html.style.removeProperty("--testpanel-h");
    };
  }, [høyde]);

  const steg = runde ? aktivtSteg(runde) : null;
  const stegNr = steg?.nr ?? null;

  // Nytt steg → tomme felt.
  useEffect(() => {
    setVurdering(null);
    setMerknad("");
    setForbedring("");
  }, [stegNr]);

  const venterAgent = steg?.status === "venter_agent";
  const låst = !steg || venterAgent || sender;
  const nesteÅpen = !låst && steg?.status === "venter_kenneth" && kanNeste(vurdering, merknad);

  async function neste() {
    if (!steg || !nesteÅpen || !vurdering) return;
    setSender(true);
    try {
      const svar = await fetch("/api/testpanel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nr: steg.nr, vurdering, merknad, forbedring }),
      });
      const data = (await svar.json()) as { runde?: Runde; feil?: string };
      if (!svar.ok) setFeil(data.feil ?? `HTTP ${svar.status}`);
      else if (data.runde) setRunde(data.runde);
      await hent();
    } finally {
      setSender(false);
    }
  }

  function veksleMinimert() {
    setMinimert((v) => {
      skrivMinimert(!v);
      return !v;
    });
  }

  const ferdige = runde?.steg.filter((s) => s.status === "ferdig").length ?? 0;
  const antall = runde?.steg.length ?? 0;
  const stegIndeks = steg && runde ? [...runde.steg].sort((a, b) => a.nr - b.nr).indexOf(steg) + 1 : antall;

  return (
    <div
      data-testid="testpanel"
      className="fixed inset-x-0 bottom-0 z-[9999] flex flex-col border-t-2 border-amber-500 bg-white text-sm text-gray-900 shadow-[0_-2px_8px_rgba(0,0,0,0.12)]"
      style={{ height: høyde }}
    >
      <style>{BUNNMARG_CSS}</style>
      <div className="flex h-8 shrink-0 items-center gap-3 bg-amber-50 px-3">
        <span className="font-semibold text-amber-800">Testpanel</span>
        {runde ? (
          <span className="text-gray-600">
            {runde.runde} · <code>{runde.hash.slice(0, 8)}</code> ·{" "}
            {steg ? `steg ${stegIndeks} av ${antall}` : `${ferdige} av ${antall} ferdig`}
          </span>
        ) : (
          <span className="text-gray-500">Ingen aktiv runde</span>
        )}
        {feil && <span className="truncate text-red-600">{feil}</span>}
        <button
          type="button"
          onClick={veksleMinimert}
          className="ml-auto rounded px-2 text-gray-600 hover:bg-amber-100"
        >
          {minimert ? "Vis" : "Minimer"}
        </button>
      </div>

      {!minimert && (
        <div className="flex min-h-0 flex-1 gap-4 overflow-y-auto p-3">
          {!runde ? (
            <p className="text-gray-500">Venter på at agenten legger en runde i aktiv.json …</p>
          ) : !steg ? (
            <p className="font-medium text-green-700">Runden er ferdig. Agenten rapporterer til orkestrator.</p>
          ) : (
            <>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase text-gray-500">Hva agenten tester</div>
                  <div>{steg.hvaTestes}</div>
                  {steg.handling && <div className="text-gray-600">{steg.handling}</div>}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-gray-500">Forventet</div>
                  <div>{steg.forventet}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-gray-500">Agenten så</div>
                  {venterAgent ? (
                    <div className="italic text-gray-500">Agenten kjører steget …</div>
                  ) : (
                    <div>
                      {steg.agentSa}
                      {steg.agentVurdering && (
                        <span
                          className={`ml-2 rounded px-1.5 text-xs font-semibold ${
                            steg.agentVurdering === "godkjent"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {steg.agentVurdering === "godkjent" ? "Agent: godkjent" : "Agent: avvik"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex w-80 shrink-0 flex-col gap-2">
                <div className="flex gap-2">
                  {(["godkjent", "avvik"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={låst}
                      aria-pressed={vurdering === v}
                      onClick={() => setVurdering(v)}
                      className={`flex-1 rounded border px-2 py-1 font-medium disabled:opacity-40 ${
                        vurdering === v
                          ? v === "godkjent"
                            ? "border-green-600 bg-green-600 text-white"
                            : "border-red-600 bg-red-600 text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {v === "godkjent" ? "Godkjent" : "Avvik"}
                    </button>
                  ))}
                </div>
                <textarea
                  aria-label="Merknad"
                  placeholder={vurdering === "avvik" ? "Merknad (påkrevd ved avvik)" : "Merknad"}
                  disabled={låst}
                  value={merknad}
                  onChange={(e) => setMerknad(e.target.value)}
                  rows={2}
                  className="rounded border border-gray-300 px-2 py-1 disabled:bg-gray-50"
                />
                <textarea
                  aria-label="Forbedring"
                  placeholder="Forbedring (valgfri)"
                  disabled={låst}
                  value={forbedring}
                  onChange={(e) => setForbedring(e.target.value)}
                  rows={2}
                  className="rounded border border-gray-300 px-2 py-1 disabled:bg-gray-50"
                />
                <button
                  type="button"
                  disabled={!nesteÅpen}
                  onClick={() => void neste()}
                  className="rounded bg-amber-600 px-3 py-1.5 font-semibold text-white disabled:bg-gray-300"
                >
                  Neste
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
