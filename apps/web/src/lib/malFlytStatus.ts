// Delt flyt-status for en sjekklistemal FØR «opprett/start»-klikk.
//
// Regelen for HVILKE flyter en mal kan opprettes i (opprettbareFlytIder) kommer fra
// SERVEREN (mal.hentForProsjekt — samme kilde som opprett-valideringen). Denne modulen
// gjør bare klient-presentasjonen: kobler opprettbareFlytIder til flyt-detaljer og
// avgjør én/flere/ingen. Delt av sjekkliste-opprettelsen og kontrollplanens «Start»,
// så de aldri drifter fra hverandre (MalVelger-mønsteret: én flyt → null klikk).

export interface FlytKandidat {
  flytId: string;
  flytNavn: string;
  bestillerFaggruppeId: string;
  utforerFaggruppeId: string;
  oppretterNavn: string;
  utforerNavn: string;
}

// Flyt-status for en mal FØR klikk (styrer kort/knapp + klikk-oppførsel).
export type MalFlytStatus =
  | { type: "en"; kandidat: FlytKandidat }
  | { type: "flere"; kandidater: FlytKandidat[] }
  | { type: "ingen"; grunn: "ingenFlytMedMal" | "flytManglerFaggruppe" };

export interface MalMedFlytIder {
  id: string;
  opprettbareFlytIder?: string[];
}

export interface DokumentflytForStatus {
  id: string;
  name: string;
  faggruppeId: string | null;
  faggruppe?: { id: string; name: string } | null;
  medlemmer: Array<{ faggruppe?: { id: string; name?: string } | null; rolle: string }>;
}

// Bygger flyt-status per mal-id. Kandidatene utleder bestiller (flytens eier-faggruppe)
// og utfører (flytens utfører-medlem, fallback eier) — identisk med opprettMedKandidat
// i sjekklister/page.tsx, så «Start» treffer nøyaktig samme opprettelsesvei.
export function byggMalFlytStatus(
  maler: MalMedFlytIder[],
  dokumentflyter: DokumentflytForStatus[],
): Map<string, MalFlytStatus> {
  const dfById = new Map(dokumentflyter.map((df) => [df.id, df]));
  const map = new Map<string, MalFlytStatus>();
  for (const mal of maler) {
    const kandidater: FlytKandidat[] = (mal.opprettbareFlytIder ?? [])
      .map((id) => dfById.get(id))
      .filter((df): df is DokumentflytForStatus => !!df && df.faggruppeId != null)
      .map((df) => {
        const utforer = df.medlemmer.find((m) => m.rolle === "utforer");
        return {
          flytId: df.id,
          flytNavn: df.name,
          bestillerFaggruppeId: df.faggruppeId!,
          utforerFaggruppeId: utforer?.faggruppe?.id ?? df.faggruppeId!,
          oppretterNavn: df.faggruppe?.name ?? "—",
          utforerNavn: utforer?.faggruppe?.name ?? df.faggruppe?.name ?? "—",
        };
      });
    if (kandidater.length === 0) {
      map.set(mal.id, { type: "ingen", grunn: "ingenFlytMedMal" });
    } else if (kandidater.length === 1) {
      map.set(mal.id, { type: "en", kandidat: kandidater[0]! });
    } else {
      map.set(mal.id, { type: "flere", kandidater });
    }
  }
  return map;
}
