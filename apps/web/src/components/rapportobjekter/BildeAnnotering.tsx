"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Circle, Square, Pencil, Type, Undo2, MousePointer2 } from "lucide-react";
import { ANNOTERINGS_HTML, type AnnoteringsLag } from "@sitedoc/shared";
import { byggBildeSrc } from "@/components/SignertBilde";

// Web-flatens innpakning rundt den DELTE tegnemotoren (@sitedoc/shared
// ANNOTERINGS_HTML). Samme HTML som mobil bruker via WebView — her lastet i en
// <iframe srcDoc>. Broen i HTML-en er toveis (window.parent.postMessage på web,
// window.ReactNativeWebView på mobil), så komponenten trenger ingen egen motor.
//
// Eksport: JPEG q0.92 med hvit bakgrunn (HTML-en eier formatet). onFerdig får
// data-URL-en; kalleren avgjør lagring (nytt vedlegg, original bevart).

type Verktoy = "select" | "arrow" | "circle" | "rect" | "draw" | "text";

interface BildeAnnoteringProps {
  /** Rå fileUrl for bildet som skal annoteres (ORIGINALEN — se annoteringsKilde). */
  bildeUrl: string;
  /** Eksisterende lag hvis bildet er annotert før — objektene lastes redigerbart. */
  lag?: AnnoteringsLag;
  /** Kalles med utflatet JPEG data-URL + laget når brukeren trykker Ferdig. */
  onFerdig: (dataUrl: string, lag: AnnoteringsLag) => void;
  onAvbryt: () => void;
}

// «Flytt» først: når et lagret lag åpnes er flytting den primære handlingen.
const VERKTOYER: { id: Verktoy; ikon: typeof ArrowUpRight; labelKey: string }[] = [
  { id: "select", ikon: MousePointer2, labelKey: "annotering.verktoy.flytt" },
  { id: "arrow", ikon: ArrowUpRight, labelKey: "annotering.verktoy.pil" },
  { id: "circle", ikon: Circle, labelKey: "annotering.verktoy.sirkel" },
  { id: "rect", ikon: Square, labelKey: "annotering.verktoy.firkant" },
  { id: "draw", ikon: Pencil, labelKey: "annotering.verktoy.frihand" },
  { id: "text", ikon: Type, labelKey: "annotering.verktoy.tekst" },
];

export function BildeAnnotering({ bildeUrl, lag, onFerdig, onAvbryt }: BildeAnnoteringProps) {
  const { t } = useTranslation();
  // Åpnes et eksisterende lag: start i Flytt-modus (rediger). Ellers Pil (tegn).
  const [aktivtVerktoy, settAktivtVerktoy] = useState<Verktoy>(lag ? "select" : "arrow");
  const [erKlar, settErKlar] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Tekst-input state (speiler mobil: trykk tom flate → skriv, trykk tekst → rediger)
  const [visTekstModal, settVisTekstModal] = useState(false);
  const [tekstVerdi, settTekstVerdi] = useState("");
  const [tekstPosisjon, settTekstPosisjon] = useState({ x: 0, y: 0 });
  const [redigerIndeks, settRedigerIndeks] = useState<number | null>(null);

  const sendMelding = useCallback((melding: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(melding), "*");
  }, []);

  // onFerdig via ref — holder meldingslytteren stabil (montert én gang)
  const onFerdigRef = useRef(onFerdig);
  onFerdigRef.current = onFerdig;

  useEffect(() => {
    const håndterMelding = (e: MessageEvent) => {
      // Kun meldinger fra vår egen iframe — Next HMR o.l. poster også på window.
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (typeof e.data !== "string") return;
      let data: { type?: string; [k: string]: unknown };
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      if (data.type === "klar") {
        settErKlar(true);
        // Hent bildet på web-siden og send som data-URL (unngår canvas-taint;
        // speiler mobilens nedlasting → base64). Same-origin /api/uploads-proxy
        // sender auth-cookie automatisk. Sender laget med (redigerbar gjenåpning),
        // så det initielle verktøyet så gjeninnlastede objekter blir flyttbare.
        void (async () => {
          try {
            const respons = await fetch(byggBildeSrc(bildeUrl));
            if (!respons.ok) {
              console.error("Annotering: bildehenting feilet:", respons.statusText);
              return;
            }
            const blob = await respons.blob();
            const leser = new FileReader();
            leser.onloadend = () => {
              if (typeof leser.result === "string") {
                sendMelding({ type: "settBilde", bildeUrl: leser.result, lag });
                sendMelding({ type: "velgVerktoy", verktoy: lag ? "select" : "arrow" });
              }
            };
            leser.readAsDataURL(blob);
          } catch (feil) {
            console.error("Annotering: bildehenting feilet:", feil);
          }
        })();
      } else if (data.type === "ferdig" && typeof data.dataUrl === "string") {
        onFerdigRef.current(data.dataUrl, data.lag as AnnoteringsLag);
      } else if (data.type === "tekstInput") {
        settTekstPosisjon({ x: Number(data.x), y: Number(data.y) });
        settTekstVerdi("");
        settRedigerIndeks(null);
        settVisTekstModal(true);
      } else if (data.type === "redigerTekst") {
        settTekstVerdi(String(data.tekst ?? ""));
        settRedigerIndeks(Number(data.indeks));
        settVisTekstModal(true);
      }
    };
    window.addEventListener("message", håndterMelding);
    return () => window.removeEventListener("message", håndterMelding);
  }, [bildeUrl, lag, sendMelding]);

  const håndterVerktoybytte = useCallback(
    (verktoy: Verktoy) => {
      settAktivtVerktoy(verktoy);
      sendMelding({ type: "velgVerktoy", verktoy });
    },
    [sendMelding],
  );

  const håndterTekstBekreft = useCallback(() => {
    const trimmet = tekstVerdi.trim();
    if (redigerIndeks != null) {
      // Tom tekst = slett (HTML-en håndterer det)
      sendMelding({ type: "oppdaterTekst", indeks: redigerIndeks, tekst: trimmet });
    } else if (trimmet) {
      sendMelding({ type: "plasserTekst", tekst: trimmet, x: tekstPosisjon.x, y: tekstPosisjon.y });
    }
    settVisTekstModal(false);
    settTekstVerdi("");
    settRedigerIndeks(null);
  }, [tekstVerdi, tekstPosisjon, redigerIndeks, sendMelding]);

  const håndterTekstAvbryt = useCallback(() => {
    settVisTekstModal(false);
    settTekstVerdi("");
    settRedigerIndeks(null);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-900 px-6 py-3">
        <button
          type="button"
          onClick={onAvbryt}
          className="min-w-[60px] py-2 text-left text-base text-gray-400 hover:text-gray-200"
        >
          {t("handling.avbryt")}
        </button>
        <span className="text-base font-semibold text-white">{t("annotering.tittel")}</span>
        <button
          type="button"
          onClick={() => sendMelding({ type: "lagre" })}
          disabled={!erKlar}
          className={`min-w-[60px] py-2 text-right text-base font-semibold ${
            erKlar ? "text-blue-400 hover:text-blue-300" : "cursor-not-allowed text-gray-600"
          }`}
        >
          {t("handling.ferdig")}
        </button>
      </div>

      {/* Tegneflate (delt HTML via iframe) */}
      <div className="relative flex-1">
        <iframe
          ref={iframeRef}
          title={t("annotering.tittel")}
          srcDoc={ANNOTERINGS_HTML}
          sandbox="allow-scripts"
          className="h-full w-full border-0"
        />
      </div>

      {/* Verktøylinje */}
      <div className="flex items-center justify-around bg-gray-900 px-4 py-3">
        {VERKTOYER.map(({ id, ikon: Ikon, labelKey }) => (
          <button
            key={id}
            type="button"
            onClick={() => håndterVerktoybytte(id)}
            className={`flex flex-col items-center rounded-lg px-3 py-2 ${
              aktivtVerktoy === id ? "bg-blue-600" : ""
            }`}
          >
            <Ikon size={22} color={aktivtVerktoy === id ? "#ffffff" : "#9ca3af"} />
            <span className={`mt-0.5 text-[10px] ${aktivtVerktoy === id ? "text-white" : "text-gray-400"}`}>
              {t(labelKey)}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => sendMelding({ type: "angre" })}
          className="flex flex-col items-center rounded-lg px-3 py-2"
        >
          <Undo2 size={22} color="#9ca3af" />
          <span className="mt-0.5 text-[10px] text-gray-400">{t("annotering.angre")}</span>
        </button>
      </div>

      {/* Tekst-input modal */}
      {visTekstModal && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60">
          <button type="button" className="absolute inset-0 cursor-default" onClick={håndterTekstAvbryt} />
          <div className="mx-6 w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              {redigerIndeks != null ? t("annotering.redigerTekst") : t("annotering.skrivInnTekst")}
            </h3>
            <textarea
              autoFocus
              value={tekstVerdi}
              onChange={(e) => settTekstVerdi(e.target.value)}
              placeholder={t("annotering.tekstPlaceholder")}
              rows={3}
              className="mb-4 min-h-[80px] w-full resize-none rounded-lg border border-gray-300 bg-gray-50 p-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={håndterTekstAvbryt}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                {t("handling.avbryt")}
              </button>
              <button
                type="button"
                onClick={håndterTekstBekreft}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t("handling.leggTil")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
