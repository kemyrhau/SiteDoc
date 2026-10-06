import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { timerStatusEtikett } from "./timerStatus";

// nb-verdiene brukes til å bevise at sedel og rad viser SAMME ord for samme
// tilstand (worker ↔ attestant), og at «Godkjent» er borte.
const nb = JSON.parse(
  readFileSync(new URL("../i18n/nb.json", import.meta.url), "utf-8"),
) as Record<string, string>;

describe("timerStatusEtikett — delt kilde for farge OG ord (Del 7)", () => {
  // Gate 1: status × nivå. Web OG mobil kaller DENNE funksjonen, så samme
  // status gir per definisjon samme variant + etikettKey på begge flater.
  const forventet: Array<[string, string, string]> = [
    // status, variant, etikettKey
    ["draft", "default", "timer.statusType.draft"],
    ["sent", "primary", "timer.statusType.sent"],
    ["returned", "danger", "timer.statusType.returned"],
    ["accepted", "success", "timer.statusType.accepted"],
    ["pending", "default", "timer.attestering.radStatus.pending"],
    ["attestert", "success", "timer.attestering.radStatus.attestert"],
    ["returnert", "danger", "timer.attestering.radStatus.returnert"],
  ];

  it.each(forventet)("%s → variant + etikettKey", (status, variant, key) => {
    const e = timerStatusEtikett(status);
    expect(e.variant).toBe(variant);
    expect(e.etikettKey).toBe(key);
  });

  it("ukjent status → default + rå streng (skjul aldri en verdi)", () => {
    expect(timerStatusEtikett("erstattet")).toEqual({
      variant: "default",
      etikettKey: "erstattet",
    });
  });

  // Konsistens på tvers av NIVÅ: sedel «accepted» og rad «attestert» er samme
  // tilstand → samme farge OG samme ord. Samme for returned/returnert.
  it("accepted (sedel) og attestert (rad): samme farge og samme ord", () => {
    const sedel = timerStatusEtikett("accepted");
    const rad = timerStatusEtikett("attestert");
    expect(sedel.variant).toBe("success");
    expect(rad.variant).toBe("success");
    expect(nb[sedel.etikettKey]).toBe("Attestert");
    expect(nb[rad.etikettKey]).toBe("Attestert");
  });

  it("returned (sedel) og returnert (rad): samme farge og samme ord", () => {
    const sedel = timerStatusEtikett("returned");
    const rad = timerStatusEtikett("returnert");
    expect(sedel.variant).toBe("danger");
    expect(rad.variant).toBe("danger");
    expect(nb[sedel.etikettKey]).toBe("Returnert");
    expect(nb[rad.etikettKey]).toBe("Returnert");
  });

  // Funn 2: «Attestering ≠ Godkjenning». «Godkjent» skal være borte fra
  // timer-statusen på begge navnerom.
  it("timer-statusen sier «Attestert», ikke «Godkjent»", () => {
    expect(nb["timer.statusType.accepted"]).toBe("Attestert");
    expect(nb["timer.statusType.accepted"]).not.toBe("Godkjent");
  });

  // Funn 3: retur har ÉN farge (danger) — ikke amber på sedel, rød på rad.
  it("retur er danger på begge nivåer (ikke to farger)", () => {
    expect(timerStatusEtikett("returned").variant).toBe("danger");
    expect(timerStatusEtikett("returnert").variant).toBe("danger");
  });
});
