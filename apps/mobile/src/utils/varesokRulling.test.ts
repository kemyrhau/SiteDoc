import { describe, it, expect } from "vitest";
import { lagVaresokFokus, varesokRullMal } from "./varesokRulling";

// ORDRE 37 — varesøket ruller «Vare»-blokka til toppen når tastaturet er oppe.

describe("varesokRullMal", () => {
  it("kortets y + blokkas y − marg", () => {
    expect(varesokRullMal({ kortY: 120, feltY: 260, marg: 12 })).toBe(368);
  });

  it("margen respekteres (blokka står litt under toppen, ikke klistret)", () => {
    expect(varesokRullMal({ kortY: 100, feltY: 50, marg: 0 })).toBe(150);
    expect(varesokRullMal({ kortY: 100, feltY: 50, marg: 20 })).toBe(130);
  });

  it("klemmes mot 0 — ruller aldri over toppen", () => {
    expect(varesokRullMal({ kortY: 0, feltY: 5, marg: 12 })).toBe(0);
  });
});

function oppsett(synlig: boolean) {
  const lyttere: Array<{ fn: () => void; fjernet: boolean }> = [];
  let rullinger = 0;
  let tastatur = synlig;
  const fokus = lagVaresokFokus({
    tastaturSynlig: () => tastatur,
    lyttVist: (fn) => {
      const l = { fn, fjernet: false };
      lyttere.push(l);
      return { remove: () => (l.fjernet = true) };
    },
    rull: () => {
      rullinger++;
    },
  });
  const aktive = () => lyttere.filter((l) => !l.fjernet);
  const visTastatur = () => {
    tastatur = true;
    aktive().forEach((l) => l.fn());
  };
  return { fokus, lyttere, aktive, visTastatur, rullinger: () => rullinger };
}

describe("lagVaresokFokus", () => {
  it("tastaturet nede ved fokus: ruller først når keyboardDidShow kommer", () => {
    const o = oppsett(false);
    o.fokus.onFocus();
    expect(o.rullinger()).toBe(0);
    o.visTastatur();
    expect(o.rullinger()).toBe(1);
  });

  it("feltet får fokus med tastaturet allerede oppe (hold åpen / fra antall): ruller med en gang", () => {
    const o = oppsett(true);
    o.fokus.onFocus();
    expect(o.rullinger()).toBe(1);
  });

  it("blur fjerner lytteren — ingen rulling når antall-feltet får tastaturet", () => {
    const o = oppsett(false);
    o.fokus.onFocus();
    o.fokus.onBlur();
    expect(o.aktive()).toHaveLength(0);
    o.visTastatur();
    expect(o.rullinger()).toBe(0);
  });

  it("rydd (unmount) fjerner lytteren", () => {
    const o = oppsett(false);
    o.fokus.onFocus();
    o.fokus.rydd();
    expect(o.lyttere).toHaveLength(1);
    expect(o.aktive()).toHaveLength(0);
  });

  it("fokus to ganger uten blur gir aldri mer enn én aktiv lytter", () => {
    const o = oppsett(false);
    o.fokus.onFocus();
    o.fokus.onFocus();
    expect(o.lyttere).toHaveLength(2);
    expect(o.aktive()).toHaveLength(1);
  });

  it("negativkontroll: uten fokus skjer ingenting", () => {
    const o = oppsett(true);
    o.visTastatur();
    expect(o.lyttere).toHaveLength(0);
    expect(o.rullinger()).toBe(0);
  });
});
