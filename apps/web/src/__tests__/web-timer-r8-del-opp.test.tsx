// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";

/**
 * Runde 8 timer (Kenneth 2026-11-28 «Ja, begge»): «Følger med» i arbeiderens «Del opp» av en timerad.
 * Forslaget fordeler maskin og vare etter timene, tillegg/utlegg til delen med flest timer, reise ut
 * til første del og reise hjem til siste. Summvakten sperrer lagring. Lederens splitt er urørt.
 * Serverens del står i `apps/api/src/routes/timer-r8-del-opp.integration.test.ts`.
 */

const h = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  const kall = { mutate: [] as unknown[], query: [] as string[], refetch: 0 };
  const queryFeil = { aktiv: false };
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get(_m, p: string | symbol) {
        if (typeof p !== "string" || p === "then") return undefined;
        const navn = sti.join(".");
        if (p === "useQuery")
          return (_i: unknown, o?: { enabled?: boolean }) => {
            if (o?.enabled !== false) kall.query.push(navn);
            const av = o?.enabled === false;
            return {
              data: av ? undefined : data[navn],
              isLoading: !av && data[navn] === undefined && !queryFeil.aktiv,
              isError: !av && queryFeil.aktiv,
              refetch: () => { kall.refetch++; return Promise.resolve(); },
            };
          };
        if (p === "useMutation") return () => ({ mutate: (i: unknown) => kall.mutate.push(i), isPending: false });
        if (p === "useUtils") return () => lag([]);
        if (p === "invalidate") return () => Promise.resolve();
        return lag([...sti, p]);
      },
    });
  return { data, kall, queryFeil, trpc: lag([]) };
});

vi.mock("@/lib/trpc", () => ({ trpc: h.trpc }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k), i18n: { language: "nb" } }),
}));
// Redigeringsraden hentes med katalogene sine; her trengs bare timer-tallet.
vi.mock("@/components/timer/RedigerTimerRad", () => ({
  RedigerTimerRad: (p: { rad: { timer: number; projectId: string; fraTid: string | null; tilTid: string | null }; onChange: (f: Record<string, unknown>) => void }) => (
    <div>
      <input aria-label="timer" value={p.rad.timer} onChange={(e) => p.onChange({ timer: Number(e.target.value) })} />
      <input aria-label="prosjekt" value={p.rad.projectId} onChange={(e) => p.onChange({ projectId: e.target.value })} />
      <input aria-label="fra" value={p.rad.fraTid ?? ""} onChange={(e) => p.onChange({ fraTid: e.target.value })} />
      <input aria-label="til" value={p.rad.tilTid ?? ""} onChange={(e) => p.onChange({ tilTid: e.target.value })} />
    </div>
  ),
}));

const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void };
proto.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
proto.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

import { SplittRadModal } from "@/components/timer/SplittRadModal";

const KOBLET = {
  projectId: "P1",
  maskiner: [{ id: "m1", navn: "Gravemaskin", timer: 8 }],
  varer: [{ id: "v1", navn: "Pukk", enhet: "tonn", antall: 10 }],
  tillegg: [{ id: "t1", navn: "Smuss", antall: 1 }],
  utlegg: [{ id: "u1", navn: "Parkering", belop: 50 }],
  reiser: [
    { id: "r-ut", retning: "ut", fraTid: "06:20", tilTid: "07:00" },
    { id: "r-hjem", retning: "retur", fraTid: "15:00", tilTid: "15:40" },
  ],
};

function vis(eierModus: boolean) {
  return render(
    <SplittRadModal
      radType="timer"
      original={{
        id: "rad1", lonnsartId: "l1", aktivitetId: "a1", externalCostObjectId: "eco1", projectId: "P1",
        byggeplassId: null, fraTid: "07:00", tilTid: "15:00", timer: 8,
      }}
      sheetId="s1"
      organizationId="o1"
      prosjekter={[]}
      tidsrundingMinutter={null}
      eierModus={eierModus}
      onLukk={() => {}}
      onLagret={() => {}}
    />,
  );
}

/** Del i to: 07–13 (6 t) + 13–15 (2 t). */
function delOpp() {
  fireEvent.click(screen.getByText("timer.splitt.leggTilRad"));
  const sett = (felt: string, i: number, verdi: string) =>
    fireEvent.change(screen.getAllByLabelText(felt)[i]!, { target: { value: verdi } });
  sett("timer", 0, "6");
  sett("til", 0, "13:00");
  sett("timer", 1, "2");
  sett("fra", 1, "13:00");
  sett("til", 1, "15:00");
}

const tall = (navn: string) => (screen.getByLabelText(navn) as HTMLInputElement).value;
const del1 = 'timer.splitt.del{"nr":1} (07:00–13:00)';
const del2 = 'timer.splitt.del{"nr":2} (13:00–15:00)';

beforeEach(() => {
  h.data["timer.dagsseddel.delOppKoblet"] = KOBLET;
  h.kall.mutate.length = 0;
  h.kall.query.length = 0;
  h.kall.refetch = 0;
  h.queryFeil.aktiv = false;
});
afterEach(cleanup);

describe("Runde 8 — «Følger med» i arbeiderens Del opp", () => {
  it("(a) forslaget: maskin og vare etter timene, tillegg og utlegg til delen med flest timer", () => {
    vis(true);
    delOpp();
    const m = 'timer.splitt.folgerMed.maskin: Gravemaskin · 8,0 t';
    expect(tall(`${m} — ${del1}`)).toBe("6");
    expect(tall(`${m} — ${del2}`)).toBe("2");
    const v = "timer.splitt.folgerMed.vare: Pukk · 10,0 tonn";
    expect(tall(`${v} — ${del1}`)).toBe("7.5");
    expect(tall(`${v} — ${del2}`)).toBe("2.5");
    const t = "timer.splitt.folgerMed.tillegg: Smuss · 1,0 — timer.splitt.folgerMed.horerTil";
    expect((screen.getByLabelText(t) as HTMLSelectElement).value).toBe("0");
  });

  it("(b) reise ut følger første del, reise hjem siste del", () => {
    vis(true);
    delOpp();
    const ut = screen.getByLabelText(/reiseUt.* — timer\.splitt\.folgerMed\.reiseHorerTil/) as HTMLSelectElement;
    const hjem = screen.getByLabelText(/reiseHjem.* — timer\.splitt\.folgerMed\.reiseHorerTil/) as HTMLSelectElement;
    expect(ut.value).toBe("0");
    expect(hjem.value).toBe("1");
  });

  it("justert fordeling sendes med; tillegget flyttes til del 2", () => {
    vis(true);
    delOpp();
    const m = 'timer.splitt.folgerMed.maskin: Gravemaskin · 8,0 t';
    fireEvent.change(screen.getByLabelText(`${m} — ${del1}`), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(`${m} — ${del2}`), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("timer.splitt.folgerMed.tillegg: Smuss · 1,0 — timer.splitt.folgerMed.horerTil"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByText("timer.splitt.lagre"));
    expect(h.kall.mutate).toHaveLength(1);
    const sendt = h.kall.mutate[0] as { fordeling: Record<string, { id: string }[]> };
    expect(sendt.fordeling.maskiner).toEqual([{ id: "m1", timer: [5, 3] }]);
    expect(sendt.fordeling.varer).toEqual([{ id: "v1", antall: [7.5, 2.5] }]);
    expect(sendt.fordeling.tillegg).toEqual([{ id: "t1", del: 1 }]);
    expect(sendt.fordeling.utlegg).toEqual([{ id: "u1", del: 0 }]);
    expect(sendt.fordeling.reiser).toEqual([
      { id: "r-ut", del: 0 },
      { id: "r-hjem", del: 1 },
    ]);
  });

  it("summvakten: maskintimer som ikke går opp sperrer Lagre og vises", () => {
    vis(true);
    delOpp();
    const m = 'timer.splitt.folgerMed.maskin: Gravemaskin · 8,0 t';
    fireEvent.change(screen.getByLabelText(`${m} — ${del1}`), { target: { value: "7" } });
    expect(screen.getByText('timer.splitt.folgerMed.sumFeil{"sum":"9,0","skal":"8,0"}')).toBeTruthy();
    const lagre = screen.getByText("timer.splitt.lagre").closest("button")!;
    expect(lagre.disabled).toBe(true);
    fireEvent.click(lagre);
    expect(h.kall.mutate).toHaveLength(0);
  });

  it("del i et annet prosjekt: maskin og vare får 0 der, tillegg kan følge", () => {
    vis(true);
    delOpp();
    fireEvent.change(screen.getAllByLabelText("prosjekt")[1]!, { target: { value: "P2" } });
    const m = 'timer.splitt.folgerMed.maskin: Gravemaskin · 8,0 t';
    expect(tall(`${m} — ${del1}`)).toBe("8");
    expect(tall(`${m} — ${del2}`)).toBe("0");
    fireEvent.change(screen.getByLabelText(`${m} — ${del2}`), { target: { value: "1" } });
    expect(screen.getByText("timer.splitt.folgerMed.annetProsjekt")).toBeTruthy();
  });

  it("lederens splitt (attestering) er urørt: ingen spørring, ingen seksjon, ingen fordeling", () => {
    vis(false);
    delOpp();
    expect(h.kall.query).not.toContain("timer.dagsseddel.delOppKoblet");
    expect(screen.queryByText("timer.splitt.folgerMed.tittel")).toBeNull();
    fireEvent.click(screen.getByText("timer.splitt.lagre"));
    expect(h.kall.mutate).toHaveLength(1);
    expect(h.kall.mutate[0]).not.toHaveProperty("fordeling");
  });

  it("uten koblede rader vises ingen seksjon og ingen fordeling sendes", () => {
    h.data["timer.dagsseddel.delOppKoblet"] = { projectId: "P1", maskiner: [], varer: [], tillegg: [], utlegg: [], reiser: [] };
    vis(true);
    delOpp();
    expect(screen.queryByText("timer.splitt.folgerMed.tittel")).toBeNull();
    fireEvent.click(screen.getByText("timer.splitt.lagre"));
    expect(h.kall.mutate[0]).not.toHaveProperty("fordeling");
  });

  it("gate-funn 1: mens «Følger med» lastes er Lagre sperret, og ingenting sendes uten fordeling", () => {
    delete h.data["timer.dagsseddel.delOppKoblet"];
    vis(true);
    delOpp();
    const lagre = screen.getByText("timer.splitt.lagre").closest("button")!;
    expect(lagre.disabled).toBe(true);
    fireEvent.click(lagre);
    expect(h.kall.mutate).toHaveLength(0);
  });

  it("gate-funn 1: feiler innlastingen, vises feilen med «Prøv igjen», og Lagre er sperret", () => {
    delete h.data["timer.dagsseddel.delOppKoblet"];
    h.queryFeil.aktiv = true;
    vis(true);
    delOpp();
    expect(screen.getByRole("alert").textContent).toContain("timer.splitt.folgerMed.lastFeil");
    fireEvent.click(screen.getByText("handling.provIgjen"));
    expect(h.kall.refetch).toBe(1);
    const lagre = screen.getByText("timer.splitt.lagre").closest("button")!;
    expect(lagre.disabled).toBe(true);
    fireEvent.click(lagre);
    expect(h.kall.mutate).toHaveLength(0);
  });
});
