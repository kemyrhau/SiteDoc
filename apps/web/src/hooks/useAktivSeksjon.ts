"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useNavigasjon, type Seksjon } from "@/kontekst/navigasjon-kontekst";

const seksjonMap: Record<string, Seksjon> = {
  sjekklister: "sjekklister",
  oppgaver: "oppgaver",
  maler: "maler",
  tegninger: "tegninger",
  punktskyer: "punktskyer",
  bilder: "bilder",
  entrepriser: "entrepriser",
  mapper: "mapper",
  oppsett: "oppsett",
};

export function useAktivSeksjon(): Seksjon {
  const pathname = usePathname();
  const { aktivSeksjon, setAktivSeksjon } = useNavigasjon();

  useEffect(() => {
    const deler = pathname.split("/").filter(Boolean);
    // URL: /dashbord/[prosjektId]/sjekklister/...
    // deler: ["dashbord", prosjektId, "sjekklister", ...]

    if (deler.includes("oppsett")) {
      setAktivSeksjon("oppsett");
      return;
    }

    // Finn seksjon etter prosjektId (indeks 2 i pathen)
    const seksjonDel = deler[2];
    const seksjon = seksjonDel ? seksjonMap[seksjonDel] : undefined;
    setAktivSeksjon(seksjon ?? "dashbord");
  }, [pathname, setAktivSeksjon]);

  return aktivSeksjon;
}
