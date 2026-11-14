import { describe, it, expect } from "vitest";
import {
  løsReiseKnappLonnsart,
  arbeidUtenReise,
  arbeidOgReise,
  sendDagenTekst,
} from "./reiseSkille";
import { overstigerMaskinTak } from "./maskinKapasitet";
import { sumlinjeMotNorm, dagSummer } from "./prosjektkort";

const ord = (id: string, navn: string, aktiv = true, type = "ordinaer") => ({ id, navn, type, aktiv });

describe("løsReiseKnappLonnsart", () => {
  const arter = [ord("a", "Ordinær"), ord("r", "Reisetid"), ord("t", "Transport", true, "fravaer")];

  it("eksplisitt valg vinner", () => {
    expect(løsReiseKnappLonnsart("a", arter)).toEqual({ status: "valgt", lonnsartId: "a" });
  });
  it("én aktiv ordinær match → automatisk", () => {
    expect(løsReiseKnappLonnsart(null, arter)).toEqual({ status: "automatisk", lonnsartId: "r" });
  });
  it("0 treff → ingen (fravær og inaktiv teller ikke)", () => {
    expect(løsReiseKnappLonnsart(null, [ord("a", "Ordinær"), ord("r", "Reise", false)])).toEqual({ status: "ingen" });
  });
  it("≥ 2 treff uten valg → flere", () => {
    expect(løsReiseKnappLonnsart(null, [ord("r1", "Reise"), ord("r2", "Transport")])).toEqual({
      status: "flere",
      kandidater: ["r1", "r2"],
    });
  });
  it("≥ 2 treff med eksplisitt valg → valgt", () => {
    expect(løsReiseKnappLonnsart("r2", [ord("r1", "Reise"), ord("r2", "Transport")])).toEqual({
      status: "valgt",
      lonnsartId: "r2",
    });
  });
  it("deaktivert eksplisitt valg skjuler knappen (speiler serveren, ingen navne-fallback)", () => {
    expect(løsReiseKnappLonnsart("x", [ord("x", "Valgt", false), ord("r", "Reise")])).toEqual({
      status: "ingen",
    });
  });
});

describe("maskin-kontrollen måles mot arbeid uten reise", () => {
  const rader = [
    { timer: 7.5, erReise: false, attestertStatus: null },
    { timer: 2, erReise: true, attestertStatus: null },
    { timer: 3, erReise: false, attestertStatus: "erstattet" },
  ];
  it("reise og erstattede teller ikke", () => {
    expect(arbeidUtenReise(rader)).toBe(7.5);
    expect(arbeidOgReise(rader)).toEqual({ arbeid: 7.5, reise: 2 });
  });
  it("maskin 9 t over 7,5 t arbeid er brudd selv med 2 t reise", () => {
    expect(overstigerMaskinTak(9, arbeidUtenReise(rader))).toBe(true);
    expect(overstigerMaskinTak(7.5, arbeidUtenReise(rader))).toBe(false);
  });
});

describe("sendDagenTekst", () => {
  it("med reise", () => {
    expect(sendDagenTekst("draft", 7.5, 2)).toEqual({
      nokkel: "timer.prosjektkort.sendDagenMedReise",
      timer: 7.5,
      reise: 2,
    });
  });
  it("uten reise", () => {
    expect(sendDagenTekst("draft", 7.5, 0)).toEqual({ nokkel: "timer.prosjektkort.sendDagen", timer: 7.5 });
  });
  it("returnert → send på nytt", () => {
    expect(sendDagenTekst("returned", 7.5, 2)).toEqual({ nokkel: "timer.detalj.sendPaaNytt" });
  });
});

describe("vakt: eksempel 1 — 7,5 t arbeid + 2 t reise", () => {
  const timer = [
    { projectId: "p", byggeplassId: null, timer: 7.5, erReise: false, attestertStatus: null },
    { projectId: "p", byggeplassId: null, timer: 2, erReise: true, attestertStatus: null },
  ];
  it("header 7,5 t, reise 2 t, knapp (7,5 t · reise 2 t)", () => {
    expect(arbeidUtenReise(timer)).toBe(7.5);
    expect(sumlinjeMotNorm(timer, 7.5).registrert).toBe(7.5);
    const { reise } = dagSummer(timer, []);
    expect(reise).toBe(2);
    expect(sendDagenTekst("draft", arbeidUtenReise(timer), reise)).toEqual({
      nokkel: "timer.prosjektkort.sendDagenMedReise",
      timer: 7.5,
      reise: 2,
    });
  });
});
