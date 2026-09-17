import { describe, it, expect } from "vitest";
import {
  serviceVarselNiva,
  SERVICE_SNART_TIMER,
  SERVICE_PLANLAGT_TIMER,
} from "../service-varsel-niva";

describe("serviceVarselNiva (maskin-detalj banner, del D)", () => {
  it("ingen når terskel eller driftstimer mangler", () => {
    expect(serviceVarselNiva(1000, null).niva).toBe("ingen");
    expect(serviceVarselNiva(null, 1250).niva).toBe("ingen");
  });

  it("forfalt når driftstimer har passert terskelen", () => {
    const r = serviceVarselNiva(1300, 1250);
    expect(r.niva).toBe("forfalt");
    expect(r.timerIgjen).toBe(-50);
  });

  it("snart rett under snart-terskelen", () => {
    expect(serviceVarselNiva(1250 - (SERVICE_SNART_TIMER - 1), 1250).niva).toBe("snart");
  });

  it("planlagt mellom snart og planlagt", () => {
    expect(
      serviceVarselNiva(1250 - (SERVICE_PLANLAGT_TIMER - 1), 1250).niva,
    ).toBe("planlagt");
  });

  it("ok med god margin", () => {
    expect(serviceVarselNiva(500, 1250).niva).toBe("ok");
  });

  it("grenseverdi: nøyaktig på terskelen (0 igjen) er snart, ikke forfalt", () => {
    expect(serviceVarselNiva(1250, 1250).niva).toBe("snart");
  });
});
