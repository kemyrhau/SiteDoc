/**
 * Pushvarsel runde A (2026-09-17, Kenneth-gatet) — RENE RØR. Ingen UI, ingen målgruppe-
 * logikk, ingen regler/frister/preferanser (det er varsling.md, ikke denne fila).
 *
 * Fire ansvar, alle datalag:
 *   1) registrerPushToken — upsert på token (enhetens identitet). Delt telefon: siste
 *      innlogging overtar raden. Ny telefon: ny rad → bruker varsles på begge enheter.
 *   2) naabarhet          — av N valgte brukere, hvor mange har et gyldig token (krav 4).
 *   3) sendPush           — tar tokens + tekst, sender via expo-server-sdk, rydder døde
 *      tokens (DeviceNotRegistered), returnerer hva som gikk og hva som feilet (krav 3).
 *   4) logg               — activity_log dekker det; sendPush skriver «push.sendt» når den
 *      får en aktør-kontekst (krav 5). INGEN ny logg-tabell.
 *
 * Expo-detalj som styrer designet: sendPushNotificationsAsync returnerer ÉN ticket pr.
 * melding, i rekkefølge. Vi sender én melding pr. token → ticket[i] hører til tokens[i].
 * Feil-tickets bærer i tillegg details.expoPushToken, så korrelasjonen er dobbelt sikret.
 *
 * GJENSTÅR (meldt, ikke bygget): DeviceNotRegistered dukker ofte først opp i RECEIPTS
 * (hentes senere via ticket-id), ikke i selve ticketen. Denne tynne tjenesten rydder
 * ticket-fasen nå; receipt-polling krever at ticket-id-ene persisteres og hører til en
 * senere runde. `ryddDoedeTokens` er skilt ut nettopp så en receipt-poller kan gjenbruke den.
 */

import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { prisma as standardPrisma, type PrismaClient } from "@sitedoc/db";

export type Plattform = "ios" | "android";

export type NaabarhetResultat = {
  /** Antall unike brukere som ble spurt om. */
  valgt: number;
  /** Av dem: hvor mange har minst ett registrert token (= faktisk nåbare). */
  naabare: number;
  /** De spurte brukerne som IKKE har noe token (runde C viser dem i UI). */
  utenToken: string[];
};

export type SendPushInput = {
  tokens: string[];
  tittel: string;
  kropp: string;
  data?: Record<string, unknown>;
  /**
   * Aktør-kontekst for loggen (krav 5). Gis den, skrives én rad i activity_log.
   * Utelates den (ren test/systemsending), hoppes loggen over — tjenesten forblir tynn.
   */
  logg?: { actorUserId?: string; organizationId?: string; projectId?: string };
};

export type SendPushResultat = {
  /** Antall tokens Expo kvitterte «ok» for. */
  sendt: number;
  /** Tokens som feilet, med Expo-feilkoden (eller «UgyldigFormat»/«Unntak»). */
  feilet: { token: string; feil: string }[];
  /** Antall døde tokens (DeviceNotRegistered) som ble slettet fra push_tokens. */
  ryddet: number;
};

/**
 * Upsert av et enhets-token. token er UNIK (enhetens identitet), så samme telefon får
 * aldri to rader → aldri dobbelt varsel. Bytter innlogget bruker på samme enhet, overtar
 * den nye brukeren raden (siste innlogging vinner — enheten har alltid nøyaktig én bruker).
 */
export async function registrerPushToken(
  userId: string,
  token: string,
  plattform: Plattform,
  prisma: PrismaClient = standardPrisma,
): Promise<void> {
  if (!Expo.isExpoPushToken(token)) {
    throw new Error(`Ugyldig Expo push-token: ${String(token).slice(0, 12)}…`);
  }
  const naa = new Date();
  await prisma.pushToken.upsert({
    where: { token },
    create: { userId, token, plattform, sistSett: naa },
    update: { userId, plattform, sistSett: naa },
  });
}

/**
 * Nåbarhets-telling (krav 4). Svarer: av N valgte brukere, hvor mange har et gyldig token.
 * En bruker uten rad i push_tokens er per definisjon IKKE nåbar — det er hele poenget:
 * en formann skal ikke tro at 50 mann fikk beskjed når 12 gjorde det.
 */
export async function naabarhet(
  userIds: string[],
  prisma: PrismaClient = standardPrisma,
): Promise<NaabarhetResultat> {
  const unike = [...new Set(userIds)];
  if (unike.length === 0) {
    return { valgt: 0, naabare: 0, utenToken: [] };
  }
  const medToken = await prisma.pushToken.findMany({
    where: { userId: { in: unike } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const naabareSett = new Set(medToken.map((r) => r.userId));
  return {
    valgt: unike.length,
    naabare: naabareSett.size,
    utenToken: unike.filter((id) => !naabareSett.has(id)),
  };
}

/**
 * Sletter døde tokens (DeviceNotRegistered). Skilt ut så en senere receipt-poller kan
 * gjenbruke den. Returnerer antall slettede rader.
 */
export async function ryddDoedeTokens(
  tokens: string[],
  prisma: PrismaClient = standardPrisma,
): Promise<number> {
  if (tokens.length === 0) return 0;
  const { count } = await prisma.pushToken.deleteMany({
    where: { token: { in: tokens } },
  });
  return count;
}

/**
 * Tynn sending: chunk → send → rydd døde tokens → (valgfri) logg. Ingen målgruppe-logikk.
 * `expo` kan injiseres for test; ellers en standard-instans.
 */
export async function sendPush(
  input: SendPushInput,
  deps: { prisma?: PrismaClient; expo?: Expo } = {},
): Promise<SendPushResultat> {
  const prisma = deps.prisma ?? standardPrisma;
  const expo = deps.expo ?? new Expo();

  const feilet: SendPushResultat["feilet"] = [];

  // Ugyldig-formaterte tokens sendes aldri til Expo — de telles som feil med en gang.
  const gyldige = input.tokens.filter((t) => {
    if (Expo.isExpoPushToken(t)) return true;
    feilet.push({ token: t, feil: "UgyldigFormat" });
    return false;
  });

  const meldinger: ExpoPushMessage[] = gyldige.map((token) => ({
    to: token,
    title: input.tittel,
    body: input.kropp,
    ...(input.data ? { data: input.data } : {}),
  }));

  // Ticket[i] ↔ gyldige[i] (Expo bevarer rekkefølge, én ticket pr. melding).
  const tickets: ExpoPushTicket[] = [];
  for (const bit of expo.chunkPushNotifications(meldinger)) {
    try {
      const del = await expo.sendPushNotificationsAsync(bit);
      tickets.push(...del);
    } catch (e) {
      // Hele chunken feilet (nettverk e.l.) — marker alle tokens i chunken som feilet,
      // uten å rydde dem (feilen er ikke «token dødt», den er «sending feilet»).
      const feil = e instanceof Error ? e.message : "Unntak";
      for (const m of bit) {
        const t = Array.isArray(m.to) ? m.to[0] : m.to;
        feilet.push({ token: String(t), feil });
      }
    }
  }

  let sendt = 0;
  const doede: string[] = [];
  tickets.forEach((ticket, i) => {
    const token = gyldige[i]!; // ticket[i] ↔ gyldige[i] (1:1, Expo bevarer rekkefølge)
    if (ticket.status === "ok") {
      sendt += 1;
      return;
    }
    const kode = ticket.details?.error ?? "Ukjent";
    feilet.push({ token, feil: kode });
    // Kun DeviceNotRegistered betyr «enheten finnes ikke lenger» → rydd. Andre feil
    // (MessageRateExceeded, InvalidCredentials) er forbigående/konfig — ikke slett token.
    if (kode === "DeviceNotRegistered") doede.push(token);
  });

  const ryddet = await ryddDoedeTokens(doede, prisma);

  if (input.logg?.actorUserId || input.logg?.organizationId) {
    await prisma.activity.create({
      data: {
        actorUserId: input.logg.actorUserId ?? null,
        organizationId: input.logg.organizationId ?? null,
        projectId: input.logg.projectId ?? null,
        targetType: "push",
        targetId: "broadcast",
        action: "push.sendt",
        payload: {
          tittel: input.tittel,
          antallMottakere: input.tokens.length,
          antallSendt: sendt,
          antallFeilet: feilet.length,
          antallRyddet: ryddet,
        },
      },
    });
  }

  return { sendt, feilet, ryddet };
}
