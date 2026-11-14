import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// Firmalekkasje-vakt (2026-11-14): endepunktene under tar `organizationId` som
// VALGFRI input og faller tilbake på brukerens EGET firma når den mangler
// (`resolverOrgFraInput` → `krevBrukersOrg`). En firmaadmin-flate som viser et
// valgt firma (`useFirma().valgtFirma`) eller en sedel fra et bestemt firma MÅ
// derfor sende firma-ID — ellers viser nedtrekket lønnsartene til innlogget
// brukers firma, mens lagringen skjer på det valgte firmaet.
// Funn: reise-lønnsart i firma-innstillinger viste SITEDOC MYRHAUGs lønnsarter
// når Testfirma var valgt. Se docs/claude/sikkerhet.md § 8o.

const ENDEPUNKTER = [
  "timer.lonnsart.list",
  "timer.aktivitet.list",
  "timer.tillegg.list",
  "timer.expenseCategory.list",
  "timer.onboarding.status",
  "kompetansetype.hentAlle",
  "maskin.equipment.list",
] as const;

const SRC = fileURLToPath(new URL("..", import.meta.url));

/** Firmaadmin-flatene + attesterings-/redigeringskomponentene som viser et valgt firma. */
const RØTTER = ["app/dashbord/firma", "components/timer", "components/attestering"];

function alleFiler(dir: string): string[] {
  return readdirSync(dir).flatMap((navn) => {
    const sti = join(dir, navn);
    if (statSync(sti).isDirectory()) return navn === "__tests__" ? [] : alleFiler(sti);
    return /\.tsx?$/.test(navn) ? [sti] : [];
  });
}

/** Argumentteksten i `trpc.<ep>.useQuery( … )`, balansert på parenteser. */
function kallArgumenter(kilde: string, ep: string): string[] {
  const nål = `trpc.${ep}.useQuery(`;
  const ut: string[] = [];
  let i = kilde.indexOf(nål);
  while (i !== -1) {
    let dybde = 1;
    let j = i + nål.length;
    for (; j < kilde.length && dybde > 0; j++) {
      if (kilde[j] === "(") dybde++;
      else if (kilde[j] === ")") dybde--;
    }
    ut.push(kilde.slice(i + nål.length, j - 1));
    i = kilde.indexOf(nål, j);
  }
  return ut;
}

/** Kall som ikke sender firma-ID i første argument. */
export function kallUtenFirma(kilde: string): string[] {
  const feil: string[] = [];
  for (const ep of ENDEPUNKTER) {
    for (const arg of kallArgumenter(kilde, ep)) {
      const første = arg.trim();
      // Input i en variabel (`useQuery(input, …)`): slå opp `const input = { … }`.
      const ident = første.match(/^([A-Za-z_]\w*)\s*(,|$)/)?.[1];
      const objekt =
        ident && ident !== "undefined"
          ? (kilde.match(new RegExp(`const ${ident} = (\\{[^}]*\\})`))?.[1] ?? "")
          : første.split("},")[0]!;
      if (!objekt.includes("organizationId")) feil.push(ep);
    }
  }
  return feil;
}

describe("firma-scopede katalogkall sender alltid firma-ID", () => {
  const filer = RØTTER.flatMap((r) => alleFiler(join(SRC, r)));

  it("finner flatene (vakten skanner faktisk noe)", () => {
    const medKall = filer.filter((f) =>
      ENDEPUNKTER.some((ep) => readFileSync(f, "utf-8").includes(`trpc.${ep}.useQuery(`)),
    );
    expect(medKall.length).toBeGreaterThanOrEqual(10);
  });

  for (const fil of filer) {
    const kilde = readFileSync(fil, "utf-8");
    if (!ENDEPUNKTER.some((ep) => kilde.includes(`trpc.${ep}.useQuery(`))) continue;
    it(`${fil.slice(SRC.length)} sender organizationId`, () => {
      expect(kallUtenFirma(kilde)).toEqual([]);
    });
  }

  it("reise-lønnsart i firma-innstillinger henter valgt firmas lønnsarter", () => {
    const kilde = readFileSync(join(SRC, "app/dashbord/firma/innstillinger/page.tsx"), "utf-8");
    const args = kallArgumenter(kilde, "timer.lonnsart.list");
    expect(args.length).toBeGreaterThan(0);
    for (const a of args) expect(a).toContain("organizationId: orgId");
  });

  it("negativkontroll: vakten biter på kall uten argument og med undefined", () => {
    expect(kallUtenFirma("trpc.timer.lonnsart.list.useQuery();")).toEqual(["timer.lonnsart.list"]);
    expect(
      kallUtenFirma("trpc.timer.lonnsart.list.useQuery(undefined, { enabled: !!orgId });"),
    ).toEqual(["timer.lonnsart.list"]);
    expect(
      kallUtenFirma("trpc.timer.tillegg.list.useQuery({ inkluderInaktiv: true }, { enabled: !!organizationId });"),
    ).toEqual(["timer.tillegg.list"]);
    expect(
      kallUtenFirma("trpc.timer.aktivitet.list.useQuery({ organizationId }, { enabled: !!organizationId });"),
    ).toEqual([]);
    expect(
      kallUtenFirma("const input = { organizationId: orgId };\ntrpc.timer.lonnsart.list.useQuery(input, { enabled });"),
    ).toEqual([]);
    expect(
      kallUtenFirma("const input = { inkluderInaktiv: true };\ntrpc.timer.lonnsart.list.useQuery(input, { enabled });"),
    ).toEqual(["timer.lonnsart.list"]);
  });
});
