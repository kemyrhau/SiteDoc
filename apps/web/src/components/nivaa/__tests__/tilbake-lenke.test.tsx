// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** w14 leveranse 1 (B39 A, B40 A): tilbake-knappen og hva sidemenyen lyser på dagen. */
let sok = new URLSearchParams();
let sti = "/dashbord/timer/s1";
const setAktivSeksjon = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => sok,
  usePathname: () => sti,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock("@/kontekst/navigasjon-kontekst", () => ({
  useNavigasjon: () => ({ aktivSeksjon: null, setAktivSeksjon }),
}));

import { TilbakeLenke, useTilbakeAdresse } from "../TilbakeLenke";
import { useAktivSeksjon } from "@/hooks/useAktivSeksjon";
import { RESERVE_MINE_TIMER } from "@/lib/tilbake-adresse";

beforeEach(() => {
  sok = new URLSearchParams();
  sti = "/dashbord/timer/s1";
  setAktivSeksjon.mockClear();
});
afterEach(cleanup);

describe("TilbakeLenke med reserve (timeføringen)", () => {
  it("vei 1: fra prosjektets Timer → «Tilbake til Timer» med uke og filter", () => {
    sok = new URLSearchParams({ retur: "/dashbord/p1/timer?uke=2026-11-09&status=sent" });
    render(<TilbakeLenke reserve={RESERVE_MINE_TIMER} />);
    const a = screen.getByText("timer.tilbakeTilTimer").closest("a")!;
    expect(a.getAttribute("href")).toBe("/dashbord/p1/timer?uke=2026-11-09&status=sent");
  });
  it("vei 2: fra Mine timer → «Tilbake til Mine timer»", () => {
    sok = new URLSearchParams({ retur: "/dashbord/timer/mine" });
    render(<TilbakeLenke reserve={RESERVE_MINE_TIMER} />);
    expect(screen.getByText("timer.tilbakeTilMineTimer").closest("a")!.getAttribute("href")).toBe(
      "/dashbord/timer/mine",
    );
  });
  it("vei 3: bokmerke uten ?retur → reserven «Til Mine timer»", () => {
    render(<TilbakeLenke reserve={RESERVE_MINE_TIMER} />);
    expect(screen.getByText("timer.tilMineTimer").closest("a")!.getAttribute("href")).toBe(
      "/dashbord/timer/mine",
    );
  });
  it("retur utenfor /dashbord/ → reserven, aldri den fremmede adressen", () => {
    sok = new URLSearchParams({ retur: "//ond.no" });
    render(<TilbakeLenke reserve={RESERVE_MINE_TIMER} />);
    expect(screen.getByText("timer.tilMineTimer").closest("a")!.getAttribute("href")).toBe(
      "/dashbord/timer/mine",
    );
  });
  it("kroken gir samme adresse som knappen (brukes etter sletting)", () => {
    sok = new URLSearchParams({ retur: "/dashbord/p1/timer?uke=2026-11-09" });
    const { result } = renderHook(() => useTilbakeAdresse(RESERVE_MINE_TIMER));
    expect(result.current?.href).toBe("/dashbord/p1/timer?uke=2026-11-09");
  });
});

describe("TilbakeLenke uten reserve (papirkurven) — som før", () => {
  it("rendrer ingenting uten retur", () => {
    const { container } = render(<TilbakeLenke />);
    expect(container.innerHTML).toBe("");
  });
  it("kilde=maler gir «Tilbake til maler»", () => {
    sok = new URLSearchParams({ retur: "/dashbord/p1/oppsett", kilde: "maler" });
    render(<TilbakeLenke />);
    expect(screen.getByText("papirkurv.returMaler")).toBeTruthy();
  });
});

describe("useAktivSeksjon på dagen (B40 A)", () => {
  it("fra prosjektets Timer → «timer» lyser", () => {
    sok = new URLSearchParams({ retur: "/dashbord/p1/timer?uke=2026-11-09" });
    renderHook(() => useAktivSeksjon());
    expect(setAktivSeksjon).toHaveBeenLastCalledWith("timer");
  });
  it("fra Mine timer → «mine-timer» (står ikke i sidemenyen, ingenting lyser)", () => {
    sok = new URLSearchParams({ retur: "/dashbord/timer/mine" });
    renderHook(() => useAktivSeksjon());
    expect(setAktivSeksjon).toHaveBeenLastCalledWith("mine-timer");
  });
  it("bokmerke og «Ny dagsseddel» → aldri «dashbord»", () => {
    renderHook(() => useAktivSeksjon());
    expect(setAktivSeksjon).toHaveBeenLastCalledWith("mine-timer");
    sti = "/dashbord/timer/ny";
    sok = new URLSearchParams({ retur: "/dashbord/p1/timer" });
    renderHook(() => useAktivSeksjon());
    expect(setAktivSeksjon).toHaveBeenLastCalledWith("timer");
    expect(setAktivSeksjon).not.toHaveBeenCalledWith("dashbord");
  });
  it("Mine timer og prosjektets Timer er uendret", () => {
    sti = "/dashbord/timer/mine";
    renderHook(() => useAktivSeksjon());
    expect(setAktivSeksjon).toHaveBeenLastCalledWith("mine-timer");
    sti = "/dashbord/p1/timer";
    renderHook(() => useAktivSeksjon());
    expect(setAktivSeksjon).toHaveBeenLastCalledWith("timer");
  });
});

describe("kildevakt: «Slett» og «Avbryt» går til samme adresse som knappen", () => {
  const her = dirname(fileURLToPath(import.meta.url));
  const les = (s: string) => readFileSync(join(her, "../../../app/dashbord/timer", s), "utf-8");
  it("dagen", () => {
    const k = les("[id]/page.tsx");
    expect(k).toContain("router.push(tilbake?.href ?? RESERVE_MINE_TIMER.href)");
    expect(k).not.toContain('router.push("/dashbord/timer/mine")');
    expect(k).not.toContain('href="/dashbord/timer/mine"');
  });
  it("«Ny dagsseddel»: Avbryt + dagen arver ?retur", () => {
    const k = les("ny/page.tsx");
    expect(k).toContain("router.push(tilbake?.href ?? RESERVE_MINE_TIMER.href)");
    expect(k).toContain("medRetur(`/dashbord/timer/${sheet.id}?${params.toString()}`, returParam)");
    expect(k).not.toContain('href="/dashbord/timer/mine"');
  });
});
