import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { harForslag, vekslForslag } from "./forslagVeksling";

describe("RETUR 36c pkt 2 — forslagsknapp overskriver aldri skrevet tekst", () => {
  it("🔴 skrevet tekst + trykk på forslag → begge står", () => {
    expect(vekslForslag("Støpte såle", "Graving")).toBe("Støpte såle · Graving");
  });

  it("🔴 nytt trykk på samme forslag → bare skrevet tekst står", () => {
    const med = vekslForslag("Støpte såle", "Graving");
    expect(vekslForslag(med, "Graving")).toBe("Støpte såle");
  });

  it("tomt felt + trykk → bare forslaget; trykk igjen → tomt", () => {
    expect(vekslForslag("", "Graving")).toBe("Graving");
    expect(vekslForslag("Graving", "Graving")).toBe("");
  });

  it("to forslag: fjerner bare det som trykkes, rekkefølgen står", () => {
    const v = vekslForslag(vekslForslag("Skrevet", "A"), "B");
    expect(v).toBe("Skrevet · A · B");
    expect(vekslForslag(v, "A")).toBe("Skrevet · B");
  });

  it("negativkontroll: forslag som bare er en del av skrevet tekst regnes ikke som valgt", () => {
    expect(harForslag("Graving av grøft", "Graving")).toBe(false);
    expect(vekslForslag("Graving av grøft", "Graving")).toBe("Graving av grøft · Graving");
  });

  it("🔴 komponenten bruker vekslForslag, ikke erstatning", () => {
    const kilde = fs.readFileSync(path.join(__dirname, "../components/timer-detalj/BekreftDagBeskrivelse.tsx"), "utf8");
    expect(kilde).toContain("onPress={() => onEndre(vekslForslag(verdi, c))}");
    expect(kilde).not.toContain("onPress={() => onEndre(c)}");
  });
});
