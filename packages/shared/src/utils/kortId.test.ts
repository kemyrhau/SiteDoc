import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  kortIdNokkel,
  kortPaaSedelFraRader,
  losKortId,
  md5Hex,
  utledKortId,
  validerKortInvariant,
  type KortInvariantRad,
} from "./kortId";

// Faste vektorer. md5-verdiene er RFC 1321-vektorene; utledet id-vektoren er regnet med
// Postgres `md5(...)::uuid` (samme tekst), og verifiseres også mot ekte Postgres i
// apps/api-integrasjonstesten (T3).
describe("md5Hex", () => {
  it("RFC 1321-vektorer", () => {
    expect(md5Hex("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5Hex("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5Hex("message digest")).toBe("f96b697d7cb7938d525a2f31aaf161d0");
    expect(md5Hex("12345678901234567890123456789012345678901234567890123456789012345678901234567890")).toBe(
      "57edf4a22be3c955ac49da2e2107b67a",
    );
  });
  it("UTF-8 (æøå) som Postgres", () => {
    for (const s of ["æøå", "Bygg 50 — grøft", "🙂", "a".repeat(200)])
      expect(md5Hex(s)).toBe(createHash("md5").update(s, "utf8").digest("hex"));
  });
});

describe("utledKortId (T3, JS-siden)", () => {
  const args = {
    userId: "u1",
    dato: "2026-11-16",
    nokkel: { projectId: "p1", byggeplassId: null, ecoId: null },
  };
  it("er deterministisk og passerer z.string().uuid()", () => {
    const id = utledKortId(args);
    expect(id).toBe(utledKortId(args));
    expect(z.string().uuid().safeParse(id).success).toBe(true);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
  it("teksten er 'kort|user|dato|prosjekt|bp|eco' med «ingen» for null", () => {
    const hex = md5Hex("kort|u1|2026-11-16|p1|ingen|ingen");
    expect(utledKortId(args).replace(/-/g, "")).toBe(hex);
  });
  it("ulik nøkkel → ulik id; fravær (prosjekt null) bruker «ingen»", () => {
    const a = utledKortId(args);
    const b = utledKortId({ ...args, nokkel: { ...args.nokkel, ecoId: "e1" } });
    const c = utledKortId({ ...args, nokkel: { projectId: null, byggeplassId: null, ecoId: null } });
    expect(new Set([a, b, c]).size).toBe(3);
    expect(c.replace(/-/g, "")).toBe(md5Hex("kort|u1|2026-11-16|ingen|ingen|ingen"));
  });
});

describe("losKortId (§ 2.4)", () => {
  const n = kortIdNokkel({ projectId: "p1", byggeplassId: null, ecoId: null });
  const n2 = kortIdNokkel({ projectId: "p2", byggeplassId: null, ecoId: null });
  it("regel 1: oppgitt id vinner", () => {
    expect(
      losKortId({ oppgittKortId: "X", lagret: { kortId: "L", nokkel: n }, nokkel: n, kortPaaSedel: [], utledet: "U" }),
    ).toBe("X");
  });
  it("regel 2: kjent rad med uendret nøkkel beholder id", () => {
    expect(losKortId({ lagret: { kortId: "L", nokkel: n }, nokkel: n, kortPaaSedel: [{ kortId: "E", nokkel: n }], utledet: "U" })).toBe("L");
  });
  it("regel 3: flyttet rad → eldste kort med samme nøkkel, ellers utledet", () => {
    expect(
      losKortId({
        lagret: { kortId: "L", nokkel: n },
        nokkel: n2,
        kortPaaSedel: [{ kortId: "A", nokkel: n }, { kortId: "B", nokkel: n2 }, { kortId: "C", nokkel: n2 }],
        utledet: "U",
      }),
    ).toBe("B");
    expect(losKortId({ nokkel: n2, kortPaaSedel: [{ kortId: "A", nokkel: n }], utledet: "U" })).toBe("U");
  });
  it("kortPaaSedelFraRader sorterer eldste først, ett kort pr. id", () => {
    expect(
      kortPaaSedelFraRader([
        { kortId: "B", nokkel: n, opprettet: 5 },
        { kortId: "A", nokkel: n, opprettet: 3 },
        { kortId: "B", nokkel: n, opprettet: 1 },
        { kortId: null, nokkel: n, opprettet: 0 },
      ]),
    ).toEqual([{ kortId: "B", nokkel: n }, { kortId: "A", nokkel: n }]);
  });
});

describe("validerKortInvariant (K1–K4, K6)", () => {
  const rad = (o: Partial<KortInvariantRad>): KortInvariantRad => ({
    id: "r",
    type: "timer",
    kortId: "K",
    sheetId: "s1",
    nokkel: { projectId: "p1", byggeplassId: null, ecoId: null },
    ...o,
  });
  it("like rader → gyldig; to kort med lik nøkkel er lov (K7)", () => {
    expect(validerKortInvariant([rad({ id: "a" }), rad({ id: "b" }), rad({ id: "c", kortId: "K2" })])).toEqual([]);
  });
  it("K2/K3/K4-brudd → kortUlikeRader", () => {
    for (const nokkel of [
      { projectId: "p2", byggeplassId: null, ecoId: null },
      { projectId: "p1", byggeplassId: null, ecoId: "e" },
      { projectId: "p1", byggeplassId: "b", ecoId: null },
    ])
      expect(validerKortInvariant([rad({ id: "a" }), rad({ id: "b", nokkel })])[0]?.grunn).toBe("kortUlikeRader");
  });
  it("K1-brudd → kortUlikSedel", () => {
    expect(validerKortInvariant([rad({ id: "a" }), rad({ id: "b", sheetId: "s2" })])[0]?.grunn).toBe("kortUlikSedel");
  });
  it("K6: koblet maskin med annet kort enn raden → kobletUlikKort", () => {
    expect(
      validerKortInvariant([rad({ id: "t1" }), rad({ id: "m1", type: "maskin", kortId: "K9", sheetTimerId: "t1" })])[0]?.grunn,
    ).toBe("kobletUlikKort");
    expect(validerKortInvariant([rad({ id: "t1" }), rad({ id: "m1", type: "maskin", sheetTimerId: "t1" })])).toEqual([]);
  });
  it("rader uten kortId (reise) hoppes over", () => {
    expect(validerKortInvariant([rad({ id: "a", kortId: null }), rad({ id: "b", kortId: null, nokkel: { projectId: "p9", byggeplassId: null, ecoId: null } })])).toEqual([]);
  });
});
