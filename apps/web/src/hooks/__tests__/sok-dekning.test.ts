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
import { dypeSider } from "@/components/layout/dype-sider";

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
