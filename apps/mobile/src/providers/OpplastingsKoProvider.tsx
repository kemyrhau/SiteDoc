import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { eq, or, and, lt, asc } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hentDatabase } from "../db/database";
import {
  opplastingsKo,
  sjekklisteFeltdata,
  oppgaveFeltdata,
  sheetTilleggVedleggLocal,
  sheetUtleggVedleggLocal,
} from "../db/schema";
import { lastOppFil, OpplastingFeil } from "../services/opplasting";
import { slettLokaltBilde } from "../services/lokalBilde";
import { registrerBildeIDatabase, patchSjekklisteVedleggUrl } from "../services/bildeRegistrering";
import { useNettverk } from "./NettverkProvider";
import { AUTH_CONFIG } from "../config/auth";

export interface NyKoOppforing {
  sjekklisteId?: string;
  oppgaveId?: string;
  // Funn #2: kvittering-vedlegg på tillegg-rad. Additivt — eksisterende kallere
  // (sjekkliste/oppgave) lar feltet stå undefined.
  sheetTilleggId?: string;
  // U4: kvittering-vedlegg på utlegg-rad. Speiler sheetTilleggId.
  sheetUtleggId?: string;
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

// Funn #2: dedikert callback for tillegg-vedlegg (separat fra den typede
// sjekkliste/oppgave-callbacken over) — så UI kan oppdatere «venter på
// opplasting» → opplastet live, uten å røre eksisterende callback-kontrakt.
type TilleggVedleggFullfortCallback = (
  vedleggId: string,
  serverUrl: string,
) => void;

// U4: samme kontrakt for utlegg-vedlegg (egen kanal, samme signatur).
type UtleggVedleggFullfortCallback = (
  vedleggId: string,
  serverUrl: string,
) => void;

interface OpplastingsKoKontekst {
  leggIKo: (oppforing: NyKoOppforing) => Promise<void>;
  ventende: number;
  totalt: number;
  erAktiv: boolean;
  // D: vedleggId-er som har feilet gjentatte ganger — UI viser «prøver fortsatt».
  feilendeVedleggIder: Set<string>;
  // D: antall ikke-fullførte vedlegg pr. dokument (sjekklisteId/oppgaveId).
  ventendePerDokument: Map<string, number>;
  registrerCallback: (cb: OpplastingFullfortCallback) => () => void;
  registrerTilleggVedleggCallback: (
    cb: TilleggVedleggFullfortCallback,
  ) => () => void;
  registrerUtleggVedleggCallback: (
    cb: UtleggVedleggFullfortCallback,
  ) => () => void;
}

const OpplastingsKoContext = createContext<OpplastingsKoKontekst>({
  leggIKo: async () => {},
  ventende: 0,
  totalt: 0,
  erAktiv: false,
  feilendeVedleggIder: new Set(),
  ventendePerDokument: new Map(),
  registrerCallback: () => () => {},
  registrerTilleggVedleggCallback: () => () => {},
  registrerUtleggVedleggCallback: () => () => {},
});

export function useOpplastingsKo() {
  return useContext(OpplastingsKoContext);
}

const MAKS_FORSOK = 5;
// Antall forsøk før et vedlegg regnes som «vedvarende feilende» og blir synlig i UI.
const FEIL_TERSKEL = 3;

export function OpplastingsKoProvider({ children }: { children: ReactNode }) {
  const { erPaaNettet } = useNettverk();
  const [ventende, settVentende] = useState(0);
  const [totalt, settTotalt] = useState(0);
  const [erAktiv, settErAktiv] = useState(false);
  // vedleggId-er som har feilet gjentatte ganger (D — «prøver fortsatt»).
  const [feilendeVedlegg, settFeilendeVedlegg] = useState<Set<string>>(new Set());
  // Ikke-fullførte vedlegg pr. dokument (D — banner + PDF/Send-advarsel).
  const [ventendePerDokument, settVentendePerDokument] = useState<Map<string, number>>(new Map());
  const prosessererRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Head-of-line-fri backoff: oppføring-id → tidspunkt (ms) den tidligst kan
  // forsøkes igjen. En feilende oppføring hoppes over til ventetiden er ute, så
  // de andre i køen slipper fram. In-memory (nullstilles ved reload — greit,
  // reload re-forsøker uansett). Skiller nett-feil (retry uten tak) fra harde.
  const nesteForsokRef = useRef<Map<string, number>>(new Map());
  const callbacksRef = useRef<Set<OpplastingFullfortCallback>>(new Set());
  // Funn #2: dedikert callback-sett for tillegg-vedlegg.
  const tilleggCallbacksRef = useRef<Set<TilleggVedleggFullfortCallback>>(
    new Set(),
  );
  // U4: dedikert callback-sett for utlegg-vedlegg.
  const utleggCallbacksRef = useRef<Set<UtleggVedleggFullfortCallback>>(
    new Set(),
  );

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
    // D (sentinel b): vedlegg som har feilet gjentatte ganger (nett eller hardt)
    // skal bli SYNLIG — «prøver fortsatt», ikke telle i stillhet. Terskel = 3
    // forsøk. Ikke-fullførte rader (venter/laster_opp/feilet) over terskelen.
    const feilende = new Set<string>();
    const perDokument = new Map<string, number>();
    for (const r of ventendeRader) {
      if ((r.forsok ?? 0) >= FEIL_TERSKEL && r.vedleggId) feilende.add(r.vedleggId);
      // Per-dokument-teller (D): brukes til banner + PDF/Send-advarsel på
      // dokumentnivå. Nøkkel = sjekklisteId ELLER oppgaveId.
      const dokId = r.sjekklisteId ?? r.oppgaveId;
      if (dokId) perDokument.set(dokId, (perDokument.get(dokId) ?? 0) + 1);
    }
    settFeilendeVedlegg(feilende);
    settVentendePerDokument(perDokument);
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

  // Funn #2: registrer/avregistrer tillegg-vedlegg-callback (live UI-oppdatering).
  const registrerTilleggVedleggCallback = useCallback(
    (cb: TilleggVedleggFullfortCallback) => {
      tilleggCallbacksRef.current.add(cb);
      return () => {
        tilleggCallbacksRef.current.delete(cb);
      };
    },
    [],
  );

  // Funn #2: skriv server-URL til lokal vedlegg-rad (vedleggId = lokal rad-id)
  // + publiser til aktive tillegg-callbacks.
  const fullforTilleggVedlegg = useCallback(
    (vedleggId: string, serverUrl: string) => {
      const db = hentDatabase();
      if (db) {
        db.update(sheetTilleggVedleggLocal)
          .set({ serverUrl, sistEndretLokalt: Date.now() })
          .where(eq(sheetTilleggVedleggLocal.id, vedleggId))
          .run();
      }
      for (const cb of tilleggCallbacksRef.current) {
        cb(vedleggId, serverUrl);
      }
    },
    [],
  );

  // U4: registrer/avregistrer utlegg-vedlegg-callback (live UI-oppdatering).
  const registrerUtleggVedleggCallback = useCallback(
    (cb: UtleggVedleggFullfortCallback) => {
      utleggCallbacksRef.current.add(cb);
      return () => {
        utleggCallbacksRef.current.delete(cb);
      };
    },
    [],
  );

  // U4: skriv server-URL til lokal utlegg-vedlegg-rad + publiser til callbacks.
  const fullforUtleggVedlegg = useCallback(
    (vedleggId: string, serverUrl: string) => {
      const db = hentDatabase();
      if (db) {
        db.update(sheetUtleggVedleggLocal)
          .set({ serverUrl, sistEndretLokalt: Date.now() })
          .where(eq(sheetUtleggVedleggLocal.id, vedleggId))
          .run();
      }
      for (const cb of utleggCallbacksRef.current) {
        cb(vedleggId, serverUrl);
      }
    },
    [],
  );

  // Returnerer `true` hvis server-URL-en faktisk ble skrevet inn i SQLite-blobben
  // for dette vedlegget. Kalleren gater sletting av lokalfila på dette (SQLite
  // overlever ikke reinstall, men er den kilden visningen leser samme-install, og
  // et `false` betyr at korreksjonen ikke landet noe sted lokalt).
  const oppdaterFeltdataVedlegg = useCallback(
    (dokumentId: string, dokumentType: "sjekkliste" | "oppgave", vedleggId: string, serverUrl: string): boolean => {
      const db = hentDatabase();
      if (!db) return false;

      // Hent riktig tabell basert på dokumenttype
      const rader = dokumentType === "sjekkliste"
        ? db.select().from(sjekklisteFeltdata).where(eq(sjekklisteFeltdata.sjekklisteId, dokumentId)).all()
        : db.select().from(oppgaveFeltdata).where(eq(oppgaveFeltdata.oppgaveId, dokumentId)).all();

      if (rader.length === 0) return false;

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
            for (const raaRad of verdi as Array<Record<string, unknown>>) {
              // Rad-id (2026-08-22): ny form { _radId, felter } eller gammel naken Record.
              // Muterer vedlegg-url IN PLACE → hent det faktiske felt-map-objektet i begge former.
              const rad = (raaRad && typeof raaRad === "object" && "felter" in raaRad
                ? (raaRad as { felter: unknown }).felter
                : raaRad) as Record<string, { vedlegg?: Array<{ id: string; url: string }> }>;
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
        return endret;
      } catch (feil) {
        console.warn("Kunne ikke oppdatere feltdata-vedlegg:", feil);
        return false;
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
      // Kandidater: 'venter' (inkl. nett-feilede, som settes tilbake til venter)
      // ELLER 'feilet' under taket (harde feil). Sortert på forsøk stigende, så
      // ferske oppføringer går FØRST og en gjentatt-feilende sakker bakover
      // (head-of-line-fri). Hent flere så vi kan hoppe over dem i backoff.
      const kandidater = db
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
        .orderBy(asc(opplastingsKo.forsok))
        .limit(25)
        .all();

      const naa = Date.now();
      const oppforing = kandidater.find(
        (k) => (nesteForsokRef.current.get(k.id) ?? 0) <= naa,
      );

      if (!oppforing) {
        // Ingen klar akkurat nå: enten tom kø, eller alle i backoff.
        prosessererRef.current = false;
        settErAktiv(kandidater.length > 0);
        if (kandidater.length > 0) {
          const tidligste = Math.min(
            ...kandidater.map((k) => nesteForsokRef.current.get(k.id) ?? 0),
          );
          const ventetid = Math.max(500, tidligste - naa);
          console.log(`[KØ] Alle ${kandidater.length} i backoff — planlegger om ${ventetid}ms`);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            prosesserNeste().catch((f) => console.error("[KØ] Backoff-retrigger feilet:", f));
          }, ventetid);
        } else {
          console.log("[KØ] Ingen oppføringer i kø");
          settErAktiv(false);
        }
        return;
      }
      // Rydd backoff-markøren — den settes på nytt bare hvis dette forsøket feiler.
      nesteForsokRef.current.delete(oppforing.id);
      console.log("[KØ] Prosesserer:", oppforing.filnavn, "status:", oppforing.status, "forsøk:", oppforing.forsok, "sti:", oppforing.lokalSti.slice(-50));

      // Sjekk om lokal fil finnes — ellers slett oppføringen (gammel container/avinstallert)
      const { getInfoAsync } = await import("expo-file-system/legacy");
      const filInfo = await getInfoAsync(oppforing.lokalSti);
      console.log("[KØ] Fil finnes:", filInfo.exists, oppforing.lokalSti.slice(-50));
      if (!filInfo.exists) {
        // 🔴 Aldri stille: en forkastet oppføring skal si fra (før var dette en
        // console.log — en batch kunne forsvinne uten spor). Fila finnes ikke,
        // så bildet er uansett tapt for denne oppføringen; vi rydder den bort.
        console.warn(
          "[KØ] Forkaster oppføring — lokalfil mangler:",
          oppforing.filnavn,
          oppforing.lokalSti.slice(-50),
        );
        db.delete(opplastingsKo)
          .where(eq(opplastingsKo.id, oppforing.id))
          .run();
        nesteForsokRef.current.delete(oppforing.id);
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
          // S1 Fase 1b: bilder (sjekkliste/oppgave) OG timer-kvitteringer → privat/
          // (signatur-KUN). Alle køoppføringer bærer én av disse id-ene.
          Boolean(
            oppforing.sheetTilleggId ||
              oppforing.sheetUtleggId ||
              oppforing.sjekklisteId ||
              oppforing.oppgaveId,
          ),
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

        // U4: utlegg-vedlegg har egen registrerings-/oppdaterings-sti (speil av
        // tillegg-grenen). Tidlig retur → sjekkliste/oppgave-koden under urørt.
        if (oppforing.sheetUtleggId) {
          registrerBildeIDatabase({
            sheetUtleggId: oppforing.sheetUtleggId,
            vedleggId: oppforing.vedleggId,
            fileUrl: resultat.fileUrl,
            fileName: resultat.fileName,
            fileSize: resultat.fileSize,
            mimeType: oppforing.mimeType,
            gpsLat: oppforing.gpsLat,
            gpsLng: oppforing.gpsLng,
          }).catch((f) =>
            console.warn("[KØ] Utlegg-vedlegg-registrering feilet (ikke-kritisk):", f),
          );
          fullforUtleggVedlegg(oppforing.vedleggId, resultat.fileUrl);
          await slettLokaltBilde(oppforing.lokalSti);
          oppdaterTellere();
          prosessererRef.current = false;
          prosesserNeste().catch((f) =>
            console.error("[KØ] Neste etter utlegg-vedlegg feilet:", f),
          );
          return;
        }

        // Funn #2: tillegg-vedlegg har egen registrerings-/oppdaterings-sti.
        // Tidlig retur → den eksisterende sjekkliste/oppgave-koden under er
        // urørt og kjører kun for ikke-tillegg-oppføringer.
        if (oppforing.sheetTilleggId) {
          registrerBildeIDatabase({
            sheetTilleggId: oppforing.sheetTilleggId,
            vedleggId: oppforing.vedleggId,
            fileUrl: resultat.fileUrl,
            fileName: resultat.fileName,
            fileSize: resultat.fileSize,
            mimeType: oppforing.mimeType,
            gpsLat: oppforing.gpsLat,
            gpsLng: oppforing.gpsLng,
          }).catch((f) =>
            console.warn("[KØ] Tillegg-vedlegg-registrering feilet (ikke-kritisk):", f),
          );
          fullforTilleggVedlegg(oppforing.vedleggId, resultat.fileUrl);
          await slettLokaltBilde(oppforing.lokalSti);
          oppdaterTellere();
          prosessererRef.current = false;
          prosesserNeste().catch((f) =>
            console.error("[KØ] Neste etter tillegg-vedlegg feilet:", f),
          );
          return;
        }

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

        // Oppdater vedlegg-URL i feltdata (SQLite — samme-install-kilde)
        const sqliteOk = oppdaterFeltdataVedlegg(dokumentId, dokumentType, oppforing.vedleggId, resultat.fileUrl);

        // Publiser til aktive hooks (live URL-oppdatering når skjermen er montert)
        publiserFullfort(
          dokumentId,
          dokumentType,
          oppforing.objektId,
          oppforing.vedleggId,
          resultat.fileUrl,
        );

        // Funn C: skriv den varige URL-en til server-JSON-en direkte — også når
        // skjermen er demontert (da når publiserFullfort aldri hooken, og
        // korreksjonen ville blitt liggende kun i SQLite, som viskes ved
        // reinstall). Best-effort: tåler at prod-API-et ikke har prosedyren ennå.
        let serverOk = false;
        if (dokumentType === "sjekkliste" && oppforing.sjekklisteId) {
          serverOk = await patchSjekklisteVedleggUrl({
            checklistId: oppforing.sjekklisteId,
            objektId: oppforing.objektId,
            vedleggId: oppforing.vedleggId,
            url: resultat.fileUrl,
            filnavn: resultat.fileName,
          });
        }

        // 🔴 Slett aldri lokalfila før erstatningen er persistert et sted som
        // overlever behovet: server (reinstall-sikkert) ELLER SQLite
        // (samme-install). Feiler begge — behold fila, så raden fortsatt viser
        // det lokale bildet og ingenting går tapt.
        if (sqliteOk || serverOk) {
          await slettLokaltBilde(oppforing.lokalSti);
        } else {
          console.warn("[KØ] URL ikke persistert (SQLite+server feilet) — beholder lokalfil:", oppforing.filnavn);
        }

        oppdaterTellere();

        // Prosesser neste umiddelbart
        prosessererRef.current = false;
        prosesserNeste().catch((f) => console.error("[KØ] Neste etter suksess feilet:", f));
      } catch (feil) {
        // Klassifiser: nett/timeout/5xx = forbigående (retry UTEN tak, tregt
        // byggeplass-nett er normalen); hard 4xx = ugyldig fil/permission (teller
        // mot taket). Ukjent → nett (tryggest: retry, ikke tap).
        const kategori = feil instanceof OpplastingFeil ? feil.kategori : "nett";
        const forsok = (oppforing.forsok ?? 0) + 1;
        const melding = feil instanceof Error ? feil.message : "Ukjent feil";

        // Backoff per oppføring (in-memory) — den feilede hoppes over til
        // ventetiden er ute, køen går videre til andre imens (head-of-line-fri).
        const ventetid = Math.min(Math.pow(2, forsok) * 1000, 30000);
        nesteForsokRef.current.set(oppforing.id, Date.now() + ventetid);

        if (kategori === "hard") {
          console.error("[KØ] Opplasting feilet (hard):", melding, "forsøk:", forsok, "/", MAKS_FORSOK);
          db.update(opplastingsKo)
            .set({ status: "feilet", forsok, feilmelding: melding })
            .where(eq(opplastingsKo.id, oppforing.id))
            .run();
        } else {
          // Nett: tilbake til 'venter' (alltid re-spørrbar, aldri permanent).
          // `forsok` vokser kun for backoff + synliggjøring av vedvarende feil (D).
          console.warn("[KØ] Opplasting nett-feil (retry uten tak):", melding, "forsøk:", forsok);
          db.update(opplastingsKo)
            .set({ status: "venter", forsok, feilmelding: melding })
            .where(eq(opplastingsKo.id, oppforing.id))
            .run();
        }

        oppdaterTellere();
        prosessererRef.current = false;
        // Gå til NESTE klare oppføring med en gang; den feilede er i backoff.
        prosesserNeste().catch((f) => console.error("[KØ] Neste etter feil feilet:", f));
      }
    } catch (feil) {
      console.error("[KØ] Køprosessering feilet helt:", feil);
      prosessererRef.current = false;
      settErAktiv(false);
    }
  }, [erPaaNettet, oppdaterTellere, oppdaterFeltdataVedlegg, publiserFullfort, fullforTilleggVedlegg, fullforUtleggVedlegg]);

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
            sheetTilleggId: oppforing.sheetTilleggId ?? null,
            sheetUtleggId: oppforing.sheetUtleggId ?? null,
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
      value={{
        leggIKo,
        ventende,
        totalt,
        erAktiv,
        feilendeVedleggIder: feilendeVedlegg,
        ventendePerDokument,
        registrerCallback,
        registrerTilleggVedleggCallback,
        registrerUtleggVedleggCallback,
      }}
    >
      {children}
    </OpplastingsKoContext.Provider>
  );
}
