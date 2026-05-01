/**
 * Vegvesen-kø-worker.
 *
 * Mønster: setTimeout-poll-løkke (kanon per arkitektur-syntese § 6.2).
 * Polling: 60s. Watchdog: 5 min. Recovery ved oppstart.
 *
 * Plukker eldste ventende rad ordnet etter (prioritet ASC, opprettet ASC):
 *   - prio 0  = nyregistrering (skal egentlig håndteres synkront i forhandsvisning,
 *               men plukkes hvis worker ser det)
 *   - prio 50 = manuell admin-oppdatering
 *   - prio 100 = auto-oppdatering (Fase 2, ikke aktiv ennå)
 *
 * Ved 429 fra Vegvesen: pause 15 min i minne (alle iterasjoner sjekker pausedUntil).
 * Etter 5 forsøk per rad: marker som «feilet».
 */
import type { PrismaClient as MaskinPrismaClient } from "@sitedoc/db-maskin";
import {
  hentKjoretoyData,
  parseForhandsvisning,
  VegvesenRateLimitError,
  VegvesenIkkeFunnetError,
} from "./vegvesen-api";

const POLL_INTERVALL_MS = 60_000; // 60 sek
const WATCHDOG_INTERVALL_MS = 5 * 60_000; // 5 min
const STUCK_TERSKEL_MS = 10 * 60_000; // 10 min
const MAKS_FORSOK = 5;
const RATE_LIMIT_PAUSE_MS = 15 * 60_000; // 15 min

let pausedUntil: number = 0;

export function startVegvesenWorker(prismaMaskin: MaskinPrismaClient): void {
  console.log("Vegvesen-worker startet");

  // Recovery: stuck "prosesserer" → "ventende"
  prismaMaskin.vegvesenKo
    .updateMany({
      where: { status: "prosesserer" },
      data: { status: "ventende" },
    })
    .then((r) => {
      if (r.count > 0) {
        console.log(`Vegvesen recovery: ${r.count} stuck rader satt til ventende`);
      }
    })
    .catch(() => {});

  async function poll() {
    try {
      if (Date.now() < pausedUntil) {
        // Pauset etter 429 — hopper over til pausen er over
      } else {
        await prosesserNeste(prismaMaskin);
      }
    } catch (err) {
      console.error("Vegvesen-worker feil:", err);
    }
    setTimeout(poll, POLL_INTERVALL_MS);
  }

  async function watchdog() {
    try {
      const stuckTerskel = new Date(Date.now() - STUCK_TERSKEL_MS);
      const stuck = await prismaMaskin.vegvesenKo.updateMany({
        where: {
          status: "prosesserer",
          sistForsok: { lt: stuckTerskel },
        },
        data: { status: "ventende" },
      });
      if (stuck.count > 0) {
        console.log(`Vegvesen-watchdog: ${stuck.count} stuck rader restartet`);
      }
    } catch (err) {
      console.error("Vegvesen-watchdog feil:", err);
    }
    setTimeout(watchdog, WATCHDOG_INTERVALL_MS);
  }

  setTimeout(poll, 5_000);
  setTimeout(watchdog, 60_000);
}

async function prosesserNeste(prismaMaskin: MaskinPrismaClient): Promise<void> {
  const rad = await prismaMaskin.vegvesenKo.findFirst({
    where: { status: "ventende" },
    orderBy: [{ prioritet: "asc" }, { opprettet: "asc" }],
  });
  if (!rad) return;

  await prismaMaskin.vegvesenKo.update({
    where: { id: rad.id },
    data: {
      status: "prosesserer",
      forsokAntall: { increment: 1 },
      sistForsok: new Date(),
    },
  });

  try {
    const raw = await hentKjoretoyData(rad.registreringsnummer);
    const felter = parseForhandsvisning(raw, rad.registreringsnummer);

    // Skriv tilbake til Equipment
    await prismaMaskin.equipment.update({
      where: { id: rad.equipmentId },
      data: {
        vegvesenData: raw as object,
        vegvesenDataOppdatert: new Date(),
        vegvesenDataStatus: "frisk",
        vin: felter.vin,
        merke: felter.merke ?? undefined,
        modell: felter.modell ?? undefined,
        farge: felter.farge,
        drivstoff: felter.drivstoff,
        kjoretoygruppe: felter.kjoretoygruppe,
        kjoretoygruppeNavn: felter.kjoretoygruppeNavn,
        antallSeter: felter.antallSeter,
        forsteRegistrering: felter.forsteRegistrering ? new Date(felter.forsteRegistrering) : null,
        effektKw: felter.effektKw ?? null,
        euroKlasse: felter.euroKlasse,
        totalvekt: felter.totalvekt,
        egenvekt: felter.egenvekt,
        nyttelast: felter.nyttelast,
        girkasse: felter.girkasse,
        co2GramPerKm: felter.co2GramPerKm ?? null,
        forbrukLiterPer10km: felter.forbrukLiterPer10km ?? null,
        euKontrollSist: felter.euKontrollSist ? new Date(felter.euKontrollSist) : null,
        euKontrollFrist: felter.euKontrollFrist ? new Date(felter.euKontrollFrist) : null,
      },
    });

    await prismaMaskin.vegvesenKo.update({
      where: { id: rad.id },
      data: { status: "fullfort", fullfort: new Date(), feilmelding: null },
    });
  } catch (err) {
    if (err instanceof VegvesenRateLimitError) {
      pausedUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
      // Sett rad tilbake til ventende — den prøves igjen etter pausen
      await prismaMaskin.vegvesenKo.update({
        where: { id: rad.id },
        data: {
          status: "ventende",
          feilmelding: `Rate-limit, pauset til ${new Date(pausedUntil).toISOString()}`,
        },
      });
      console.log(`Vegvesen rate-limit truffet, worker pauset i 15 min`);
      return;
    }

    const feilmelding = err instanceof Error ? err.message : "Ukjent feil";
    const skalGiOpp = rad.forsokAntall + 1 >= MAKS_FORSOK || err instanceof VegvesenIkkeFunnetError;

    await prismaMaskin.vegvesenKo.update({
      where: { id: rad.id },
      data: {
        status: skalGiOpp ? "feilet" : "ventende",
        feilmelding: feilmelding.slice(0, 500),
      },
    });

    if (skalGiOpp) {
      // Marker Equipment med dataStatus "feilet"
      await prismaMaskin.equipment
        .update({
          where: { id: rad.equipmentId },
          data: { vegvesenDataStatus: "feilet" },
        })
        .catch(() => {});
    }
  }
}
