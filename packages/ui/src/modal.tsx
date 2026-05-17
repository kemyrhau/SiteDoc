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
      className={`w-full max-w-lg rounded-lg border-0 p-0 shadow-xl backdrop:bg-black/50 ${className}`}
    >
      <div className="p-6">
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
