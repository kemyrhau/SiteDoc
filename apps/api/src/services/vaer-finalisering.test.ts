import { describe, it, expect, vi } from "vitest";
import type { VaerHourly } from "@sitedoc/shared";
import { resolverVentendeVaer, vaerFeltIder } from "./vaer-finalisering";

/**
 * Rent lag — vær-resolve ved finalisering (funn d). Ingen DB: hentingen injiseres,
 * så vi tester at ventende markører løses for det LAGREDE tidspunktet, at feil gir
 * permanent «ikke_registrert», og at ikke-ventende felt står urørt.
 */

// 24-timers serie for 2026-08-14. Timen nærmest kl. 07 (index 7) bærer snapshotet.
function byggHourly(): VaerHourly {
  const time = Array.from({ length: 24 }, (_, i) => `2026-08-14T${String(i).padStart(2, "0")}:00`);
  const temperature_2m = time.map((_, i) => (i === 7 ? 4 : 10));
  const weather_code = time.map((_, i) => (i === 7 ? 61 : 0)); // 61 = Lett regn
  const wind_speed_10m = time.map((_, i) => (i === 7 ? 6 : 1));
  const precipitation = time.map(() => 0.05); // sum 1.2 mm
  return { time, temperature_2m, weather_code, wind_speed_10m, precipitation };
}

const VAER_OBJ = [{ id: "v1", type: "weather" }, { id: "t1", type: "text" }];

function venterFelt(tidspunkt = "2026-08-14T07:12", ekstra: Record<string, unknown> = {}) {
  return {
    verdi: { kilde: "automatisk", status: "venter", venterTidspunkt: tidspunkt, lat: 70.0, lng: 24.9 },
    kommentar: "notat",
    vedlegg: [{ id: "a1" }],
    ...ekstra,
  };
}

describe("resolverVentendeVaer", () => {
  it("returnerer null når malen ikke har værfelt", async () => {
    const hent = vi.fn();
    const ut = await resolverVentendeVaer({ t1: { verdi: "x" } }, [{ id: "t1", type: "text" }], hent);
    expect(ut).toBeNull();
    expect(hent).not.toHaveBeenCalled();
  });

  it("returnerer null når værfeltet ikke er i venter-tilstand", async () => {
    const hent = vi.fn();
    const data = { v1: { verdi: { kilde: "automatisk", temp: "4°C" } } };
    expect(await resolverVentendeVaer(data, VAER_OBJ, hent)).toBeNull();
    expect(hent).not.toHaveBeenCalled();
  });

  it("løser ventende felt for det LAGREDE tidspunktet, merker hentetIEttertid", async () => {
    const hent = vi.fn().mockResolvedValue(byggHourly());
    const data = { v1: venterFelt("2026-08-14T07:12"), t1: { verdi: "urørt" } };

    const ut = await resolverVentendeVaer(data, VAER_OBJ, hent);

    // Hentet for befaringsdatoen, ikke «i dag»
    expect(hent).toHaveBeenCalledWith(70.0, 24.9, "2026-08-14");
    expect(ut).not.toBeNull();
    expect(ut!.v1!.verdi).toEqual({
      temp: "4°C",
      conditions: "Lett regn",
      wind: "6 m/s",
      precipitation: "1.2 mm",
      kilde: "automatisk",
      hentetIEttertid: true,
    });
    // Kommentar/vedlegg bevart, markør-feltene borte
    expect(ut!.v1!.kommentar).toBe("notat");
    expect(ut!.v1!.vedlegg).toEqual([{ id: "a1" }]);
    // Ikke-værfelt urørt
    expect(ut!.t1!).toEqual({ verdi: "urørt" });
  });

  it("feilet henting → status ikke_registrert, permanent (ingen temp/hentetIEttertid)", async () => {
    const hent = vi.fn().mockResolvedValue(null);
    const data = { v1: venterFelt() };

    const ut = await resolverVentendeVaer(data, VAER_OBJ, hent);

    expect(ut).not.toBeNull();
    expect(ut!.v1!.verdi).toEqual({ kilde: "automatisk", status: "ikke_registrert" });
    expect(ut!.v1!.kommentar).toBe("notat");
  });

  it("rører aldri manuell verdi selv om den ser ventende ut", async () => {
    const hent = vi.fn();
    const data = { v1: venterFelt("2026-08-14T07:12", { verdi: { kilde: "manuell", status: "venter", venterTidspunkt: "2026-08-14T07:12", lat: 70, lng: 24.9 } }) };
    expect(await resolverVentendeVaer(data, VAER_OBJ, hent)).toBeNull();
    expect(hent).not.toHaveBeenCalled();
  });

  it("løser flere værfelt i samme dokument", async () => {
    const hent = vi.fn().mockResolvedValue(byggHourly());
    const objs = [{ id: "v1", type: "weather" }, { id: "v2", type: "weather" }];
    const data = { v1: venterFelt(), v2: venterFelt("2026-08-14T07:00") };
    const ut = await resolverVentendeVaer(data, objs, hent);
    expect(hent).toHaveBeenCalledTimes(2);
    expect((ut!.v1!.verdi as { hentetIEttertid?: boolean }).hentetIEttertid).toBe(true);
    expect((ut!.v2!.verdi as { hentetIEttertid?: boolean }).hentetIEttertid).toBe(true);
  });
});

describe("vaerFeltIder", () => {
  it("plukker kun weather-typede objekt-id-er", () => {
    const ider = vaerFeltIder([
      { id: "v1", type: "weather" },
      { id: "t1", type: "text" },
      { id: "v2", type: "weather" },
    ]);
    expect([...ider].sort()).toEqual(["v1", "v2"]);
  });
});
