import { describe, expect, it } from "vitest";
import { formaterKjoretid } from "./kjoretid";
import nb from "../i18n/nb.json";
import en from "../i18n/en.json";

/** Ordre 2026-11-14 (11) B: kjøretid vises i timer og minutter, ikke rå minutter. */
const lag = (fil: Record<string, string>) => (k: string, o?: Record<string, unknown>) =>
  (fil[k] ?? k).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? ""));

describe("formaterKjoretid", () => {
  const t = lag(nb as Record<string, string>);
  it.each([
    [0, "0 min"],
    [45, "45 min"],
    [59, "59 min"],
    [59.6, "1 t"],
    [60, "1 t"],
    [95, "1 t 35 min"],
    [120, "2 t"],
    [135, "2 t 15 min"],
  ])("%s min → %s", (min, forventet) => {
    expect(formaterKjoretid(t, min)).toBe(forventet);
  });

  it("negativkontroll: over 60 min gir aldri rå minutter", () => {
    expect(formaterKjoretid(t, 95)).not.toBe("95 min");
  });

  it("engelsk bruker h", () => {
    expect(formaterKjoretid(lag(en as Record<string, string>), 95)).toBe("1 h 35 min");
  });
});
