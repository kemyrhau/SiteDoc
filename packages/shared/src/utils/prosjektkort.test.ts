import { describe, expect, it } from "vitest";
import {
  beregnKortSummer,
  dagSummer,
  kortStatus,
  lesTimerModus,
  sumIDag,
  trafikklysSone,
  utledKortByggeplass,
} from "./prosjektkort";

const t = (
  timer: number | string,
  over: Partial<{
    projectId: string;
    byggeplassId: string | null;
    erReise: boolean;
    attestertStatus: string | null;
  }> = {},
) => ({
  projectId: "p1",
  byggeplassId: null,
  timer,
  erReise: false,
  attestertStatus: "pending",
  ...over,
});

describe("lesTimerModus", () => {
  it("prosjektkort kun ved eksakt verdi, alt annet dagskort", () => {
    expect(lesTimerModus("prosjektkort")).toBe("prosjektkort");
    expect(lesTimerModus("dagskort")).toBe("dagskort");
    expect(lesTimerModus(undefined)).toBe("dagskort");
    expect(lesTimerModus(null)).toBe("dagskort");
    expect(lesTimerModus("tull")).toBe("dagskort");
  });
});

describe("beregnKortSummer", () => {
  it("skiller arbeid og reise, utelater erstattede rader", () => {
    const s = beregnKortSummer(
      [
        t("4.5"),
        t(2, { erReise: true }),
        t(3, { attestertStatus: "erstattet" }),
        t(1, { erReise: true, attestertStatus: "erstattet" }),
        t(1.5, { attestertStatus: "attestert" }),
      ],
      [
        { projectId: "p1", byggeplassId: null, timer: "2", attestertStatus: "pending" },
        { projectId: "p1", byggeplassId: null, timer: 5, attestertStatus: "erstattet" },
      ],
      [],
    );
    expect(s).toEqual({ arbeid: 6, maskin: 2, reise: 2, varer: null });
  });

  it("varer: én enhet gir summert mengde", () => {
    const s = beregnKortSummer([], [], [
      { projectId: "p1", antall: 2.5, vare: { enhet: "m3" } },
      { projectId: "p1", antall: 1, vare: { enhet: "m3" } },
    ]);
    expect(s.varer).toEqual({ type: "mengde", antall: 3.5, enhet: "m3" });
  });

  it("varer: ulike enheter gir antall linjer", () => {
    const s = beregnKortSummer([], [], [
      { projectId: "p1", antall: 2, vare: { enhet: "m3" } },
      { projectId: "p1", antall: 4, vare: { enhet: "stk" } },
      { projectId: "p1", antall: 1, vare: { enhet: "stk" } },
    ]);
    expect(s.varer).toEqual({ type: "linjer", antall: 3 });
  });
});

describe("sumIDag / dagSummer", () => {
  it("sum i dag = arbeid + reise, uten erstattede — samme filter som kortene", () => {
    const rader = [
      t(4),
      t(1, { erReise: true }),
      t(8, { attestertStatus: "erstattet" }),
      t(2, { projectId: "p2" }),
    ];
    expect(sumIDag(rader)).toBe(7);
    const p1 = beregnKortSummer(rader.filter((r) => r.projectId === "p1"), [], []);
    const p2 = beregnKortSummer(rader.filter((r) => r.projectId === "p2"), [], []);
    expect(p1.arbeid + p1.reise + p2.arbeid + p2.reise).toBe(sumIDag(rader));
    expect(
      dagSummer(rader, [
        { projectId: "p1", byggeplassId: null, timer: 3, attestertStatus: "pending" },
        { projectId: "p2", byggeplassId: null, timer: 9, attestertStatus: "erstattet" },
      ]),
    ).toEqual({ maskin: 3, reise: 1 });
  });
});

describe("utledKortByggeplass", () => {
  it("ingen byggeplass på rader eller sedel → ingen", () => {
    expect(utledKortByggeplass([t(1), t(2)], null)).toEqual({ type: "ingen" });
    expect(utledKortByggeplass([], "bp1")).toEqual({ type: "ingen" });
  });

  it("én byggeplass → navnet; rad uten egen arver sedelens", () => {
    expect(utledKortByggeplass([t(1), t(2, { byggeplassId: "bp1" })], "bp1")).toEqual({
      type: "en",
      id: "bp1",
    });
    expect(utledKortByggeplass([t(1)], "bp9")).toEqual({ type: "en", id: "bp9" });
  });

  it("flere byggeplasser → antall; erstattet teller ikke", () => {
    expect(
      utledKortByggeplass(
        [
          t(1, { byggeplassId: "bp1" }),
          t(1, { byggeplassId: "bp2" }),
          t(1, { byggeplassId: "bp3", attestertStatus: "erstattet" }),
          t(1),
        ],
        "bp1",
      ),
    ).toEqual({ type: "flere", antall: 2 });
  });
});

describe("kortStatus", () => {
  it("returnert vinner, alle attestert gir attestert, ellers ingen", () => {
    expect(kortStatus([{ attestertStatus: "attestert" }, { attestertStatus: "returnert" }])).toBe(
      "returnert",
    );
    expect(
      kortStatus([{ attestertStatus: "attestert" }, { attestertStatus: "erstattet" }]),
    ).toBe("attestert");
    expect(kortStatus([{ attestertStatus: "attestert" }, { attestertStatus: "pending" }])).toBe(
      null,
    );
    expect(kortStatus([])).toBe(null);
  });
});

describe("trafikklysSone", () => {
  it("samme regel som dagskortets topp-sum", () => {
    expect(trafikklysSone(7.5, null)).toBe("grå");
    expect(trafikklysSone(7.55, 7.5)).toBe("grønn");
    expect(trafikklysSone(8, 7.5)).toBe("gul");
    expect(trafikklysSone(6, 7.5)).toBe("blå");
  });
});
