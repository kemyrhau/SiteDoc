import { describe, it, expect } from "vitest";
import { beregnSignaturStatus, delSignertManko } from "./signaturliste";

describe("beregnSignaturStatus", () => {
  it("gir ingen_runde når objektet ikke er tatt i bruk", () => {
    expect(beregnSignaturStatus(null, 5)).toEqual({
      rundeNr: null,
      signert: 0,
      av: 0,
      signertFørEndring: 0,
      status: "ingen_runde",
    });
  });

  it("åpen runde teller Y = aktive deltakere nå, ikke frosset", () => {
    const r = beregnSignaturStatus(
      { rundeNr: 3, avsluttet: false, antallSignert: 4, antallDeltakere: null },
      6,
    );
    expect(r).toEqual({ rundeNr: 3, signert: 4, av: 6, signertFørEndring: 0, status: "mangler" });
  });

  it("åpen runde blir komplett når alle aktive har signert", () => {
    const r = beregnSignaturStatus(
      { rundeNr: 1, avsluttet: false, antallSignert: 6, antallDeltakere: null },
      6,
    );
    expect(r.status).toBe("komplett");
  });

  it("avsluttet runde leser frosset antall — drifter ikke om deltaker fjernes etterpå", () => {
    // Frosset til 6 ved avslutt; senere fjernet én → aktive = 5. Y skal fortsatt være 6.
    const r = beregnSignaturStatus(
      { rundeNr: 2, avsluttet: true, antallSignert: 6, antallDeltakere: 6 },
      5,
    );
    expect(r).toEqual({ rundeNr: 2, signert: 6, av: 6, signertFørEndring: 0, status: "komplett" });
  });

  it("0 deltakere gir mangler, ikke komplett", () => {
    const r = beregnSignaturStatus(
      { rundeNr: 1, avsluttet: false, antallSignert: 0, antallDeltakere: null },
      0,
    );
    expect(r.status).toBe("mangler");
  });

  it("signertFørEndring bæres gjennom — komplett runde kan ha stale signaturer", () => {
    // Alle 4 har signert (komplett), men 2 signerte før en senere innholdsendring.
    // Telleren forblir komplett (invalidering er menneskets kall); amber drives av tallet.
    const r = beregnSignaturStatus(
      { rundeNr: 2, avsluttet: false, antallSignert: 4, antallSignertFørEndring: 2, antallDeltakere: null },
      4,
    );
    expect(r).toEqual({ rundeNr: 2, signert: 4, av: 4, signertFørEndring: 2, status: "komplett" });
  });

  it("uten antallSignertFørEndring er feltet 0 (bakoverkompatibelt)", () => {
    const r = beregnSignaturStatus(
      { rundeNr: 1, avsluttet: false, antallSignert: 2, antallDeltakere: null },
      3,
    );
    expect(r.signertFørEndring).toBe(0);
  });
});

describe("delSignertManko", () => {
  it("deler i signert/manko og bevarer rekkefølge", () => {
    const deltakere = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const { signert, manko } = delSignertManko(deltakere, new Set(["b", "d"]));
    expect(signert.map((d) => d.id)).toEqual(["b", "d"]);
    expect(manko.map((d) => d.id)).toEqual(["a", "c"]);
  });
});
