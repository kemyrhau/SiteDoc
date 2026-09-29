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
    </div>
  );
}
