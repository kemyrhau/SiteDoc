import { describe, it, expect } from "vitest";
import { beregnSignaturStatus, delSignertManko } from "./signaturliste";

describe("beregnSignaturStatus", () => {
  it("gir ingen_runde når objektet ikke er tatt i bruk", () => {
    expect(beregnSignaturStatus(null, 5)).toEqual({
      rundeNr: null,
      signert: 0,
      bekreftet: 0,
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
    expect(r).toEqual({ rundeNr: 3, signert: 4, bekreftet: 0, av: 6, signertFørEndring: 0, status: "mangler" });
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
    expect(r).toEqual({ rundeNr: 2, signert: 6, bekreftet: 0, av: 6, signertFørEndring: 0, status: "komplett" });
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
    expect(r).toEqual({ rundeNr: 2, signert: 4, bekreftet: 0, av: 4, signertFørEndring: 2, status: "komplett" });
  });

  it("uten antallSignertFørEndring er feltet 0 (bakoverkompatibelt)", () => {
    const r = beregnSignaturStatus(
      { rundeNr: 1, avsluttet: false, antallSignert: 2, antallDeltakere: null },
      3,
    );
    expect(r.signertFørEndring).toBe(0);
  });

  it("dekning = signert + bekreftet; de holdes fra hverandre men komplett teller begge", () => {
    // 5 signerte selv, 2 ble bekreftet av ansvarlig → full dekning av 7, men
    // signert og bekreftet returneres separat (dokumentet blander dem aldri).
    const r = beregnSignaturStatus(
      { rundeNr: 1, avsluttet: false, antallSignert: 5, antallBekreftet: 2, antallDeltakere: null },
      7,
    );
    expect(r).toEqual({ rundeNr: 1, signert: 5, bekreftet: 2, av: 7, signertFørEndring: 0, status: "komplett" });
  });

  it("bekreftet alene dekker ikke om signert+bekreftet < av", () => {
    const r = beregnSignaturStatus(
      { rundeNr: 1, avsluttet: false, antallSignert: 3, antallBekreftet: 1, antallDeltakere: null },
      6,
    );
    expect(r).toMatchObject({ signert: 3, bekreftet: 1, av: 6, status: "mangler" });
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
