import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// ORDRE 36b (spec `dagsoversikt-beskrivelse-spec.md` § 2): dagsoversiktens
// visuelle regler — ingen ikoner, bare grått/amber/hvitt, to skriftstørrelser
// (text-sm/text-base) — og at Slett alltid går via bekreftelsen. Samlesidens
// SummeringsBanner er erstattet av sum-kortet.

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");
const utenKommentarer = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const OVERSIKT = utenKommentarer(les("ProsjektkortDagsoversikt.tsx"));
const HANDLINGER = utenKommentarer(les("RadHandlinger.tsx"));
const SIDE = les("../../../../app/timer/[id]/prosjektkort.tsx");
const KORT = les("../../../../app/timer/[id]/kort/[projectId].tsx");

const flat = (x: string) => x.replace(/\s+/g, " ");
const MATPAUSE_VILKAAR =
  "onPauseToggle && redigerbar && pauseRegelTrigget && radKrysserPause(rad, pauseFra, standardPauseMin)";

/** Avhukingen lukker modalen: en åpen modal ville lagret radens gamle pause-bærer tilbake. */
const MATPAUSE_LUKK = "onToggle: () => { setTimerModal(null); onPauseToggle(";
/** Modalenes slett/lagre skriver mot riktig rad via radLagring. */
const RADLAGRING_KOBLINGER = [
  "fjernTimerRad(db(), k, redigert.id)",
  "fjernMaskinRad(db(), k, maskinModal.id)",
  "oppdaterMaskinRad(db(), k, maskinModal.id",
];

const IKONER = ["lucide", "Pencil", "Split", "Trash2"];
/** Tailwind-fargeklasser som ikke er grå/amber/hvit. */
const fremmedeFarger = (kilde: string) =>
  [...kilde.matchAll(/\b(?:text|bg|border|border-l)-([a-z]+)-\d{2,3}\b/g)]
    .map((m) => m[1])
    .filter((f) => f !== "gray" && f !== "amber");
const skriftbrudd = (kilde: string) => kilde.match(/text-xs|text-\[|text-lg|text-xl/g) ?? [];

describe("ORDRE 36b — dagsoversiktens kilderegler", () => {
  it("negativkontroll: filene er lest og er de riktige", () => {
    expect(OVERSIKT).toContain("export function ProsjektkortDagsoversikt");
    expect(HANDLINGER).toContain("export function RadHandlinger");
    expect(fremmedeFarger('className="text-blue-700"')).toEqual(["blue"]);
    expect(skriftbrudd('className="text-xs"')).toEqual(["text-xs"]);
  });

  it.each(IKONER)("🔴 dagsoversikten og rad-handlingene bruker ikke «%s»", (ikon) => {
    // Ordgrense: «SplittRadModal» er modalen, ikke lucide-ikonet «Split».
    const ord = new RegExp(`\\b${ikon}\\b`);
    expect(OVERSIKT).not.toMatch(ord);
    expect(HANDLINGER).not.toMatch(ord);
  });

  it("🔴 dagsoversikten bruker bare grått, amber og hvitt", () => {
    expect(fremmedeFarger(OVERSIKT)).toEqual([]);
  });

  it("🔴 to skriftstørrelser: ingen text-xs, text-[…], text-lg eller text-xl", () => {
    expect(skriftbrudd(OVERSIKT)).toEqual([]);
  });

  it("🔴 Slett går via bekreftelsen — onSlett kalles kun fra bekreft-knappen", () => {
    const flat = HANDLINGER.replace(/\s+/g, " ");
    expect(flat.match(/handlinger\.onSlett\(\)/g)?.length).toBe(1);
    expect(flat).not.toContain("onPress={handlinger.onSlett}");
    expect(flat).toContain("onPress={() => setBekreft(true)}");
    // 36c-kort: modalen er løftet til den delte BekreftSlettModal.
    expect(flat.indexOf("<BekreftSlettModal")).toBeGreaterThan(-1);
    const bekreft = flat.slice(flat.indexOf("<BekreftSlettModal"));
    expect(bekreft).toContain("onBekreft={() => { setBekreft(false); handlinger.onSlett(); }}");
  });

  it("🔴 samlesiden har ikke SummeringsBanner eller ProsjektkortSamleside; begge sider bruker dagsoversikten", () => {
    expect(SIDE).not.toContain("SummeringsBanner");
    expect(SIDE).not.toContain("ProsjektkortSamleside");
    expect(SIDE).toContain("<ProsjektkortDagsoversikt");
    expect(KORT).toContain("<ProsjektkortDagsoversikt");
    expect(KORT).toMatch(/<ProsjektkortDagsoversikt\s+enkeltProsjekt/);
  });

  it("🔴 én skrivesti: kortskjermen = KortHode + oversikt, uten ProsjektGruppe", () => {
    expect(KORT).not.toContain("ProsjektGruppe");
    expect(KORT.split("<KortHode").length - 1).toBe(1);
    expect(KORT.indexOf("<KortHode")).toBeLessThan(KORT.indexOf("<ProsjektkortDagsoversikt"));
  });

  it("🔴 matpause flyttet til rad-modalen — ingen funksjon fjernet", () => {
    expect(KORT).toContain("onPauseToggle={handterPauseToggle}");
    expect(KORT).toContain("<BekreftFjernMatpauseModal");
    expect(flat(OVERSIKT)).toContain(MATPAUSE_VILKAAR);
    expect(OVERSIKT).toContain("matpause: matpauseFor(redigert)");
    expect(HANDLINGER).toContain("{handlinger.matpause && (");
  });

  it("negativkontroll: droppet matpause-vilkår eller -inngang fanges", () => {
    expect(flat(OVERSIKT.replace("pauseRegelTrigget && radKrysser", "radKrysser"))).not.toContain(MATPAUSE_VILKAAR);
    expect(KORT.replace("onPauseToggle={handterPauseToggle}", "")).not.toContain("onPauseToggle={handterPauseToggle}");
  });

  it("🔴 matpause-avhukingen lukker rad-modalen før flyttet skrives", () => {
    expect(flat(OVERSIKT)).toContain(MATPAUSE_LUKK);
  });

  it.each(RADLAGRING_KOBLINGER)("🔴 modal → radLagring: «%s»", (kobling) => {
    expect(flat(OVERSIKT)).toContain(kobling);
  });

  it("negativkontroll: åpen modal ved avhuking og feil rad-id mot radLagring fanges", () => {
    expect(flat(OVERSIKT.replace("setTimerModal(null);\n            onPauseToggle(", "onPauseToggle("))).not.toContain(
      MATPAUSE_LUKK,
    );
    for (const kobling of RADLAGRING_KOBLINGER) {
      const id = kobling.includes("redigert") ? "redigert.id" : "maskinModal.id";
      expect(flat(OVERSIKT).replace(kobling, kobling.replace(id, "rad.id"))).not.toContain(kobling);
    }
  });

  it("🔴 dagsoversikten skriver kun via radLagring (ingen db.insert/update/delete direkte)", () => {
    expect(OVERSIKT).not.toMatch(/\.(insert|update|delete)\(/);
    expect(OVERSIKT).toContain('from "./radLagring"');
  });

  it("negativkontroll: slett uten bekreftelse og blå klasse fanges", () => {
    const direkte = HANDLINGER.replace("onPress={() => setBekreft(true)}", "onPress={handlinger.onSlett}");
    expect(direkte.replace(/\s+/g, " ")).toContain("onPress={handlinger.onSlett}");
    expect(fremmedeFarger(OVERSIKT.replace("text-gray-700", "text-blue-700"))).toEqual(["blue"]);
    expect(`${OVERSIKT}\nimport { Trash2 } from "lucide-react-native";`).toMatch(/\bTrash2\b/);
    expect("SplittRadModal").not.toMatch(/\bSplit\b/);
  });

  // ORDRE 36b § 5b — «Flytt raden» i komponentlaget.
  const flyttBlokk = (kilde: string) => {
    const fra = kilde.indexOf("const utforFlytt = async");
    return flat(kilde.slice(fra, kilde.indexOf("\n  };\n", fra)));
  };
  /** Synket vare flyttes på server FØR lokalt, og avbryter ved serverfeil. */
  const vareRekkefolge = (b: string) => {
    const server = b.indexOf("await oppdaterVare.mutateAsync(");
    const avbryt = b.indexOf("setFlyttFeil(t(melding", server);
    const lokal = b.indexOf("flyttVareLokalt(db(), v.id, vareMaal)");
    return server > 0 && avbryt > server && b.indexOf("return;", avbryt) < lokal && lokal > avbryt;
  };
  /** Maskinkapasitet sjekkes før maskin-raden flyttes. */
  const maskinRekkefolge = (b: string) => {
    const brudd = b.indexOf("beregnMaskinBrudd(");
    const avslag = b.indexOf('setFlyttFeil(t("timer.maskin.overstigerArbeid"))');
    const flytt = b.indexOf("flyttMaskinRad(db(), flytt.rad.id, maal)");
    return brudd > 0 && avslag > brudd && flytt > avslag;
  };

  it("🔴 flytt: byggeplass lagres som kortets lagrede verdi (arv = null)", () => {
    expect(flyttBlokk(OVERSIKT)).toContain("byggeplassId: lagretByggeplassForKort(til, sedelKontekst)");
    expect(flyttBlokk(OVERSIKT)).toContain("flyttTimerRad(db(), k, flytt.rad, maal)");
  });

  it("🔴 flytt av synket vare: server først, lokal kun ved suksess; pending/avvist kun lokalt", () => {
    const b = flyttBlokk(OVERSIKT);
    expect(vareRekkefolge(b)).toBe(true);
    expect(b).toContain('if (v.syncStatus !== "pending" && v.syncStatus !== "avvist") {');
  });

  it("🔴 flytt av maskin: kapasitet sjekkes før skriving", () => {
    expect(maskinRekkefolge(flyttBlokk(OVERSIKT))).toBe(true);
  });

  it("negativkontroll: lokal vare-flytt før server, og maskin-flytt før sjekk, fanges", () => {
    const b = flyttBlokk(OVERSIKT);
    const lokalForst = b
      .replace("flyttVareLokalt(db(), v.id, vareMaal);", "")
      .replace("await oppdaterVare.mutateAsync(", "flyttVareLokalt(db(), v.id, vareMaal); await oppdaterVare.mutateAsync(");
    expect(vareRekkefolge(lokalForst)).toBe(false);
    const maskinForst = b
      .replace("flyttMaskinRad(db(), flytt.rad.id, maal);", "")
      .replace("const brudd = beregnMaskinBrudd(", "flyttMaskinRad(db(), flytt.rad.id, maal); const brudd = beregnMaskinBrudd(");
    expect(maskinRekkefolge(maskinForst)).toBe(false);
  });

  it("🔴 RETUR 4: varer bruker kortets EFFEKTIVE byggeplass — ikke lagret (null = arv)", () => {
    const b = flyttBlokk(OVERSIKT);
    expect(b).toContain("const vareMaal: FlyttMaal = { ...maal, byggeplassId: vareByggeplassForKort(til) };");
    expect(b).toContain("byggeplassId: vareMaal.byggeplassId,");
    expect(b).not.toContain("byggeplassId: maal.byggeplassId,");
    expect(flat(OVERSIKT)).toContain("kortLaas={{ byggeplassId: vareByggeplassForKort(vareKort), ecoId: vareKort.ecoId }}");
    expect(flat(OVERSIKT)).not.toMatch(/kortLaas=\{\{ byggeplassId: lagretByggeplassForKort/);
  });
});
