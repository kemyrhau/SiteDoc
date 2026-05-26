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
  sok: "sok",
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
    const seksjon = seksjonDel ? seksjonMap[seksjonDel] : undefined;
    setAktivSeksjon(seksjon ?? "dashbord");
  }, [pathname, setAktivSeksjon]);

  return aktivSeksjon;
}
