import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { eq, or, and, lt } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hentDatabase } from "../db/database";
import { opplastingsKo, sjekklisteFeltdata, oppgaveFeltdata } from "../db/schema";
import { lastOppFil } from "../services/opplasting";
import { slettLokaltBilde } from "../services/lokalBilde";
import { registrerBildeIDatabase } from "../services/bildeRegistrering";
import { useNettverk } from "./NettverkProvider";
import { AUTH_CONFIG } from "../config/auth";

export interface NyKoOppforing {
  sjekklisteId?: string;
  oppgaveId?: string;
  objektId: string;
  vedleggId: string;
  lokalSti: string;
  filnavn: string;
  mimeType: string;
  filstorrelse?: number;
  gpsLat?: number;
  gpsLng?: number;
  gpsAktivert?: boolean;
}

type OpplastingFullfortCallback = (
  dokumentId: string,
  dokumentType: "sjekkliste" | "oppgave",
  objektId: string,
  vedleggId: string,
  serverUrl: string,
) => void;

interface OpplastingsKoKontekst {
  leggIKo: (oppforing: NyKoOppforing) => Promise<void>;
  ventende: number;
  totalt: number;
  erAktiv: boolean;
  registrerCallback: (cb: OpplastingFullfortCallback) => () => void;
}

const OpplastingsKoContext = createContext<OpplastingsKoKontekst>({
  leggIKo: async () => {},
  ventende: 0,
  totalt: 0,
  erAktiv: false,
  registrerCallback: () => () => {},
});

export function useOpplastingsKo() {
  return useContext(OpplastingsKoContext);
}

const MAKS_FORSOK = 5;

export function OpplastingsKoProvider({ children }: { children: ReactNode }) {
  const { erPaaNettet } = useNettverk();
  const [ventende, settVentende] = useState(0);
  const [totalt, settTotalt] = useState(0);
  const [erAktiv, settErAktiv] = useState(false);
  const prosessererRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef<Set<OpplastingFullfortCallback>>(new Set());

  const oppdaterTellere = useCallback(() => {
    const db = hentDatabase();
    if (!db) return;
    const ventendeRader = db
      .select()
      .from(opplastingsKo)
      .where(
        or(
          eq(opplastingsKo.status, "venter"),
          eq(opplastingsKo.status, "laster_opp"),
          and(
            eq(opplastingsKo.status, "feilet"),
            lt(opplastingsKo.forsok, MAKS_FORSOK),
          ),
        ),
      )
      .all();
    const totaltRader = db.select().from(opplastingsKo).all();
    settVentende(ventendeRader.length);
    settTotalt(totaltRader.length);
  }, []);

  // Initialiser tellere ved mount
  useEffect(() => {
    oppdaterTellere();
  }, [oppdaterTellere]);

  const registrerCallback = useCallback((cb: OpplastingFullfortCallback) => {
    callbacksRef.current.add(cb);
    return () => {
      callbacksRef.current.delete(cb);
    };
  }, []);

  const publiserFullfort = useCallback(
    (dokumentId: string, dokumentType: "sjekkliste" | "oppgave", objektId: string, vedleggId: string, serverUrl: string) => {
      for (const cb of callbacksRef.current) {
        cb(dokumentId, dokumentType, objektId, vedleggId, serverUrl);
      }
    },
    [],
  );

  const oppdaterFeltdataVedlegg = useCallback(
    (dokumentId: string, dokumentType: "sjekkliste" | "oppgave", vedleggId: string, serverUrl: string) => {
      const db = hentDatabase();
      if (!db) return;

      // Hent riktig tabell basert på dokumenttype
      const rader = dokumentType === "sjekkliste"
        ? db.select().from(sjekklisteFeltdata).where(eq(sjekklisteFeltdata.sjekklisteId, dokumentId)).all()
        : db.select().from(oppgaveFeltdata).where(eq(oppgaveFeltdata.oppgaveId, dokumentId)).all();

      if (rader.length === 0) return;

      const rad = rader[0]!;
      try {
        const feltVerdier = JSON.parse(rad.feltVerdier) as Record<
          string,
          { vedlegg?: Array<{ id: string; url: string }> }
        >;

        let endret = false;
        for (const feltId of Object.keys(feltVerdier)) {
          const felt = feltVerdier[feltId];

          // Søk i toppnivå-vedlegg
          if (felt?.vedlegg) {
            for (const v of felt.vedlegg) {
              if (v.id === vedleggId) {
                v.url = serverUrl;
                endret = true;
              }
            }
          }

          // Søk i repeater-data (nestet i verdi-arrayen)
          const verdi = (felt as Record<string, unknown> | undefined)?.verdi;
          if (Array.isArray(verdi)) {
            for (const rad of verdi as Record<string, { vedlegg?: Array<{ id: string; url: string }> }>[]) {
              for (const barnId of Object.keys(rad)) {
                const barn = rad[barnId];
                if (!barn?.vedlegg) continue;
                for (const v of barn.vedlegg) {
                  if (v.id === vedleggId) {
                    v.url = serverUrl;
                    endret = true;
                  }
                }
              }
            }
          }
        }

        if (endret) {
          if (dokumentType === "sjekkliste") {
            db.update(sjekklisteFeltdata)
              .set({ feltVerdier: JSON.stringify(feltVerdier), erSynkronisert: false })
              .where(eq(sjekklisteFeltdata.id, rad.id))
              .run();
          } else {
            db.update(oppgaveFeltdata)
              .set({ feltVerdier: JSON.stringify(feltVerdier), erSynkronisert: false })
              .where(eq(oppgaveFeltdata.id, rad.id))
              .run();
          }
        }
      } catch (feil) {
        console.warn("Kunne ikke oppdatere feltdata-vedlegg:", feil);
      }
    },
    [],
  );

  const prosesserNeste = useCallback(async () => {
    console.log("[KØ] prosesserNeste kalt, erPaaNettet:", erPaaNettet, "prosesserer:", prosessererRef.current);
    if (prosessererRef.current || !erPaaNettet) return;
    prosessererRef.current = true;
    settErAktiv(true);

    const db = hentDatabase();
    if (!db) {
      console.log("[KØ] Database ikke tilgjengelig");
      prosessererRef.current = false;
      settErAktiv(false);
      return;
    }

    try {
      // Hent neste oppføring som er klar for opplasting
      const nesteRader = db
        .select()
        .from(opplastingsKo)
        .where(
          or(
            eq(opplastingsKo.status, "venter"),
            and(
              eq(opplastingsKo.status, "feilet"),
              lt(opplastingsKo.forsok, MAKS_FORSOK),
            ),
          ),
        )
        .limit(1)
        .all();

      if (nesteRader.length === 0) {
        console.log("[KØ] Ingen oppføringer i kø");
        prosessererRef.current = false;
        settErAktiv(false);
        return;
      }

      const oppforing = nesteRader[0]!;
      console.log("[KØ] Prosesserer:", oppforing.filnavn, "status:", oppforing.status, "forsøk:", oppforing.forsok, "sti:", oppforing.lokalSti.slice(-50));

      // Sjekk om lokal fil finnes — ellers slett oppføringen (gammel container/avinstallert)
      const { getInfoAsync } = await import("expo-file-system/legacy");
      const filInfo = await getInfoAsync(oppforing.lokalSti);
      console.log("[KØ] Fil finnes:", filInfo.exists, oppforing.lokalSti.slice(-50));
      if (!filInfo.exists) {
        console.log("[KØ] Sletter oppføring — fil mangler");
        db.delete(opplastingsKo)
          .where(eq(opplastingsKo.id, oppforing.id))
          .run();
        oppdaterTellere();
        prosessererRef.current = false;
        prosesserNeste().catch((f) => console.error("[KØ] Rekursiv prosesserNeste feilet:", f));
        return;
      }

      // Marker som pågående
      db.update(opplastingsKo)
        .set({ status: "laster_opp" })
        .where(eq(opplastingsKo.id, oppforing.id))
        .run();
      console.log("[KØ] Starter opplasting til:", `${AUTH_CONFIG.apiUrl}/upload`);

      try {
        const resultat = await lastOppFil(
          oppforing.lokalSti,
          oppforing.filnavn,
          oppforing.mimeType,
        );

        console.log("[KØ] Opplasting vellykket:", resultat.fileUrl);
        // Suksess — oppdater SQLite
        db.update(opplastingsKo)
          .set({
            status: "fullfort",
            serverUrl: resultat.fileUrl,
          })
          .where(eq(opplastingsKo.id, oppforing.id))
          .run();

        // Registrer bildet i server-databasen (images-tabellen)
        registrerBildeIDatabase({
          sjekklisteId: oppforing.sjekklisteId,
          oppgaveId: oppforing.oppgaveId,
          fileUrl: resultat.fileUrl,
          fileName: resultat.fileName,
          fileSize: resultat.fileSize,
          gpsLat: oppforing.gpsLat,
          gpsLng: oppforing.gpsLng,
          gpsAktivert: oppforing.gpsAktivert ?? true,
        }).catch((f) => console.warn("[KØ] Bilderegistrering feilet (ikke-kritisk):", f));

        // Utled dokumenttype og -ID
        const dokumentType = oppforing.oppgaveId ? "oppgave" as const : "sjekkliste" as const;
        const dokumentId = oppforing.oppgaveId ?? oppforing.sjekklisteId ?? "";

        // Oppdater vedlegg-URL i feltdata
        oppdaterFeltdataVedlegg(dokumentId, dokumentType, oppforing.vedleggId, resultat.fileUrl);

        // Publiser til aktive hooks
        publiserFullfort(
          dokumentId,
          dokumentType,
          oppforing.objektId,
          oppforing.vedleggId,
          resultat.fileUrl,
        );

        // Slett lokal fil
        await slettLokaltBilde(oppforing.lokalSti);

        oppdaterTellere();

        // Prosesser neste umiddelbart
        prosessererRef.current = false;
        prosesserNeste().catch((f) => console.error("[KØ] Neste etter suksess feilet:", f));
      } catch (feil) {
        const forsok = (oppforing.forsok ?? 0) + 1;
        const melding = feil instanceof Error ? feil.message : "Ukjent feil";
        console.error("[KØ] Opplasting feilet:", melding, "forsøk:", forsok);

        db.update(opplastingsKo)
          .set({
            status: "feilet",
            forsok,
            feilmelding: melding,
          })
          .where(eq(opplastingsKo.id, oppforing.id))
          .run();

        oppdaterTellere();

        // Eksponentiell backoff: min(2^forsøk * 1000, 30000)ms
        const ventetid = Math.min(Math.pow(2, forsok) * 1000, 30000);
        prosessererRef.current = false;

        timerRef.current = setTimeout(() => {
          prosesserNeste().catch((f) => console.error("[KØ] Retry prosesserNeste feilet:", f));
        }, ventetid);
      }
    } catch (feil) {
      console.error("[KØ] Køprosessering feilet helt:", feil);
      prosessererRef.current = false;
      settErAktiv(false);
    }
  }, [erPaaNettet, oppdaterTellere, oppdaterFeltdataVedlegg, publiserFullfort]);

  // Start/stopp prosessering basert på nettverkstilstand
  useEffect(() => {
    if (erPaaNettet && ventende > 0) {
      prosesserNeste().catch((f) => console.error("[KØ] prosesserNeste feilet i useEffect:", f));
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [erPaaNettet, ventende, prosesserNeste]);

  // Sikkerhetsnett: periodisk re-trigger hvis køen henger
  useEffect(() => {
    if (!erPaaNettet) return;
    const intervall = setInterval(() => {
      if (ventende > 0 && !prosessererRef.current) {
        console.log("[KØ] Sikkerhetsnett: re-trigger prosessering, ventende:", ventende);
        prosesserNeste().catch((f) => console.error("[KØ] Sikkerhetsnett feilet:", f));
      }
    }, 15000);
    return () => clearInterval(intervall);
  }, [erPaaNettet, ventende, prosesserNeste]);

  const leggIKo = useCallback(
    async (oppforing: NyKoOppforing) => {
      const db = hentDatabase();
      if (!db) {
        console.error("[KØ] Database ikke tilgjengelig i leggIKo");
        return;
      }

      console.log("[KØ] Legger i kø:", oppforing.filnavn, "sjekkliste:", oppforing.sjekklisteId, "oppgave:", oppforing.oppgaveId, "sti:", oppforing.lokalSti.slice(-50));
      try {
        db.insert(opplastingsKo)
          .values({
            id: randomUUID(),
            sjekklisteId: oppforing.sjekklisteId ?? null,
            oppgaveId: oppforing.oppgaveId ?? null,
            objektId: oppforing.objektId,
            vedleggId: oppforing.vedleggId,
            lokalSti: oppforing.lokalSti,
            filnavn: oppforing.filnavn,
            mimeType: oppforing.mimeType,
            filstorrelse: oppforing.filstorrelse ?? null,
            gpsLat: oppforing.gpsLat ?? null,
            gpsLng: oppforing.gpsLng ?? null,
            gpsAktivert: oppforing.gpsAktivert ?? false,
            status: "venter",
            forsok: 0,
            opprettet: Date.now(),
          })
          .run();
        console.log("[KØ] Insert OK for", oppforing.filnavn);
      } catch (feil) {
        console.error("[KØ] SQLite INSERT feilet:", feil, "sjekklisteId:", oppforing.sjekklisteId, "oppgaveId:", oppforing.oppgaveId);
        return;
      }

      oppdaterTellere();

      // Start prosessering hvis online
      if (erPaaNettet && !prosessererRef.current) {
        console.log("[KØ] Starter prosessering direkte fra leggIKo");
        prosesserNeste().catch((f) => console.error("[KØ] prosesserNeste feilet fra leggIKo:", f));
      } else {
        console.log("[KØ] Prosessering ikke startet — erPaaNettet:", erPaaNettet, "prosesserer:", prosessererRef.current);
      }
    },
    [erPaaNettet, oppdaterTellere, prosesserNeste],
  );

  return (
    <OpplastingsKoContext.Provider
      value={{ leggIKo, ventende, totalt, erAktiv, registrerCallback }}
    >
      {children}
    </OpplastingsKoContext.Provider>
  );
}
