import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Vakt (ota-varsel RETUR 1): `MedOtaLinje` nuller bunnen i `SafeAreaInsetsContext`
 * mens «Ny versjon er klar»-linja vises, og konteksten går gjennom RN-`<Modal>`.
 * Modalinnhold må derfor lese `useModalInnsetter()` (rå innsetter), aldri
 * `useSafeAreaInsets()` direkte. Ren kildeskanning — ingen RN-render.
 */
const ROT = join(__dirname, "..", "..");
const DIRS = ["app", "src"].map((d) => join(ROT, d));
// Rendres kun inne i en <Modal> hos kallerne (ModalFlate-brukere, KameraModal, FeltDokumentasjon).
const MODALINNHOLD = ["src/components/ModalFlate.tsx", "src/components/BildeAnnotering.tsx"];

// Kommentarer nevner `<Modal>` (bl.a. OtaLinje/ModalInnsetter) — skann kun kode.
function utenKommentarer(kilde: string): string {
  return kilde.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function filer(dir: string): string[] {
  return readdirSync(dir).flatMap((navn) => {
    const sti = join(dir, navn);
    if (statSync(sti).isDirectory()) return filer(sti);
    return /\.tsx?$/.test(navn) && !/\.test\.tsx?$/.test(navn) ? [sti] : [];
  });
}

describe("modal-innsetter-vakt", () => {
  it("ingen modalinnhold leser useSafeAreaInsets() direkte", () => {
    const brudd = DIRS.flatMap(filer)
      .map((sti) => ({ rel: relative(ROT, sti), kilde: utenKommentarer(readFileSync(sti, "utf8")) }))
      .filter(({ rel, kilde }) => /<Modal[\s>]/.test(kilde) || MODALINNHOLD.includes(rel))
      .filter(({ kilde }) => /useSafeAreaInsets\(\)\s*;/.test(kilde))
      .map(({ rel }) => rel);
    expect(brudd).toEqual([]);
  });

  it("MedOtaLinje gir de rå innsetterne til modalkonteksten, over overstyringen", () => {
    const kilde = readFileSync(join(ROT, "src/components/OtaLinje.tsx"), "utf8");
    const modal = kilde.indexOf("<ModalInnsetterKontekst.Provider value={modal}>");
    const navigator = kilde.indexOf("<SafeAreaInsetsContext.Provider value={navigator}>");
    expect(modal).toBeGreaterThan(-1);
    expect(navigator).toBeGreaterThan(modal);
  });

  it("modalleserne bruker useModalInnsetter()", () => {
    for (const rel of [
      ...MODALINNHOLD,
      "src/components/KameraModal.tsx",
      "src/components/rapportobjekter/TegningPosisjonObjekt.tsx",
    ]) {
      expect(readFileSync(join(ROT, rel), "utf8"), rel).toContain("useModalInnsetter()");
    }
  });
});
