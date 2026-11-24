"use client";

import { Suspense, createElement, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { erProsjektetsTimer, gyldigRetur } from "@/lib/tilbake-adresse";
import { useNavigasjon, type Seksjon } from "@/kontekst/navigasjon-kontekst";

const seksjonMap: Record<string, Seksjon> = {
  sjekklister: "sjekklister",
  oppgaver: "oppgaver",
  hms: "hms",
  // "maler"-segmentet fjernet: Rapportmaler-flata er borte (vei b, 2026-09-12). URL-en
  // redirecter til Oppsett, som treffer oppsett-grenen over — ingen egen seksjon her.
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
  // w14 (B40 A): på en dag (eller «Ny dagsseddel») bestemmer `?retur` hva som lyser.
  const retur = gyldigRetur(useSearchParams().get("retur"));
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

    // w14 (B40 A): dagen (/dashbord/timer/<id>) og «Ny dagsseddel» (/dashbord/timer/ny).
    // Kom brukeren fra prosjektets Timer, lyser «Timer»; ellers «mine-timer», som ikke står i
    // sidemenyen — ingenting lyser. «Dashbord» skal aldri lyse her.
    if (deler[1] === "timer" && deler[2]) {
      setAktivSeksjon(retur && erProsjektetsTimer(retur) ? "timer" : "mine-timer");
      return;
    }

    // Finn seksjon etter prosjektId (indeks 2 i pathen)
    const seksjonDel = deler[2];
    // Dashbord er aktiv KUN på prosjekt-/dashbord-roten (ingen seksjon-segment).
    // Et segment som mangler i seksjonMap skal ikke lyse Dashbord falskt — det
    // var rotårsaken til at PSI/Kontrollplan viste Dashbord som aktiv (begge
    // manglet i mappet). Vakten gjør intensjonen eksplisitt.
    if (!seksjonDel) {
      setAktivSeksjon("dashbord");
      return;
    }
    setAktivSeksjon(seksjonMap[seksjonDel] ?? "dashbord");
  }, [pathname, retur, setAktivSeksjon]);

  return aktivSeksjon;
}

function Sporer(): null {
  useAktivSeksjon();
  return null;
}

/**
 * w14: kroken leser `?retur` med `useSearchParams`, som krever en Suspense-grense ved statisk
 * bygg (Next 14). Derfor kalles den ett sted i rammen, her, og NavSidebar/Toppbar leser
 * seksjonen fra `useNavigasjon()`. Rendres i `dashbord/layout.tsx`.
 */
export function AktivSeksjonSporer() {
  return createElement(Suspense, { fallback: null }, createElement(Sporer));
}
