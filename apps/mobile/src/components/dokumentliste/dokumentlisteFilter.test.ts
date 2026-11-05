import { describe, it, expect } from "vitest";
import {
  antallAktiveFilter,
  ballenBrukerForKilde,
  byggAlternativer,
  filtrerOgSorter,
  STARTRETNING,
  tilgjengeligeSorteringer,
  UTEN_EMNE,
  utenUbruktBallen,
  visFilterKolonne,
  type DokumentRad,
  type Retning,
  type SorterNokkel,
  type Sortering,
} from "./dokumentlisteFilter";

/**
 * Filter-mobil (2026-11-03): nye sorteringer (endret, frist, nummer, emne — tom sist),
 * nye filtre (emne inkl. «uten emne», opprettet av, faggrupper, prioritet, frist/forfalt),
 * opprettet-periode og «ballen hos meg». Delt predikat + delt søk, felles for sjekkliste
 * og oppgave.
 */

const DAG = 86_400_000;
const iDag = Date.now();
const iso = (dagerSiden: number) => new Date(iDag - dagerSiden * DAG).toISOString();

function rad(over: Partial<DokumentRad> & { id: string }): DokumentRad {
  return {
    title: `Dok ${over.id}`,
    status: "sent",
    number: null,
    createdAt: iso(1),
    updatedAt: iso(1),
    subject: null,
    dueDate: null,
    ...over,
  };
}

const ider = (r: DokumentRad[]) => r.map((x) => x.id);
const nivaa = (nokkel: SorterNokkel, retning: Retning = STARTRETNING[nokkel]): Sortering => [
  { nokkel, retning },
];

describe("sortering", () => {
  it("sist endret: nyeste updatedAt først", () => {
    const rader = [
      rad({ id: "a", updatedAt: iso(5) }),
      rad({ id: "b", updatedAt: iso(1) }),
      rad({ id: "c", updatedAt: iso(3) }),
    ];
    expect(ider(filtrerOgSorter(rader, {}, "", nivaa("endret")))).toEqual(["b", "c", "a"]);
  });

  it("frist: tidligste først, uten frist sist", () => {
    const rader = [
      rad({ id: "uten" }),
      rad({ id: "sen", dueDate: iso(-10) }),
      rad({ id: "tidlig", dueDate: iso(-2) }),
    ];
    expect(ider(filtrerOgSorter(rader, {}, "", nivaa("frist")))).toEqual(["tidlig", "sen", "uten"]);
  });

  it("nummer: stigende, uten nummer sist", () => {
    const rader = [rad({ id: "x" }), rad({ id: "n10", number: 10 }), rad({ id: "n2", number: 2 })];
    expect(ider(filtrerOgSorter(rader, {}, "", nivaa("nummer")))).toEqual(["n2", "n10", "x"]);
  });

  it("emne A–Å (norsk), tomt emne sist", () => {
    const rader = [
      rad({ id: "tom", subject: "  " }),
      rad({ id: "ae", subject: "Ærfugl" }),
      rad({ id: "b", subject: "Bad" }),
      rad({ id: "null" }),
      rad({ id: "aa", subject: "Åpning" }),
    ];
    const r = ider(filtrerOgSorter(rader, {}, "", nivaa("emne")));
    expect(r.slice(0, 3)).toEqual(["b", "ae", "aa"]);
    expect(r.slice(3).sort()).toEqual(["null", "tom"]);
  });

  it("søk overstyrer sortering (relevans)", () => {
    const rader = [rad({ id: "a", title: "Rekkverk" }), rad({ id: "b", title: "Annet", subject: "Rekkverk trapp" })];
    expect(ider(filtrerOgSorter(rader, {}, "rekkverk", nivaa("nummer"))).sort()).toEqual(["a", "b"]);
  });
});

describe("filtre", () => {
  it("emne: «uten emne» velger rader med tomt/manglende emne", () => {
    const rader = [rad({ id: "a", subject: "Bad" }), rad({ id: "b" }), rad({ id: "c", subject: " " })];
    expect(ider(filtrerOgSorter(rader, { emne: UTEN_EMNE }, "", nivaa("nummer"))).sort()).toEqual(["b", "c"]);
    expect(ider(filtrerOgSorter(rader, { emne: "Bad" }, "", nivaa("nummer")))).toEqual(["a"]);
  });

  it("alternativer: emne får «uten emne» bare når noen rad mangler emne", () => {
    expect(byggAlternativer([rad({ id: "a", subject: "Bad" })]).emne.map((a) => a.value)).toEqual(["Bad"]);
    expect(
      byggAlternativer([rad({ id: "a", subject: "Bad" }), rad({ id: "b" })]).emne.map((a) => a.value),
    ).toEqual(["Bad", UTEN_EMNE]);
  });

  it("alternativer: prioritet i fast rekkefølge, bare verdier som finnes", () => {
    const rader = [rad({ id: "a", priority: "critical" }), rad({ id: "b", priority: "low" })];
    expect(byggAlternativer(rader).prioritet.map((a) => a.value)).toEqual(["low", "critical"]);
  });

  it("opprettet av, faggrupper og prioritet (multi)", () => {
    const rader = [
      rad({ id: "a", bestiller: { name: "Kari" }, bestillerFaggruppe: { name: "BH" }, utforerFaggruppe: { name: "Elektro" }, priority: "high" }),
      rad({ id: "b", bestiller: { name: "Ola" }, bestillerFaggruppe: { name: "TE" }, utforerFaggruppe: { name: "Rør" }, priority: "low" }),
    ];
    expect(ider(filtrerOgSorter(rader, { opprettetAv: "Ola" }, "", nivaa("nummer")))).toEqual(["b"]);
    expect(ider(filtrerOgSorter(rader, { bestillerFaggruppe: "BH" }, "", nivaa("nummer")))).toEqual(["a"]);
    expect(ider(filtrerOgSorter(rader, { utforerFaggruppe: "Rør" }, "", nivaa("nummer")))).toEqual(["b"]);
    expect(ider(filtrerOgSorter(rader, { prioritet: "high,low" }, "", nivaa("nummer"))).sort()).toEqual(["a", "b"]);
  });

  it("forfalt: passert frist teller, men ikke når dokumentet er ferdig", () => {
    const rader = [
      rad({ id: "forfalt", dueDate: iso(2) }),
      rad({ id: "ferdig", dueDate: iso(2), status: "approved" }),
      rad({ id: "lukket", dueDate: iso(2), status: "closed" }),
      rad({ id: "avbrutt", dueDate: iso(2), status: "cancelled" }),
      rad({ id: "fremtid", dueDate: iso(-2) }),
      rad({ id: "uten" }),
    ];
    expect(ider(filtrerOgSorter(rader, { frist: "forfalt" }, "", nivaa("nummer")))).toEqual(["forfalt"]);
    expect(ider(filtrerOgSorter(rader, { frist: "ingen_frist" }, "", nivaa("nummer")))).toEqual(["uten"]);
  });

  it("opprettet-periode: siste uke slipper bare nyere rader; «alle» filtrerer ikke", () => {
    const rader = [rad({ id: "ny", createdAt: iso(2) }), rad({ id: "gammel", createdAt: iso(20) })];
    const uke = { hurtigvalg: "uke" as const, fra: null, til: null };
    expect(ider(filtrerOgSorter(rader, {}, "", nivaa("nummer"), { periode: uke }))).toEqual(["ny"]);
    const alle = { hurtigvalg: "alle" as const, fra: null, til: null };
    expect(ider(filtrerOgSorter(rader, {}, "", nivaa("nummer"), { periode: alle }))).toHaveLength(2);
  });

  it("opprettet-periode: egendefinert er inklusiv hele til-dagen", () => {
    const rader = [rad({ id: "inne", createdAt: iso(5) }), rad({ id: "ute", createdAt: iso(15) })];
    const p = { hurtigvalg: "egendefinert" as const, fra: new Date(iDag - 10 * DAG), til: new Date(iDag - 5 * DAG) };
    expect(ider(filtrerOgSorter(rader, {}, "", nivaa("nummer"), { periode: p }))).toEqual(["inne"]);
  });

  it("ballen hos meg: mottaker, mottakergruppe eller egen kladd", () => {
    const bruker = { userId: "u1", gruppeIder: ["g1"] };
    const rader = [
      rad({ id: "mottaker", recipientUserId: "u1" }),
      rad({ id: "gruppe", recipientGroupId: "g1" }),
      rad({ id: "kladd", status: "draft", bestillerUserId: "u1" }),
      rad({ id: "andres-kladd", status: "draft", bestillerUserId: "u2", recipientUserId: "u1" }),
      rad({ id: "annen", recipientUserId: "u2" }),
    ];
    expect(ider(filtrerOgSorter(rader, { ballen: "1" }, "", nivaa("nummer"), { bruker })).sort()).toEqual([
      "gruppe",
      "kladd",
      "mottaker",
    ]);
  });

  it("ballen hos meg ignoreres uten bruker (offline)", () => {
    const rader = [rad({ id: "a" }), rad({ id: "b" })];
    expect(filtrerOgSorter(rader, { ballen: "1" }, "", nivaa("nummer"))).toHaveLength(2);
  });

  it("R1: lokal kilde + ballen satt → filteret ignoreres, lista er ikke tom og bryteren skjules", () => {
    const nett = { userId: "u1", gruppeIder: ["g1"] };
    // Lokale rader (offline-katalogen) bærer ingen bestiller-/mottaker-id-er.
    const lokale = [rad({ id: "l1" }), rad({ id: "l2" })];
    const bruker = ballenBrukerForKilde(nett, "lokal");
    expect(bruker).toBeNull(); // visBallen={!!bruker} → bryteren skjult
    const fv = utenUbruktBallen({ ballen: "1" }, bruker);
    expect(fv).toEqual({});
    expect(antallAktiveFilter(fv)).toBe(0);
    expect(ider(filtrerOgSorter(lokale, fv, "", nivaa("nummer"), { bruker }))).toEqual(["l1", "l2"]);
  });

  it("R1: serverkilde beholder ballen-brukeren og filteret", () => {
    const nett = { userId: "u1", gruppeIder: [] };
    const bruker = ballenBrukerForKilde(nett, "server");
    expect(bruker).toBe(nett);
    const rader = [rad({ id: "min", recipientUserId: "u1" }), rad({ id: "annen", recipientUserId: "u2" })];
    const fv = utenUbruktBallen({ ballen: "1" }, bruker);
    expect(ider(filtrerOgSorter(rader, fv, "", nivaa("nummer"), { bruker }))).toEqual(["min"]);
  });

  it("trakt-telleren teller nye filtre og aktiv periode", () => {
    expect(antallAktiveFilter({ emne: "Bad", prioritet: "high", ballen: "1" })).toBe(3);
    expect(antallAktiveFilter({}, { hurtigvalg: "uke", fra: null, til: null })).toBe(1);
    expect(antallAktiveFilter({}, { hurtigvalg: "alle", fra: null, til: null })).toBe(0);
  });
});

describe("B-1 område", () => {
  const rader = [
    rad({ id: "a", omrade: { navn: "Plan 2" } }),
    rad({ id: "b", omrade: { navn: "Tak" } }),
    rad({ id: "c" }),
  ];

  it("filtrerer på områdenavn", () => {
    expect(ider(filtrerOgSorter(rader, { omrade: "Tak" }, "", nivaa("nummer")))).toEqual(["b"]);
  });

  it("alternativer: unike områdenavn, rader uten område gir ingen verdi", () => {
    expect(byggAlternativer(rader).omrade.map((a) => a.value).sort()).toEqual(["Plan 2", "Tak"]);
  });

  it("eldre API uten område (alle null) → filteret skjules", () => {
    const alt = byggAlternativer([rad({ id: "x" }), rad({ id: "y" })]).omrade;
    expect(alt).toEqual([]);
    expect(visFilterKolonne("omrade", alt, {})).toBe(false);
    expect(visFilterKolonne("omrade", byggAlternativer(rader).omrade, {})).toBe(true);
  });
});

describe("M-pakke B-2/B-4 — hvem og når", () => {
  const h = (navn: string, dagerSiden: number) => ({ av: { id: `u-${navn}`, navn }, ved: iso(dagerSiden) });
  const tomme = { sendt: null, godkjent: null, lukket: null };
  const rader = [
    rad({
      id: "a",
      createdAt: iso(30),
      statushendelser: { sendt: h("Ola", 2), godkjent: h("Kari", 1), lukket: null },
      utfylling: { sist: h("Kari", 3), alle: [{ id: "u-Ola", navn: "Ola" }, { id: "u-Kari", navn: "Kari" }] },
    }),
    rad({ id: "b", createdAt: iso(2), statushendelser: { ...tomme, sendt: h("Per", 20) }, utfylling: null }),
    rad({ id: "c", createdAt: iso(1), statushendelser: tomme, utfylling: { sist: null, alle: [] } }),
  ];

  it("person-filtrene leser riktig statussteg", () => {
    expect(ider(filtrerOgSorter(rader, { sendtAv: "Per" }, "", nivaa("nummer")))).toEqual(["b"]);
    expect(ider(filtrerOgSorter(rader, { godkjentAv: "Kari" }, "", nivaa("nummer")))).toEqual(["a"]);
  });

  it("«Utfylt av» treffer alle i endringsloggen, ikke bare den siste", () => {
    expect(ider(filtrerOgSorter(rader, { utfyltAv: "Ola" }, "", nivaa("nummer")))).toEqual(["a"]);
    expect(byggAlternativer(rader).utfyltAv.map((a) => a.value).sort()).toEqual(["Kari", "Ola"]);
  });

  it("periode på sendt-dato i stedet for opprettet", () => {
    const uke = { hurtigvalg: "uke" as const, fra: null, til: null };
    expect(ider(filtrerOgSorter(rader, {}, "", nivaa("nummer"), { periode: uke })).sort()).toEqual(["b", "c"]);
    expect(ider(filtrerOgSorter(rader, {}, "", nivaa("nummer"), { periode: { ...uke, felt: "sendt" } }))).toEqual(["a"]);
  });

  it("sortering «sendt»: nyeste først, ikke sendt sist", () => {
    expect(ider(filtrerOgSorter(rader, {}, "", nivaa("sendt")))).toEqual(["a", "b", "c"]);
  });

  it("eldre API uten feltene → personfiltre, statusdatoer og «sendt» skjules stille", () => {
    const gamle = [rad({ id: "x" }), rad({ id: "y" })];
    const alt = byggAlternativer(gamle);
    expect([alt.sendtAv, alt.godkjentAv, alt.lukketAv, alt.utfyltAv]).toEqual([[], [], [], []]);
    expect(alt.statusPeriodefelt).toEqual([]);
    expect(tilgjengeligeSorteringer(gamle, [])).not.toContain("sendt");
    expect(byggAlternativer(rader).statusPeriodefelt).toEqual(["sendt", "godkjent"]);
    expect(tilgjengeligeSorteringer(rader, [])).toContain("sendt");
  });
});
