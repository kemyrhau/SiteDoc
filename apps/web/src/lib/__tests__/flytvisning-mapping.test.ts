import { describe, it, expect } from "vitest";
import {
  FLYTVISNING_BOKS_DEF,
  FLYTVISNING_ADMIN_SONE,
  finnRad,
  celleTilstand,
  handlingLabelNoekkel,
  SENTINEL_FRA,
  SENTINEL_TIL,
  type FlytHandling,
  type FlytOppslag,
} from "@/lib/flytmatrise-def";
import { PROSJEKTADMIN_ROLLE, flytRettighetNoekkel } from "@sitedoc/shared";

/**
 * Flytvisning-fanen er en REN PROJEKSJON over de samme cellene som matrise-fanen. Testene her
 * verifiserer at projeksjonen ikke drifter fra den delte def-en (hver celle finnes som rad),
 * at de to fabel-korreksjonene (Gjenåpne begge steder · Slett kladd begge bokser, ingen
 * slett-endelig) holder, at videresend er låst for flyt-roller men på for prosjektadmin, og at
 * Avvik-1-grupperingen (én rad per handling, fra-statuser som delceller) er intakt.
 */

/** Alle delceller på tvers av handlinger (fantomer ekskludert). */
function handlingerCeller(hs: FlytHandling[]): FlytOppslag[] {
  return hs.flatMap((hd) => (hd.type === "handling" ? hd.celler : []));
}
const alleCeller: FlytOppslag[] = [
  ...FLYTVISNING_BOKS_DEF.flatMap((b) => [
    ...Object.values(b.grupper).flatMap((hs) => handlingerCeller(hs ?? [])),
    b.videresendLaast,
  ]),
  ...FLYTVISNING_ADMIN_SONE.flatMap((g) => handlingerCeller(g.handlinger)),
];

describe("flytvisning — ren projeksjon over den delte def-en", () => {
  it("hver delcelle svarer til en faktisk matriserad (etikett resolverer, ingen drift)", () => {
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

describe("flytvisning — Avvik 1: gruppering til én rad med delceller", () => {
  it("Registrator-gjenåpne er ÉN handling med fire delceller (ikke fire like rader)", () => {
    const reg = FLYTVISNING_BOKS_DEF.find((b) => b.boks === "registrator")!;
    const gjenapne = (reg.grupper.lokalt ?? []).filter(
      (hd): hd is Extract<FlytHandling, { type: "handling" }> =>
        hd.type === "handling" && finnRad(hd.celler[0]?.fra ?? "", hd.celler[0]?.til ?? "")?.labelNoekkel === "statushandling.gjenapne",
    );
    expect(gjenapne).toHaveLength(1);
    expect(gjenapne[0]!.celler.map((c) => c.fra).sort()).toEqual(["approved", "cancelled", "closed", "dismissed"]);
  });

  it("Utfører-Besvar er ÉN handling med én delcelle (Mottatt) — Runde-2: in_progress fjernet", () => {
    const utf = FLYTVISNING_BOKS_DEF.find((b) => b.boks === "utforer")!;
    const besvar = (utf.grupper.sendVenstre ?? []).filter(
      (hd): hd is Extract<FlytHandling, { type: "handling" }> => hd.type === "handling" && hd.celler[0]?.til === "responded",
    );
    expect(besvar).toHaveLength(1);
    expect(besvar[0]!.celler.map((c) => c.fra).sort()).toEqual(["received"]);
  });

  it("admin-sonens Videresend (3 delceller, Runde-2: in_progress fjernet) + Gjenåpne (4 delceller)", () => {
    const forventetAntall: Record<string, number> = {
      "flytvisning.admin.videresend": 3, // received/responded/approved (in_progress fjernet)
      "flytvisning.admin.gjenapne": 4, // closed/dismissed/cancelled/approved
    };
    for (const [label, antall] of Object.entries(forventetAntall)) {
      const gruppe = FLYTVISNING_ADMIN_SONE.find((g) => g.labelNoekkel === label)!;
      expect(gruppe.handlinger).toHaveLength(1);
      const handling = gruppe.handlinger[0]!;
      expect(handling.type === "handling" && handling.celler).toHaveLength(antall);
    }
  });
});

describe("flytvisning — korreksjon (a): Gjenåpne begge steder, distinkte celler", () => {
  const gjenapneFra = ["closed", "dismissed", "cancelled", "approved"];

  it("registrator-gjenåpne finnes i Registrator-boksen (LOKALT)", () => {
    const reg = FLYTVISNING_BOKS_DEF.find((b) => b.boks === "registrator")!;
    const celler = handlingerCeller(reg.grupper.lokalt ?? []);
    for (const fra of gjenapneFra) {
      expect(celler.some((c) => c.rolle === "registrator" && c.fra === fra && c.til === "draft")).toBe(true);
    }
  });

  it("prosjektadmin-gjenåpne finnes i admin-sonen (egen celle, ikke admin-only)", () => {
    const gjenapne = FLYTVISNING_ADMIN_SONE.find((g) => g.labelNoekkel === "flytvisning.admin.gjenapne")!;
    const celler = handlingerCeller(gjenapne.handlinger);
    for (const fra of gjenapneFra) {
      expect(celler.some((c) => c.rolle === PROSJEKTADMIN_ROLLE && c.fra === fra && c.til === "draft")).toBe(true);
      expect(celleTilstand(PROSJEKTADMIN_ROLLE, fra, "draft", {})).not.toBe("laast");
    }
  });
});

describe("flytvisning — korreksjon (b): Slett kladd begge bokser, ingen Slett endelig", () => {
  it("draft→deleted finnes for både registrator og bestiller, med «Slett kladd»-etikett", () => {
    for (const boks of ["registrator", "bestiller"] as const) {
      const def = FLYTVISNING_BOKS_DEF.find((b) => b.boks === boks)!;
      const slett = (def.grupper.lokalt ?? []).filter(
        (hd): hd is Extract<FlytHandling, { type: "handling" }> => hd.type === "handling" && hd.celler[0]?.til === "deleted",
      );
      expect(slett).toHaveLength(1);
      expect(slett[0]!.celler[0]!.fra).toBe("draft");
      expect(handlingLabelNoekkel(slett[0]!)).toBe("flytvisning.handling.slettKladd");
    }
  });

  it("admin-Slett beholder standard «Slett»-etikett (skiller fra Slett kladd)", () => {
    const adminSlett = FLYTVISNING_ADMIN_SONE.find((g) => g.labelNoekkel === "flytvisning.admin.slett")!;
    const handling = adminSlett.handlinger[0] as Extract<FlytHandling, { type: "handling" }>;
    expect(handlingLabelNoekkel(handling)).toBe("handling.slett");
  });

  it("«Slett endelig» (slett_endelig / papirkurv-pseudo) er IKKE en celle i fanen", () => {
    expect(alleCeller.some((c) => c.til === "slett_endelig" || c.til === "gjenopprett" || c.fra === "slettet")).toBe(false);
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

  it("admin-sonens videresend-delceller er PÅ (ikke låst)", () => {
    const videresend = FLYTVISNING_ADMIN_SONE.find((g) => g.labelNoekkel === "flytvisning.admin.videresend")!;
    for (const { rolle, fra, til } of handlingerCeller(videresend.handlinger)) {
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
