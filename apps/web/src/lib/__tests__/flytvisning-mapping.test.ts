import { describe, it, expect } from "vitest";
import {
  FLYTVISNING_BOKS_DEF,
  FLYTVISNING_ADMIN_SONE,
  finnRad,
  celleTilstand,
  SENTINEL_FRA,
  SENTINEL_TIL,
  type FlytEntry,
} from "@/lib/flytmatrise-def";
import { PROSJEKTADMIN_ROLLE, flytRettighetNoekkel } from "@sitedoc/shared";

/**
 * Flytvisning-fanen er en REN PROJEKSJON over de samme cellene som matrise-fanen. Testene her
 * verifiserer at projeksjonen ikke drifter fra den delte def-en (hver celle finnes som rad),
 * at de to fabel-korreksjonene (Gjenåpne begge steder · Slett kladd begge bokser, ingen
 * slett-endelig) holder, og at videresend er låst for flyt-roller men på for prosjektadmin.
 */

/** Alle celle-entries på tvers av bokser + admin-sone (fantomer ekskludert). */
const alleCeller = [
  ...FLYTVISNING_BOKS_DEF.flatMap((b) => [
    ...Object.values(b.grupper).flat(),
    b.videresendLaast,
  ]),
  ...FLYTVISNING_ADMIN_SONE.flatMap((g) => g.celler),
].filter((e): e is Extract<FlytEntry, { type: "celle" }> => e.type === "celle");

describe("flytvisning — ren projeksjon over den delte def-en", () => {
  it("hver celle-entry svarer til en faktisk matriserad (etikett resolverer, ingen drift)", () => {
    for (const { fra, til } of alleCeller) {
      expect(finnRad(fra, til), `mangler rad for ${fra}→${til}`).toBeDefined();
    }
  });

  it("bruker samme celleTilstand som matrise-fanen — override reflekteres i begge (én kilde)", () => {
    // Utfører-cellen Besvar (received→responded) er PÅ som standard; en negativ override slår den av.
    const rolle = "utforer";
    const [fra, til] = ["received", "responded"];
    expect(celleTilstand(rolle, fra, til, {})).toBe("standard-pa");
    const off = { [flytRettighetNoekkel(rolle, fra, til)]: false };
    expect(celleTilstand(rolle, fra, til, off)).toBe("overstyrt-av");
  });
});

describe("flytvisning — korreksjon (a): Gjenåpne begge steder, distinkte celler", () => {
  const gjenapneFra = ["closed", "dismissed", "cancelled", "approved"];

  it("registrator-gjenåpne vises i Registrator-boksen (LOKALT)", () => {
    const reg = FLYTVISNING_BOKS_DEF.find((b) => b.boks === "registrator")!;
    const lokalt = (reg.grupper.lokalt ?? []).filter((e) => e.type === "celle");
    for (const fra of gjenapneFra) {
      expect(lokalt.some((e) => e.type === "celle" && e.rolle === "registrator" && e.fra === fra && e.til === "draft")).toBe(true);
    }
  });

  it("prosjektadmin-gjenåpne vises i admin-sonen (egen celle, ikke admin-only)", () => {
    const gjenapne = FLYTVISNING_ADMIN_SONE.find((g) => g.labelNoekkel === "flytvisning.admin.gjenapne")!;
    for (const fra of gjenapneFra) {
      expect(gjenapne.celler.some((e) => e.rolle === PROSJEKTADMIN_ROLLE && e.fra === fra && e.til === "draft")).toBe(true);
      // Redigerbar (ikke låst) for prosjektadmin.
      expect(celleTilstand(PROSJEKTADMIN_ROLLE, fra, "draft", {})).not.toBe("laast");
    }
  });
});

describe("flytvisning — korreksjon (b): Slett kladd begge bokser, ingen Slett endelig", () => {
  it("draft→deleted (Slett kladd) finnes for både registrator og bestiller", () => {
    for (const boks of ["registrator", "bestiller"] as const) {
      const def = FLYTVISNING_BOKS_DEF.find((b) => b.boks === boks)!;
      const lokalt = (def.grupper.lokalt ?? []).filter((e) => e.type === "celle");
      expect(lokalt.some((e) => e.type === "celle" && e.fra === "draft" && e.til === "deleted")).toBe(true);
    }
  });

  it("«Slett endelig» (slett_endelig / papirkurv-pseudo) er IKKE en celle i fanen", () => {
    expect(alleCeller.some((e) => e.til === "slett_endelig" || e.til === "gjenopprett" || e.fra === "slettet")).toBe(false);
  });
});

describe("flytvisning — videresend admin-only (H3)", () => {
  it("videresend-chip er låst i hver flyt-rolle-boks", () => {
    for (const b of FLYTVISNING_BOKS_DEF) {
      const { rolle, fra, til } = b.videresendLaast;
      expect(til).toBe("forwarded");
      expect(celleTilstand(rolle, fra, til, {})).toBe("laast");
    }
  });

  it("admin-sonens videresend-celler er PÅ (ikke låst)", () => {
    const videresend = FLYTVISNING_ADMIN_SONE.find((g) => g.labelNoekkel === "flytvisning.admin.videresend")!;
    for (const { rolle, fra, til } of videresend.celler) {
      expect(til).toBe("forwarded");
      expect(celleTilstand(rolle, fra, til, {})).toBe("standard-pa");
    }
  });
});

describe("flytvisning — Opprett-cellen er lov-låst i Registrator-boksen", () => {
  it("registrator nytt→opprett rendres låst (kode-tilstand)", () => {
    expect(celleTilstand("registrator", SENTINEL_FRA, SENTINEL_TIL, {})).toBe("laast");
  });
});
