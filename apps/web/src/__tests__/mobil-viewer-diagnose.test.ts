/**
 * ORDRE 8 (iii): diagnoselinja i mobil-vieweren er usynlig uten flagget og kan slås på fra
 * appen uten OTA (fem raske trykk øverst til venstre, huskes).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DIAG_ANTALL_TRYKK, DIAG_LAGRINGSNØKKEL, DIAG_SONE_PX, DIAG_VINDU_MS,
  diagFraUrlEllerLager, lagDiagHemmeligTrykk,
} from "../app/mobil-viewer/diagnose";

const lager = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => lager.get(k) ?? null,
  setItem: (k: string, v: string) => { lager.set(k, String(v)); },
});

describe("diagFraUrlEllerLager", () => {
  beforeEach(() => lager.clear());

  it("av uten flagg og uten lagret valg", () => {
    expect(diagFraUrlEllerLager("")).toBe(false);
    expect(diagFraUrlEllerLager("?urls=a.ifc")).toBe(false);
  });

  it("?diag=1 slår på", () => {
    expect(diagFraUrlEllerLager("?diag=1")).toBe(true);
    expect(diagFraUrlEllerLager("?diag=0")).toBe(false);
  });

  it("lagret valg huskes", () => {
    lager.set(DIAG_LAGRINGSNØKKEL, "1");
    expect(diagFraUrlEllerLager("")).toBe(true);
    lager.set(DIAG_LAGRINGSNØKKEL, "0");
    expect(diagFraUrlEllerLager("")).toBe(false);
  });
});

describe("lagDiagHemmeligTrykk", () => {
  it("fem raske trykk i sonen veksler; fire gjør ikke", () => {
    const veksle = vi.fn();
    const trykk = lagDiagHemmeligTrykk(veksle);
    for (let i = 0; i < DIAG_ANTALL_TRYKK - 1; i++) trykk(10, 10, i * 100);
    expect(veksle).not.toHaveBeenCalled();
    trykk(10, 10, 500);
    expect(veksle).toHaveBeenCalledTimes(1);
  });

  it("trykk utenfor sonen nullstiller", () => {
    const veksle = vi.fn();
    const trykk = lagDiagHemmeligTrykk(veksle);
    for (let i = 0; i < 4; i++) trykk(10, 10, i * 100);
    trykk(DIAG_SONE_PX + 1, 10, 450);
    trykk(10, 10, 500);
    expect(veksle).not.toHaveBeenCalled();
  });

  it("for langsomme trykk teller ikke", () => {
    const veksle = vi.fn();
    const trykk = lagDiagHemmeligTrykk(veksle);
    for (let i = 0; i < 5; i++) trykk(10, 10, i * (DIAG_VINDU_MS / 2));
    expect(veksle).not.toHaveBeenCalled();
  });
});
