import { describe, it, expect } from "vitest";
import {
  beregnNesteService,
  beregnServiceVarsel,
  SERVICE_VARSEL_SNART_TIMER,
  SERVICE_VARSEL_PLANLAGT_TIMER,
} from "./service-varsel";

describe("beregnNesteService (fremskriving, del C)", () => {
  it("legger intervall til driftstimer ved service", () => {
    expect(beregnNesteService(1000, 250)).toBe(1250);
  });

  it("returnerer null når intervall mangler — ingen automatikk uten intervall", () => {
    expect(beregnNesteService(1000, null)).toBeNull();
    expect(beregnNesteService(1000, undefined)).toBeNull();
  });

  it("returnerer null ved meningsløst intervall (0/negativt)", () => {
    expect(beregnNesteService(1000, 0)).toBeNull();
    expect(beregnNesteService(1000, -50)).toBeNull();
  });
});

describe("beregnServiceVarsel (terskel, del D)", () => {
  it("null uten grunnlag (mangler terskel eller driftstimer)", () => {
    expect(beregnServiceVarsel(1000, null)).toBeNull();
    expect(beregnServiceVarsel(null, 1250)).toBeNull();
  });

  it("forfalt når driftstimer har passert terskelen", () => {
    const v = beregnServiceVarsel(1300, 1250);
    expect(v?.status).toBe("forfalt");
    expect(v?.timerIgjen).toBe(-50);
  });

  it("snart når mindre enn snart-terskelen igjen", () => {
    const v = beregnServiceVarsel(1250 - (SERVICE_VARSEL_SNART_TIMER - 1), 1250);
    expect(v?.status).toBe("snart");
  });

  it("planlagt mellom snart- og planlagt-terskelen", () => {
    const v = beregnServiceVarsel(1250 - (SERVICE_VARSEL_PLANLAGT_TIMER - 1), 1250);
    expect(v?.status).toBe("planlagt");
  });

  it("ok når det er god margin igjen", () => {
    const v = beregnServiceVarsel(500, 1250);
    expect(v?.status).toBe("ok");
    expect(v?.timerIgjen).toBe(750);
  });
});
