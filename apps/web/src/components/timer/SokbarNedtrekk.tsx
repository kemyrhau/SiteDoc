"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Runde 9 (Kenneth 2026-11-28, ui-standarder § Nedtrekk med søk): nedtrekk med flere enn
 * {@link SOK_TERSKEL} valg har søk. Erstatter `<select>` rett: samme `value`, `onChange(e)` med
 * `e.target.value`, `onBlur`, `className` og `<option>`/`<optgroup>`-barn.
 *
 * - Høyst 5 valg (tomt «velg»-valg teller ikke): den vanlige `<select>`, uendret.
 * - Flere: lukket ser den ut som nedtrekket (samme klasser). Åpnet: søkefelt øverst og lista under.
 *   Det valgte står alltid i lista, også når det ikke treffer søket. Pil opp/ned, Enter, Esc.
 */
export const SOK_TERSKEL = 5;

type Valg = { value: string; label: string; disabled: boolean; gruppe: string | null };

export type SokbarNedtrekkEndring = { target: { value: string } };

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "children"> & {
  value: string | number | null | undefined;
  onChange?: (e: SokbarNedtrekkEndring) => void;
  children?: ReactNode;
};

function tekstAv(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(tekstAv).join("");
  if (isValidElement(node)) return tekstAv((node.props as { children?: ReactNode }).children);
  return "";
}

function lesValg(children: ReactNode, gruppe: string | null, ut: Valg[]): Valg[] {
  Children.forEach(children, (barn) => {
    if (!isValidElement(barn)) return;
    const el = barn as ReactElement<{ value?: unknown; disabled?: boolean; label?: string; children?: ReactNode }>;
    if (el.type === "option") {
      const label = tekstAv(el.props.children);
      ut.push({
        value: el.props.value === undefined ? label : String(el.props.value),
        label,
        disabled: !!el.props.disabled,
        gruppe,
      });
    } else if (el.type === "optgroup") {
      lesValg(el.props.children, el.props.label ?? null, ut);
    } else {
      // Fragment eller annen innpakning: les barna.
      lesValg(el.props.children, gruppe, ut);
    }
  });
  return ut;
}

/** Ytre boks tar breddeklassene fra nedtrekket, så lukket tilstand ligger likt i layouten. */
function rotKlasse(className: string): string {
  const bredde = className
    .split(/\s+/)
    .filter((k) => /^(w-|min-w-|max-w-|flex-1$|flex-auto$|grow$|shrink|basis-|sm:w-|md:w-)/.test(k));
  return bredde.some((k) => k === "w-full" || k === "flex-1" || k === "grow" || k === "flex-auto")
    ? `block ${bredde.join(" ")}`
    : `inline-block align-middle ${bredde.join(" ")}`;
}

export function SokbarNedtrekk({
  value,
  onChange,
  onBlur,
  className = "",
  disabled,
  required,
  children,
  id,
  title,
  ...rest
}: Props) {
  const { t } = useTranslation();
  const verdi = value == null ? "" : String(value);
  const valg = useMemo(() => lesValg(children, null, []), [children]);
  const antall = valg.filter((v) => v.value !== "").length;

  const [apen, setApen] = useState(false);
  const [sok, setSok] = useState("");
  const [aktiv, setAktiv] = useState(0);
  const rotRef = useRef<HTMLDivElement>(null);
  const knappRef = useRef<HTMLButtonElement>(null);
  const listeId = useId();

  useEffect(() => {
    if (!apen) return;
    function utenfor(e: MouseEvent) {
      if (rotRef.current && !rotRef.current.contains(e.target as Node)) setApen(false);
    }
    document.addEventListener("mousedown", utenfor);
    return () => document.removeEventListener("mousedown", utenfor);
  }, [apen]);

  const filtrerte = useMemo(() => {
    const q = sok.trim().toLowerCase();
    if (q === "") return valg;
    return valg.filter((v) => v.value === verdi || v.label.toLowerCase().includes(q));
  }, [valg, sok, verdi]);

  if (antall <= SOK_TERSKEL) {
    return (
      <select
        {...rest}
        id={id}
        title={title}
        value={verdi}
        onChange={(e) => onChange?.({ target: { value: e.target.value } })}
        onBlur={onBlur}
        className={className}
        disabled={disabled}
        required={required}
      >
        {children}
      </select>
    );
  }

  const valgt = valg.find((v) => v.value === verdi) ?? null;
  const ariaLabel = rest["aria-label"];
  const dataTestid = (rest as Record<string, unknown>)["data-testid"] as string | undefined;

  function apne() {
    if (disabled) return;
    setSok("");
    const i = valg.findIndex((v) => v.value === verdi);
    setAktiv(i < 0 ? 0 : i);
    setApen(true);
  }

  function velg(v: Valg) {
    if (v.disabled) return;
    setApen(false);
    setSok("");
    if (v.value !== verdi) onChange?.({ target: { value: v.value } });
    knappRef.current?.focus();
  }

  function flytt(retning: 1 | -1) {
    if (filtrerte.length === 0) return;
    let i = aktiv;
    for (let n = 0; n < filtrerte.length; n++) {
      i = (i + retning + filtrerte.length) % filtrerte.length;
      if (!filtrerte[i]!.disabled) break;
    }
    setAktiv(i);
  }

  function tast(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      flytt(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      flytt(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const v = filtrerte[aktiv];
      if (v) velg(v);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setApen(false);
      knappRef.current?.focus();
    }
  }

  function fokusUt(e: FocusEvent<HTMLDivElement>) {
    const til = e.relatedTarget as Node | null;
    if (til && rotRef.current?.contains(til)) return;
    setApen(false);
    onBlur?.(e as unknown as FocusEvent<HTMLSelectElement>);
  }

  return (
    <div ref={rotRef} className={`relative ${rotKlasse(className)}`} onBlur={fokusUt} data-sokbar-nedtrekk="">
      <button
        ref={knappRef}
        type="button"
        id={id}
        title={title}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={apen}
        aria-controls={listeId}
        aria-haspopup="listbox"
        data-testid={dataTestid}
        disabled={disabled}
        onClick={() => (apen ? setApen(false) : apne())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            apne();
          }
        }}
        className={`${className} inline-flex items-center justify-between gap-2 bg-white text-left`}
      >
        <span className={`truncate ${valgt && valgt.value !== "" ? "" : "text-gray-500"}`}>{valgt?.label ?? ""}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      </button>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={verdi}
          onChange={() => {}}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      )}
      {apen && (
        <div className="absolute left-0 z-50 mt-1 min-w-full max-w-[min(28rem,90vw)] rounded border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                type="text"
                value={sok}
                onChange={(e) => {
                  setSok(e.target.value);
                  setAktiv(0);
                }}
                onKeyDown={tast}
                placeholder={t("handling.sok")}
                aria-label={t("handling.sok")}
                aria-controls={listeId}
                className="w-full rounded border border-gray-300 py-1.5 pl-8 pr-2 text-sm"
                autoFocus
              />
            </div>
          </div>
          <ul id={listeId} role="listbox" aria-label={ariaLabel} className="max-h-60 overflow-y-auto py-1">
            {filtrerte.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">{t("sokbarNedtrekk.ingenTreff")}</li>
            ) : (
              filtrerte.map((v, i) => {
                const nyGruppe = v.gruppe && (i === 0 || filtrerte[i - 1]!.gruppe !== v.gruppe);
                return (
                  <li key={`${v.gruppe ?? ""}|${v.value}|${i}`} role="presentation">
                    {nyGruppe && (
                      <div className="px-3 pb-1 pt-2 text-xs font-semibold text-gray-500">{v.gruppe}</div>
                    )}
                    <div
                      role="option"
                      aria-selected={v.value === verdi}
                      aria-disabled={v.disabled || undefined}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setAktiv(i)}
                      onClick={() => velg(v)}
                      className={`cursor-pointer px-3 py-1.5 text-sm ${
                        v.disabled
                          ? "cursor-not-allowed text-gray-400"
                          : i === aktiv
                            ? "bg-blue-50 text-gray-900"
                            : "text-gray-900"
                      } ${v.value === verdi ? "font-medium" : ""}`}
                    >
                      {v.label}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
