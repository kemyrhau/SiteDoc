import { describe, it, expect } from "vitest";
import {
  perspektivEtikett,
  utledPerspektiv,
  kvitteringEtikett,
  type PerspektivDokumentType,
  type PerspektivSeerKontekst,
  type BadgeVariant,
} from "./perspektivEtikett";

/**
 * Perspektiv-etikett — frosne forventninger fra den fabel-gatede tabellen
 * (docs/claude/delplaner/a3b-perspektiv-tabell.md, 2026-07-20).
 *
 * Egen testfil (IKKE rader i tilgangsmatrise.test.ts): denne tester VISNING
 * (etikett + farge per perspektiv), ikke TILGANG. Samme mønster: tabelldrevet,
 * frosne forventninger, utvidbar ved å legge til RADER i SAKER, ikke ny fil.
 *
 * Kjernen (N1): samme lagrede status gir ulik etikett/variant etter seer.
 * En rad = én (status, seer-kontekst, dokumenttype) → forventet (etikettKey,
 * variant, perspektiv). Endres en celle i produksjonstabellen uten at raden her
 * oppdateres → testen faller. Det er meningen.
 */

// Seer-kontekst-byggere: perspektiv utledes av rolle + ballinnehav.
const aktiv: PerspektivSeerKontekst = { rolle: "utforer", harBallen: true };
const venter: PerspektivSeerKontekst = { rolle: "bestiller", harBallen: false };
const registrator: PerspektivSeerKontekst = { rolle: "registrator", harBallen: false };
// Godkjenner er ikke et eget perspektiv: med ballen → aktiv, uten → venter.
const godkjennerMedBall: PerspektivSeerKontekst = { rolle: "godkjenner", harBallen: true };
const godkjennerUtenBall: PerspektivSeerKontekst = { rolle: "godkjenner", harBallen: false };

interface Rad {
  navn: string;
  status: string;
  kontekst: PerspektivSeerKontekst;
  type: PerspektivDokumentType;
  etikettKey: string;
  variant: BadgeVariant;
  perspektiv: "aktiv" | "venter" | "registrator";
}

const MATRISE: Rad[] = [
  // ── Base (sjekkliste) — AKTIV (har ballen) ──────────────────────────────
  { navn: "base/aktiv/draft", status: "draft", kontekst: aktiv, type: "sjekkliste", etikettKey: "status.utkast", variant: "default", perspektiv: "aktiv" },
  { navn: "base/aktiv/received", status: "received", kontekst: aktiv, type: "sjekkliste", etikettKey: "status.tilBehandling", variant: "warning", perspektiv: "aktiv" },
  { navn: "base/aktiv/in_progress", status: "in_progress", kontekst: aktiv, type: "sjekkliste", etikettKey: "status.underArbeid", variant: "warning", perspektiv: "aktiv" },
  { navn: "base/aktiv/responded (godkjenner har ballen)", status: "responded", kontekst: godkjennerMedBall, type: "sjekkliste", etikettKey: "status.tilGodkjenning", variant: "warning", perspektiv: "aktiv" },
  { navn: "base/aktiv/rejected (utfører utbedrer)", status: "rejected", kontekst: aktiv, type: "sjekkliste", etikettKey: "status.tilUtbedring", variant: "warning", perspektiv: "aktiv" },
  { navn: "base/aktiv/approved", status: "approved", kontekst: aktiv, type: "sjekkliste", etikettKey: "status.godkjent", variant: "success", perspektiv: "aktiv" },
  { navn: "base/aktiv/closed", status: "closed", kontekst: aktiv, type: "sjekkliste", etikettKey: "status.lukket", variant: "default", perspektiv: "aktiv" },
  { navn: "base/aktiv/cancelled", status: "cancelled", kontekst: aktiv, type: "sjekkliste", etikettKey: "status.avbrutt", variant: "danger", perspektiv: "aktiv" },

  // ── Base — VENTER (ballen hos andre) ────────────────────────────────────
  { navn: "base/venter/received", status: "received", kontekst: venter, type: "sjekkliste", etikettKey: "status.tilBehandling", variant: "primary", perspektiv: "venter" },
  { navn: "base/venter/in_progress", status: "in_progress", kontekst: venter, type: "sjekkliste", etikettKey: "status.underArbeid", variant: "primary", perspektiv: "venter" },
  { navn: "base/venter/responded (utfører venter)", status: "responded", kontekst: venter, type: "sjekkliste", etikettKey: "status.besvartTilGodkjenning", variant: "primary", perspektiv: "venter" },
  { navn: "base/venter/rejected (godkjenner sendte tilbake)", status: "rejected", kontekst: godkjennerUtenBall, type: "sjekkliste", etikettKey: "status.tilRevisjon", variant: "primary", perspektiv: "venter" },
  { navn: "base/venter/approved", status: "approved", kontekst: venter, type: "sjekkliste", etikettKey: "status.godkjent", variant: "success", perspektiv: "venter" },
  { navn: "base/venter/cancelled", status: "cancelled", kontekst: venter, type: "sjekkliste", etikettKey: "status.avbrutt", variant: "danger", perspektiv: "venter" },

  // ── Base — REGISTRATOR (nøytral, kolonne D) ─────────────────────────────
  { navn: "reg/draft", status: "draft", kontekst: registrator, type: "sjekkliste", etikettKey: "status.utkast", variant: "default", perspektiv: "registrator" },
  { navn: "reg/received", status: "received", kontekst: registrator, type: "sjekkliste", etikettKey: "status.mottatt", variant: "primary", perspektiv: "registrator" },
  { navn: "reg/in_progress", status: "in_progress", kontekst: registrator, type: "sjekkliste", etikettKey: "status.paagaar", variant: "primary", perspektiv: "registrator" },
  { navn: "reg/responded", status: "responded", kontekst: registrator, type: "sjekkliste", etikettKey: "status.besvart", variant: "primary", perspektiv: "registrator" },
  { navn: "reg/rejected (§2b: danger→primary)", status: "rejected", kontekst: registrator, type: "sjekkliste", etikettKey: "status.tilRevisjon", variant: "primary", perspektiv: "registrator" },
  { navn: "reg/approved", status: "approved", kontekst: registrator, type: "sjekkliste", etikettKey: "status.godkjent", variant: "success", perspektiv: "registrator" },
  { navn: "reg/closed", status: "closed", kontekst: registrator, type: "sjekkliste", etikettKey: "status.lukket", variant: "default", perspektiv: "registrator" },
  { navn: "reg/cancelled", status: "cancelled", kontekst: registrator, type: "sjekkliste", etikettKey: "status.avbrutt", variant: "danger", perspektiv: "registrator" },
  { navn: "reg/sent (defensiv — ikke lagret)", status: "sent", kontekst: registrator, type: "sjekkliste", etikettKey: "status.sendt", variant: "primary", perspektiv: "registrator" },

  // ── HMS — AKTIV (HMS-gruppe, eller innsender ved retur/kladd) ────────────
  { navn: "hms/aktiv/draft (innsender)", status: "draft", kontekst: aktiv, type: "hms", etikettKey: "status.utkast", variant: "default", perspektiv: "aktiv" },
  { navn: "hms/aktiv/received (HMS-gruppe)", status: "received", kontekst: aktiv, type: "hms", etikettKey: "status.tilBehandling", variant: "warning", perspektiv: "aktiv" },
  { navn: "hms/aktiv/in_progress", status: "in_progress", kontekst: aktiv, type: "hms", etikettKey: "status.underBehandling", variant: "warning", perspektiv: "aktiv" },
  { navn: "hms/aktiv/approved (innsender, retur)", status: "approved", kontekst: aktiv, type: "hms", etikettKey: "status.godkjentReturnert", variant: "success", perspektiv: "aktiv" },
  { navn: "hms/aktiv/rejected (innsender utbedrer)", status: "rejected", kontekst: aktiv, type: "hms", etikettKey: "status.tilUtbedring", variant: "warning", perspektiv: "aktiv" },
  { navn: "hms/aktiv/cancelled", status: "cancelled", kontekst: aktiv, type: "hms", etikettKey: "status.avbrutt", variant: "danger", perspektiv: "aktiv" },

  // ── HMS — VENTER (innsender venter, eller HMS-gruppe etter behandling) ───
  { navn: "hms/venter/received (innsender venter)", status: "received", kontekst: venter, type: "hms", etikettKey: "status.tilBehandlingHms", variant: "primary", perspektiv: "venter" },
  { navn: "hms/venter/in_progress", status: "in_progress", kontekst: venter, type: "hms", etikettKey: "status.underBehandling", variant: "primary", perspektiv: "venter" },
  { navn: "hms/venter/approved (HMS-gruppe ferdig)", status: "approved", kontekst: venter, type: "hms", etikettKey: "status.godkjent", variant: "success", perspektiv: "venter" },
  { navn: "hms/venter/rejected (HMS-gruppe sendte tilbake)", status: "rejected", kontekst: venter, type: "hms", etikettKey: "status.tilRevisjon", variant: "primary", perspektiv: "venter" },

  // ── HMS — REGISTRATOR (samme nøytrale sannhet som base) ─────────────────
  { navn: "hms/reg/in_progress (Pågår, ikke Under behandling)", status: "in_progress", kontekst: registrator, type: "hms", etikettKey: "status.paagaar", variant: "primary", perspektiv: "registrator" },

  // ── Fallback: udefinert (perspektiv, status)-celle → registrator-sannhet ─
  // Aktiv seer på en status uten aktiv-celle (f.eks. utfører ser 'sent') → kolonne D.
  { navn: "fallback/aktiv/sent → registrator", status: "sent", kontekst: aktiv, type: "sjekkliste", etikettKey: "status.sendt", variant: "primary", perspektiv: "aktiv" },
  // Venter-seer på draft (skal ikke skje) → registrator-fallback «Utkast».
  { navn: "fallback/venter/draft → registrator", status: "draft", kontekst: venter, type: "sjekkliste", etikettKey: "status.utkast", variant: "default", perspektiv: "venter" },
];

describe("perspektivEtikett — frosne rader fra perspektiv-tabellen", () => {
  it.each(MATRISE)("$navn → $etikettKey / $variant", (rad) => {
    const resultat = perspektivEtikett(rad.status, rad.kontekst, rad.type);
    expect(resultat.etikettKey).toBe(rad.etikettKey);
    expect(resultat.variant).toBe(rad.variant);
    expect(resultat.perspektiv).toBe(rad.perspektiv);
  });
});

describe("perspektivEtikett — N1-kjernen: samme status, ulik seer", () => {
  it("received: avsender (primary) ≠ mottaker (warning), samme etikett-ord", () => {
    const avsender = perspektivEtikett("received", venter, "sjekkliste");
    const mottaker = perspektivEtikett("received", aktiv, "sjekkliste");
    expect(avsender.etikettKey).toBe("status.tilBehandling");
    expect(mottaker.etikettKey).toBe("status.tilBehandling");
    expect(avsender.variant).toBe("primary"); // venter
    expect(mottaker.variant).toBe("warning"); // din tur
  });

  it("responded: utfører ser «Besvart – til godkjenning», godkjenner ser «Til godkjenning»", () => {
    const utforer = perspektivEtikett("responded", venter, "sjekkliste");
    const godkjenner = perspektivEtikett("responded", godkjennerMedBall, "sjekkliste");
    expect(utforer.etikettKey).toBe("status.besvartTilGodkjenning");
    expect(godkjenner.etikettKey).toBe("status.tilGodkjenning");
  });

  it("rejected: utfører «Til utbedring» (warning) ≠ godkjenner «Til revisjon» (primary)", () => {
    const utforer = perspektivEtikett("rejected", aktiv, "sjekkliste");
    const godkjenner = perspektivEtikett("rejected", godkjennerUtenBall, "sjekkliste");
    expect(utforer.etikettKey).toBe("status.tilUtbedring");
    expect(utforer.variant).toBe("warning");
    expect(godkjenner.etikettKey).toBe("status.tilRevisjon");
    expect(godkjenner.variant).toBe("primary");
  });
});

describe("perspektivEtikett — oppgave og godkjenning deler base-matrisen", () => {
  it.each(["oppgave", "godkjenning"] as const)("%s = sjekkliste for received/aktiv", (type) => {
    const sjekk = perspektivEtikett("received", aktiv, "sjekkliste");
    const annen = perspektivEtikett("received", aktiv, type);
    expect(annen.etikettKey).toBe(sjekk.etikettKey);
    expect(annen.variant).toBe(sjekk.variant);
  });
});

describe("kvitteringEtikett — nøklet på HANDLING, én rad per tekstNoekkel (Del 1b)", () => {
  // Alle distinkte tekstNoekkel i statusHandlinger.ts som går via onEndreStatus
  // (handling.slett går via onSlett → ingen kvittering).
  const rader: Array<[string, string, BadgeVariant]> = [
    ["handling.send", "kvittering.sendt", "primary"],
    ["statushandling.besvar", "kvittering.besvart", "primary"],
    ["handling.godkjenn", "kvittering.godkjent", "success"],
    ["statushandling.sendTilbake", "kvittering.sendtTilbake", "warning"],
    ["statushandling.sendTilbakeUtforer", "kvittering.sendtTilbake", "warning"],
    ["statushandling.videresend", "kvittering.videresendt", "primary"],
    ["handling.avvis", "kvittering.avvist", "danger"],
    ["statushandling.trekkTilbake", "kvittering.trukketTilbake", "default"],
    ["statushandling.gjenoppta", "kvittering.gjenopptatt", "primary"],
    ["statushandling.gjenapne", "kvittering.gjenapnet", "primary"],
    ["handling.lukk", "kvittering.lukket", "success"],
  ];
  it.each(rader)("%s → %s / %s", (handling, etikettKey, variant) => {
    expect(kvitteringEtikett(handling)).toEqual({ etikettKey, variant });
  });

  // Kollisjonene som var mulige ved status-nøkling — nå umulige:
  it("«Send» og «Send tilbake» (begge nyStatus=sent) gir ULIK kvittering", () => {
    expect(kvitteringEtikett("handling.send")?.etikettKey).toBe("kvittering.sendt");
    expect(kvitteringEtikett("statushandling.sendTilbake")?.etikettKey).toBe("kvittering.sendtTilbake");
    expect(kvitteringEtikett("handling.send")).not.toEqual(kvitteringEtikett("statushandling.sendTilbake"));
  });
  it("«Avvis» og «Trekk tilbake» (begge nyStatus=cancelled) gir ULIK kvittering", () => {
    expect(kvitteringEtikett("handling.avvis")?.etikettKey).toBe("kvittering.avvist");
    expect(kvitteringEtikett("statushandling.trekkTilbake")?.etikettKey).toBe("kvittering.trukketTilbake");
    expect(kvitteringEtikett("handling.avvis")).not.toEqual(kvitteringEtikett("statushandling.trekkTilbake"));
  });

  it("handling.slett (→ onSlett) og ukjent handling → null", () => {
    expect(kvitteringEtikett("handling.slett")).toBeNull();
    expect(kvitteringEtikett("noe_annet")).toBeNull();
  });
});

describe("utledPerspektiv — registrator dominerer ballinnehav", () => {
  it("registrator med ballen → registrator (ikke aktiv)", () => {
    expect(utledPerspektiv({ rolle: "registrator", harBallen: true })).toBe("registrator");
  });
  it("null rolle uten ball → venter", () => {
    expect(utledPerspektiv({ rolle: null, harBallen: false })).toBe("venter");
  });
  it("null rolle med ball → aktiv", () => {
    expect(utledPerspektiv({ rolle: null, harBallen: true })).toBe("aktiv");
  });
});
