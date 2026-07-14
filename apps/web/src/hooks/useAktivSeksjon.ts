"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useNavigasjon, type Seksjon } from "@/kontekst/navigasjon-kontekst";

const seksjonMap: Record<string, Seksjon> = {
  sjekklister: "sjekklister",
  oppgaver: "oppgaver",
  hms: "hms",
  maler: "maler",
  tegninger: "tegninger",
  punktskyer: "3d-visning",
  modeller: "3d-visning",
  "3d-visning": "3d-visning",
  "tegning-3d": "tegning-3d",
  bilder: "bilder",
  faggrupper: "faggrupper",
  mapper: "mapper",
  okonomi: "okonomi",
  kontrollplan: "kontrollplan",
  sok: "sok",
  psi: "psi",
  mannskap: "mannskap",
  kontakter: "kontakter",
  timer: "timer",
  vareforbruk: "vareforbruk",
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

    // Firmamodul på toppnivå: /dashbord/maskin/...
    if (deler[1] === "maskin") {
      setAktivSeksjon("maskin");
      return;
    }

    // Personlig snarvei: /dashbord/timer/mine
    if (deler[1] === "timer" && deler[2] === "mine") {
      setAktivSeksjon("mine-timer");
      return;
    }

    // Finn seksjon etter prosjektId (indeks 2 i pathen)
    const seksjonDel = deler[2];
    // Spesialfall: /timer/attestering er egen seksjon
    if (seksjonDel === "timer" && deler[3] === "attestering") {
      setAktivSeksjon("timer-attestering");
      return;
    }
    // Dashbord er aktiv KUN på prosjekt-/dashbord-roten (ingen seksjon-segment).
    // Et segment som mangler i seksjonMap skal ikke lyse Dashbord falskt — det
    // var rotårsaken til at PSI/Kontrollplan viste Dashbord som aktiv (begge
    // manglet i mappet). Vakten gjør intensjonen eksplisitt.
    if (!seksjonDel) {
      setAktivSeksjon("dashbord");
      return;
    }
    setAktivSeksjon(seksjonMap[seksjonDel] ?? "dashbord");
  }, [pathname, setAktivSeksjon]);

  return aktivSeksjon;
}
