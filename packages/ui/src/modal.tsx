"use client";

import { type ReactNode, useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  // T7-5b-3 (2026-05-17): klikk på backdrop (utenfor dialog-innhold)
  // kaller onClose. Default false for bakover-kompatibilitet.
  lukkVedBackdropKlikk?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className = "",
  lukkVedBackdropKlikk = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={
        lukkVedBackdropKlikk
          ? (e) => {
              if (e.target === dialogRef.current) onClose();
            }
          : undefined
      }
      suppressHydrationWarning
      // T7-5b-fiks (2026-05-17): className må kunne overstyre max-w-lg.
      // I Tailwind taper en senere arbitrary value (max-w-[80vw]) mot en
      // tidligere standard utility (max-w-lg) i samme utvalg. Løsning:
      // bare legg til max-w-lg som fallback når className ikke selv har
      // en max-w-* utility. Bevarer eksisterende callers som sender kun
      // f.eks. className="z-[60]" (FaggruppeTilknytningModal).
      className={`w-full ${className}${/\bmax-w-/.test(className) ? "" : " max-w-lg"} rounded-lg border-0 p-0 shadow-xl backdrop:bg-black/50`}
    >
      {/* T7-5b-B1 (2026-05-17): indre wrapper får mx-auto + betinget max-w-3xl.
          Når caller sender max-w-* i Modal-className, lar vi indre div være
          uten cap (følger ytter-dialogen). Ellers fall tilbake til max-w-3xl
          som balanserer mot max-w-lg på ytter — historisk vant ytter ved
          standard, indre fikk fri bredde — nå gjør vi det eksplisitt. */}
      <div
        className={`mx-auto ${/\bmax-w-/.test(className) ? "" : "max-w-3xl"} p-6`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
