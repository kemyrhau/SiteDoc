import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// Spec tillegg-utlegg-prosjektkort (B7): `redigerSedelRader` setter tilleggets
// byggeplass og underprosjekt til `?? null` når feltene mangler i payloaden. Hver
// web-flate som sender sedelen tilbake, må derfor bære feltene videre — ellers nuller
// attestantens redigering kortplasseringen stille. Vakten låser tillegg-payloaden.

function les(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf-8");
}

/** Tekstblokken `tillegg: X.map((r) => ({ ... }))` i lagre-payloaden. */
export function tilleggPayload(kilde: string): string {
  return kilde.match(/tillegg: \w+\.map\(\(r\) => \(\{[\s\S]*?\}\)\),/)?.[0] ?? "";
}

export function manglerSted(kilde: string): string[] {
  const blokk = tilleggPayload(kilde);
  if (!blokk) return ["tillegg-payload ikke funnet"];
  return ["byggeplassId", "externalCostObjectId"].filter((f) => !blokk.includes(`${f}:`));
}

const FLATER = [
  "../components/attestering/RedigerRadModal.tsx",
  "../components/timer/AttesteringDetalj_Edit.tsx",
] as const;

describe("tillegg beholder byggeplass og underprosjekt gjennom redigering", () => {
  for (const fil of FLATER) {
    it(`${fil} sender feltene videre`, () => {
      expect(manglerSted(les(fil))).toEqual([]);
    });
  }

  it("negativkontroll: vakten biter når feltet fjernes", () => {
    const kilde = les(FLATER[0]).replace(/\n\s*externalCostObjectId: r\.externalCostObjectId \?\? null,/, "");
    expect(manglerSted(kilde)).toContain("externalCostObjectId");
  });
});
