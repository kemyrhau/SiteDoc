import { describe, expect, it } from "vitest";
import { beregnDokumentSignatur, reduserStatushendelser, reduserUtfylling, type StatusTransferRad } from "./dokumentMetadata";

const ola = { id: "u-ola", name: "Ola" };
const kari = { id: "u-kari", name: "Kari" };

function rad(fromStatus: string, toStatus: string, createdAt: string, sender = ola): StatusTransferRad {
  return { fromStatus, toStatus, createdAt: new Date(createdAt), sender };
}

describe("reduserStatushendelser (B-2)", () => {
  const historikk = [
    rad("draft", "sent", "2026-11-01T08:00:00Z", ola),
    rad("sent", "received", "2026-11-01T08:00:01Z", ola),
    rad("received", "draft", "2026-11-01T09:00:00Z", kari),
    rad("draft", "sent", "2026-11-02T08:00:00Z", kari),
    rad("received", "approved", "2026-11-03T08:00:00Z", ola),
    rad("approved", "draft", "2026-11-03T09:00:00Z", ola),
    rad("received", "approved", "2026-11-04T08:00:00Z", kari),
    rad("approved", "closed", "2026-11-04T10:00:00Z", ola),
  ];

  it("sendt = eldste draft→sent, uavhengig av rekkefølgen inn", () => {
    const r = reduserStatushendelser([...historikk].reverse(), null);
    expect(r.sendt).toEqual({ av: { id: "u-ola", navn: "Ola" }, ved: "2026-11-01T08:00:00.000Z" });
  });

  it("draft→received teller også som sendt; sent→received gjør det ikke", () => {
    const r = reduserStatushendelser([rad("sent", "received", "2026-11-01T07:00:00Z", kari), rad("draft", "received", "2026-11-01T08:00:00Z")], null);
    expect(r.sendt?.av.id).toBe("u-ola");
  });

  it("godkjent = NYESTE approved, lukket = nyeste closed når terminal er lukket", () => {
    const r = reduserStatushendelser(historikk, "lukket");
    expect(r.godkjent).toEqual({ av: { id: "u-kari", navn: "Kari" }, ved: "2026-11-04T08:00:00.000Z" });
    expect(r.lukket).toEqual({ av: { id: "u-ola", navn: "Ola" }, ved: "2026-11-04T10:00:00.000Z" });
  });

  it("gjenåpningsregelen: terminal godkjent viser godkjent, ikke lukket", () => {
    const r = reduserStatushendelser(historikk, "godkjent");
    expect(r.godkjent?.av.id).toBe("u-kari");
    expect(r.lukket).toBeNull();
  });

  it("gjenåpningsregelen: gjenåpnet dokument (terminal null) har verken godkjent eller lukket", () => {
    const r = reduserStatushendelser(historikk, null);
    expect(r.sendt).not.toBeNull();
    expect(r.godkjent).toBeNull();
    expect(r.lukket).toBeNull();
  });

  it("avvist/avbrutt viser ikke godkjent selv om dokumentet en gang var det", () => {
    expect(reduserStatushendelser(historikk, "avvist").godkjent).toBeNull();
    expect(reduserStatushendelser(historikk, "avbrutt").godkjent).toBeNull();
  });

  it("ingen rader → alt null", () => {
    expect(reduserStatushendelser([], "lukket")).toEqual({ sendt: null, godkjent: null, lukket: null });
  });
});

describe("reduserUtfylling (B-4)", () => {
  const navn = new Map([["u-ola", "Ola"], ["u-kari", "Kari"]]);

  it("sist = nyeste gruppe; alle = alle brukere i loggen", () => {
    const r = reduserUtfylling(
      [
        { userId: "u-ola", sist: new Date("2026-11-04T10:00:00Z") },
        { userId: "u-kari", sist: new Date("2026-11-04T12:00:00Z") },
      ],
      navn,
      true,
    );
    expect(r?.sist).toEqual({ av: { id: "u-kari", navn: "Kari" }, ved: "2026-11-04T12:00:00.000Z" });
    expect(r?.alle.map((a) => a.id).sort()).toEqual(["u-kari", "u-ola"]);
  });

  it("logg av i malen → null (ukjent, ikke «ingen»)", () => {
    expect(reduserUtfylling([{ userId: "u-ola", sist: new Date() }], navn, false)).toBeNull();
  });

  it("logg på men tom → sist null, alle tom", () => {
    expect(reduserUtfylling([], navn, true)).toEqual({ sist: null, alle: [] });
  });
});

describe("beregnDokumentSignatur (B-3)", () => {
  const sig = (id: string, parentId: string | null = null) => ({ id, type: "signature", config: {}, parentId });
  const signert = { verdi: { dataUrl: "data:image/png;base64,AAA", brukerId: "u", navn: "Ola", tidspunkt: null } };

  it("uten signaturfelt → null", () => {
    expect(beregnDokumentSignatur([{ id: "a", type: "text", config: {}, parentId: null }], {}, null, 0)).toBeNull();
  });

  it("malfelt: teller felt med verdi, legacy data-URL inkludert", () => {
    const r = beregnDokumentSignatur([sig("s1"), sig("s2"), sig("s3")], { s1: signert, s2: { verdi: "data:image/png;base64,BBB" } }, null, 0);
    expect(r).toEqual({ kreves: 3, signert: 2, komplett: false });
  });

  it("alle signert → komplett", () => {
    expect(beregnDokumentSignatur([sig("s1")], { s1: signert }, null, 0)).toEqual({ kreves: 1, signert: 1, komplett: true });
  });

  it("betinget skjult signaturfelt kreves ikke", () => {
    const forelder = { id: "f", type: "list_single", config: { conditionActive: true, conditionValues: ["Ja"] }, parentId: null };
    const r = beregnDokumentSignatur([forelder, sig("s1", "f")], { f: { verdi: "Nei" } }, null, 0);
    expect(r).toEqual({ kreves: 0, signert: 0, komplett: false });
  });

  it("signaturfelt i repeater telles ikke", () => {
    const rep = { id: "r", type: "repeater", config: {}, parentId: null };
    expect(beregnDokumentSignatur([rep, sig("s1", "r"), sig("s2")], { s2: signert }, null, 0)).toEqual({ kreves: 1, signert: 1, komplett: true });
  });

  it("SJA: avsluttet runde bruker frosset antall; signert + bekreftet teller", () => {
    const liste = { id: "l", type: "signature_list", config: {}, parentId: null };
    const r = beregnDokumentSignatur(
      [liste],
      {},
      { rundeNr: 2, avsluttet: true, antallSignert: 3, antallBekreftet: 1, antallDeltakere: 5 },
      9,
    );
    expect(r).toEqual({ kreves: 5, signert: 4, komplett: false });
  });

  it("SJA: åpen runde bruker aktive deltakere; uten runde kreves aktive, signert 0", () => {
    const liste = { id: "l", type: "signature_list", config: {}, parentId: null };
    expect(beregnDokumentSignatur([liste], {}, { rundeNr: 1, avsluttet: false, antallSignert: 2, antallDeltakere: null }, 2)).toEqual({
      kreves: 2,
      signert: 2,
      komplett: true,
    });
    expect(beregnDokumentSignatur([liste], {}, null, 4)).toEqual({ kreves: 4, signert: 0, komplett: false });
  });
});
