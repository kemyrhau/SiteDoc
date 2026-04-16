"use client";

import { useState, type ReactNode, Children, isValidElement } from "react";
import { HelpCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";

/* ------------------------------------------------------------------ */
/*  HjelpFane — ett fane-innhold med tittel                            */
/* ------------------------------------------------------------------ */

export function HjelpFane({ children }: { tittel: string; children: ReactNode }) {
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/*  HjelpKnapp — sirkel med ? som åpner modalen                       */
/* ------------------------------------------------------------------ */

export function HjelpKnapp({ children }: { children: ReactNode }) {
  const [åpen, setÅpen] = useState(false);
  const { t } = useTranslation();

  // Hent fane-data fra children
  const faner: { tittel: string; innhold: ReactNode }[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === HjelpFane) {
      const props = child.props as { tittel: string; children: ReactNode };
      faner.push({ tittel: props.tittel, innhold: props.children });
    }
  });

  return (
    <>
      <button
        onClick={() => setÅpen(true)}
        className="inline-flex items-center justify-center rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        title={t("hjelp.tittel")}
      >
        <HelpCircle className="h-5 w-5" />
      </button>
      {åpen && <HjelpModalGenerisk faner={faner} onLukk={() => setÅpen(false)} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  HjelpModalGenerisk — modal med dynamiske faner                     */
/* ------------------------------------------------------------------ */

function HjelpModalGenerisk({
  faner,
  onLukk,
}: {
  faner: { tittel: string; innhold: ReactNode }[];
  onLukk: () => void;
}) {
  const [aktivIdx, setAktivIdx] = useState(0);
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onLukk}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" />
      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-2xl rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{t("hjelp.tittel")}</h2>
          <button onClick={onLukk} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Faner (kun hvis flere enn 1) */}
        {faner.length > 1 && (
          <div className="flex border-b border-gray-200 px-6">
            {faner.map((f, idx) => (
              <button
                key={f.tittel}
                onClick={() => setAktivIdx(idx)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  aktivIdx === idx
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f.tittel}
              </button>
            ))}
          </div>
        )}

        {/* Innhold */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {faner[aktivIdx]?.innhold}
        </div>
      </div>
    </div>
  );
}
