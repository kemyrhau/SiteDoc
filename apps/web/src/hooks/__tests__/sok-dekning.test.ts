import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { HUB_RUTER } from "@/lib/hub-ruter";
import {
  hovedelementer,
  kontakterElement,
  hrefForSidebarElement,
} from "@/components/layout/sidebar-elementer";
import { firmaNavElementer } from "@/components/layout/firma-nav";
import { dypeSider, gateDypeSider } from "@/components/layout/dype-sider";
import { matchScore, normaliserSok } from "@sitedoc/shared";
import nb from "../../../../../packages/shared/src/i18n/nb.json";

/**
 * K13 dekningstest (F3-vern). Verifiserer at HVER navigerbar `page.tsx` under
 * `/dashbord` enten er dekket av en søkekilde (samme kilder som `useSokRegistry`
 * konsumerer) ELLER står i unntakslista med en grunn.
 *
 * En ny side som verken dekkes eller ekskluderes → testen FEILER og tvinger en
 * bevisst beslutning (legg i en kilde, eller i unntakslista med grunn). Samme
 * feilklasse som F3 skal ikke kunne gjenoppstå stille.
 */

const PID = "[prosjektId]";
const APP_DIR = resolve(__dirname, "../../app");

/** Rekursiv fs-walk → alle ruter (dir uten /page.tsx) under /dashbord. */
function diskRuter(): string[] {
  const ruter: string[] = [];
  function walk(dir: string, rutePrefiks: string) {
    for (const navn of readdirSync(dir)) {
      const full = join(dir, navn);
      if (!statSync(full).isDirectory()) {
        if (navn === "page.tsx") ruter.push(rutePrefiks || "/");
        continue;
      }
      // Hopp over route-grupper `(x)` — de er ikke egne URL-segmenter.
      const segment = navn.startsWith("(") && navn.endsWith(")") ? "" : `/${navn}`;
      walk(full, rutePrefiks + segment);
    }
  }
  walk(join(APP_DIR, "dashbord"), "/dashbord");
  return ruter;
}

/** Dekket-sett — speiler nøyaktig kildene `useSokRegistry` itererer. */
function dekketSett(): Set<string> {
  const s = new Set<string>();
  s.add("/dashbord"); // sidebar `dashbord` uten prosjekt
  s.add("/dashbord/innstillinger"); // hub-roten (inn:hub-treff)
  for (const r of HUB_RUTER) s.add(r);
  for (const el of [...hovedelementer, kontakterElement]) {
    const href = hrefForSidebarElement(el, PID);
    if (href) s.add(href);
  }
  for (const el of firmaNavElementer) s.add(el.href);
  for (const side of dypeSider) {
    const href = side.href(PID);
    if (href) s.add(href);
  }
  return s;
}

/**
 * Unntaksliste — bevisst utenfor søk. Hver rad har en grunn. Rekkefølge:
 * dekket-sjekk går FØRST, så `/dashbord/[prosjektId]` (dekket) treffes ikke av
 * detalj-predikatet under.
 */
const UNNTAK: { test: (r: string) => boolean; grunn: string }[] = [
  { test: (r) => r === "/dashbord/oppsett", grunn: "landing erstattet av hub (nyNav)" },
  { test: (r) => r === "/dashbord/oppsett/produksjon", grunn: "parent-node (O3)" },
  { test: (r) => r === "/dashbord/oppsett/produksjon/kontakter", grunn: "redirect → dokumentflyt (K6/O5)" },
  { test: (r) => r === "/dashbord/[prosjektId]/timer/godkjenning", grunn: "redirect → attestering (P27)" },
  { test: (r) => r === "/dashbord/[prosjektId]/maler", grunn: "redirect → oppsett/produksjon/sjekklistemaler (Rapportmaler-flata fjernet, vei b 2026-09-12)" },
  { test: (r) => r === "/dashbord/firma/timer/onboarding", grunn: "redirect → firma/timer (innhold flyttet til timer-hjem)" },
  { test: (r) => r === "/dashbord/firma/oppsett", grunn: "firma-onboarding-veiviser (handling-flate, nås via banner på /dashbord/firma + kom-i-gang; forsvinner når fullført)" },
  { test: (r) => r === "/dashbord/[prosjektId]/dokumentleser", grunn: "reader uten nav-hjem — ekskludert v1 (K13-d)" },
  { test: (r) => r === "/dashbord/[prosjektId]/dokumenter/[dokumentId]/les", grunn: "per-dok reader (detalj)" },
  { test: (r) => r === "/dashbord/[prosjektId]/modeller" || r === "/dashbord/[prosjektId]/punktskyer", grunn: "K4 3D-konsolidering (utsatt)" },
  { test: (r) => r === "/dashbord/nytt-prosjekt", grunn: "opprett-handling (K13-c)" },
  { test: (r) => r.startsWith("/dashbord/prosjekter"), grunn: "K9 legacy prosjekt-tre (redirect)" },
  { test: (r) => r.startsWith("/dashbord/admin"), grunn: "K11 admin-redesign (utsatt)" },
  // Mekaniske kategorier:
  { test: (r) => /\/\[[^\]]+\]$/.test(r), grunn: "detaljside (dynamisk [id])" },
  { test: (r) => /\/(ny|nytt)$/.test(r), grunn: "opprett-side (K13-c)" },
  { test: (r) => /\/skriv-ut$/.test(r), grunn: "utskrift" },
];

describe("K13 — søkedekning", () => {
  const disk = diskRuter();
  const dekket = dekketSett();

  it("hver /dashbord-rute er dekket av søk eller står i unntakslista med grunn", () => {
    const udekket = disk.filter(
      (r) => !dekket.has(r) && !UNNTAK.some((u) => u.test(r)),
    );
    expect(
      udekket,
      `Ruter uten søkedekning og uten unntak:\n${udekket.join("\n")}\n` +
        `→ legg i en søkekilde (hub/sidebar/firma-nav/dypeSider) eller i UNNTAK med grunn.`,
    ).toEqual([]);
  });

  it("ingen dekket rute peker på en ikke-eksisterende side (fanger typo i kilde)", () => {
    const diskSett = new Set(disk);
    const manuelle = new Set(["/dashbord", "/dashbord/innstillinger"]);
    const foreldreløse = [...dekket].filter(
      (r) => !manuelle.has(r) && !diskSett.has(r),
    );
    expect(
      foreldreløse,
      `Søkekilde peker på ruter som ikke finnes på disk:\n${foreldreløse.join("\n")}`,
    ).toEqual([]);
  });
});

/**
 * TILLEGG 1 (ordre malarkiv-ut-av-sidefelt) Krav 3 — negativ kontroll, tre arkivnivåer.
 * Alle tre skal være SØKBARE, men firma-/SiteDoc-arkivet skal være GATET: en vanlig
 * prosjektbruker skal ikke finne dem. «Samme antall for begge brukertyper = gating død.»
 */
describe("TILLEGG 1 — arkiv-søk gating (negativ kontroll)", () => {
  const FIRMA = "/dashbord/firma/malarkiv";
  const SITEDOC = "/dashbord/firma/innstillinger/malforvaltning";
  const hrefs = (sider: typeof dypeSider) => sider.map((s) => s.href(null));

  it("SiteDoc-admin ser BÅDE firmaarkiv og SiteDoc-arkiv i dype-sider", () => {
    const synlige = hrefs(
      gateDypeSider(dypeSider, {
        prosjektId: "p1",
        kanAdministrereFirma: true,
        erSitedocAdmin: true,
        firmamoduler: [],
      }),
    );
    expect(synlige).toContain(FIRMA);
    expect(synlige).toContain(SITEDOC);
  });

  it("vanlig prosjektbruker ser HVERKEN firmaarkiv ELLER SiteDoc-arkiv (gating lever)", () => {
    const synlige = hrefs(
      gateDypeSider(dypeSider, {
        prosjektId: "p1",
        kanAdministrereFirma: false,
        erSitedocAdmin: false,
        firmamoduler: [],
      }),
    );
    expect(synlige).not.toContain(FIRMA);
    expect(synlige).not.toContain(SITEDOC);
  });

  it("firma-admin uten sitedoc ser firmaarkivet, men IKKE SiteDoc-arkivet", () => {
    const synlige = hrefs(
      gateDypeSider(dypeSider, {
        prosjektId: "p1",
        kanAdministrereFirma: true,
        erSitedocAdmin: false,
        firmamoduler: [],
      }),
    );
    expect(synlige).toContain(FIRMA);
    expect(synlige).not.toContain(SITEDOC);
  });

  it("gatingen gir FÆRRE treff for prosjektbruker enn for admin (ikke død)", () => {
    const admin = gateDypeSider(dypeSider, {
      prosjektId: "p1", kanAdministrereFirma: true, erSitedocAdmin: true, firmamoduler: [],
    }).length;
    const bruker = gateDypeSider(dypeSider, {
      prosjektId: "p1", kanAdministrereFirma: false, erSitedocAdmin: false, firmamoduler: [],
    }).length;
    expect(admin).toBeGreaterThan(bruker);
  });

  it("søk på «arkiv» treffer alle tre nivåene (etiketter/sokeord bærer «arkiv»)", () => {
    const q = normaliserSok("arkiv");
    // Firma + SiteDoc: etiketten selv bærer «arkiv».
    expect(matchScore(normaliserSok(nb["sok.firmaarkiv"]), q)).toBeGreaterThan(0);
    expect(matchScore(normaliserSok(nb["sok.sitedocArkiv"]), q)).toBeGreaterThan(0);
    // Prosjekt: bor i hub-kilden (har nav-hjem), «arkiv» via sokeord på malkortet.
    expect(matchScore(normaliserSok(nb["innstillinger.sokeord.maler"]), q)).toBeGreaterThan(0);
  });
});
