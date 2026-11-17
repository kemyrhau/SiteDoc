import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Gate (85) M4 — treffer raycasten objekter skjult med setVisible(false)?
 *
 * Målt 2026-11-17 i fragments-workeren vieweren laster (`/fragments-worker.mjs`, kopi av
 * @thatopen/fragments 3.3.6 `dist/Worker/worker.mjs`): nei. Raycasten kaster mot boksene og
 * filtrerer på item-synlighet (`castBox` → `filterVisible` → `_items.visible`), og `_items` er
 * modellens `itemConfig` — det samme flagget `setVisible` skriver (`getSetEvent` →
 * `itemConfig.setVisible`). Rom/åpninger, utliggere og filter-skjulte objekter treffes derfor
 * ikke av objektvalg, orbit-punkt eller zoom-avstand, på web og i mobil-viewer.
 *
 * Vakten feiler hvis workeren byttes (ny fragments-versjon) uten at dette er målt på nytt.
 */
const worker = readFileSync(resolve(__dirname, "../../../public/fragments-worker.mjs"), "utf8");

describe("fragments-raycast hopper over skjulte objekter", () => {
  it("raycast kaster mot boksene og filtrerer på synlighet", () => {
    expect(worker).toContain("raycast(t,e,s,i){const r={ray:t,frustum:e,planes:s,returnAll:i},n=this.castBox(e,s);");
    expect(worker).toContain("const i=s.collideRay(e,t);return this.filterVisible(i)");
    expect(worker).toContain("this._items.visible(t)&&e.push(s)");
  });

  it("synligheten raycasten leser er den setVisible skriver (itemConfig)", () => {
    expect(worker).toContain("new jp(this.data,this.boxes,this.tiles,this.itemConfig)");
    expect(worker).toContain("this._boxes=e,this._tiles=s,this._items=i");
    expect(worker).toContain("getSetEvent(t,e){return s=>{t.itemConfig.setVisible(s,e)}}");
  });

  it("workeren vieweren laster er den publiserte fragments-workeren", () => {
    const kontekst = readFileSync(resolve(__dirname, "../../kontekst/tred-viewer-kontekst.tsx"), "utf8");
    expect(kontekst).toContain('fragmentsManager.init("/fragments-worker.mjs");');
  });
});
