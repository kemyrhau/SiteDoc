import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createRemoteJWKSet,
  jwtVerify,
  errors as joseErrors,
  type JWTPayload,
} from "jose";
import { router, publicProcedure, protectedProcedure } from "../trpc/trpc";
import { randomBytes } from "crypto";
import { sjekkRateLimit, hentKlientIp } from "../utils/rateLimiter";

const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const providerSchema = z.enum(["google", "microsoft"]);

interface UserInfo {
  email: string;
  name: string | null;
  image: string | null;
  providerAccountId: string;
}

async function hentGoogleBrukerinfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Kunne ikke verifisere Google-token");
  }

  const data = (await res.json()) as {
    email: string;
    name?: string;
    picture?: string;
    sub: string;
  };
  return {
    email: data.email,
    name: data.name ?? null,
    image: data.picture ?? null,
    providerAccountId: data.sub,
  };
}

// Microsoft-innlogging: mobilen sender ID-tokenet fra Entra (openid-flyt), ikke
// et Graph-access-token. Vi henter oid/email/name fra validerte claims og
// slipper `User.Read` (Graph-tillatelse til hele ansattprofilen) helt.
//
// providerAccountId = `oid` (directory-objektets id). Dette er BEVISST og
// bakoverkompatibelt: den gamle Graph /me-veien satte providerAccountId fra
// `id`-feltet, som per Microsofts definisjon ER `oid`. Bytter vi til `sub`
// (OIDC-userinfo) i stedet, ville eksisterende Account-koblinger brekke —
// `sub` er applikasjonsspesifikk og ikke lik `oid`.
//
// FLERTENANT: appen aksepterer innlogging fra kundens EGEN Entra-tenant
// (A.Markussen logger inn fra sin, ikke vår). Derfor kan iss IKKE pinnes til én
// tenant — mobilen går mot `/common`, og ID-tokenets `iss` er tenant-spesifikk
// (`.../{tid}/v2.0`). Vi validerer i stedet iss mot tokenets EGET `tid`-claim
// (well-formed Microsoft-issuer for nettopp den tenanten) og pinner `aud` mot
// mobilens client-id. Signatur valideres mot Entras `/common`-JWKS (Microsoft
// signerer alle tenanter med det felles nøkkelsettet). Den EGENTLIGE grensen for
// HVEM som slipper inn er admission-gaten i byttToken (invitasjon/eksisterende
// medlemskap) — verifisert at den gjelder mobil-veien.
const ENTRA_JWKS_URL =
  "https://login.microsoftonline.com/common/discovery/v2.0/keys";
let entraJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function hentEntraJwks() {
  if (!entraJwks) {
    entraJwks = createRemoteJWKSet(new URL(ENTRA_JWKS_URL));
  }
  return entraJwks;
}

// Minimal logger-flate (Fastify `req.log`) — struktur uten å dra inn Fastify-typer.
interface Logg {
  warn: (obj: object, msg: string) => void;
}

async function hentMicrosoftBrukerinfoFraIdToken(
  idToken: string,
  logg: Logg,
): Promise<UserInfo> {
  const audience = process.env.MICROSOFT_MOBILE_CLIENT_ID;
  if (!audience) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Microsoft-innlogging er ikke konfigurert på serveren.",
    });
  }

  let payload: JWTPayload;
  try {
    // Ingen `issuer`-opsjon — flertenant (iss valideres mot tid under). aud
    // pinnes; exp/nbf sjekkes automatisk av jose.
    ({ payload } = await jwtVerify(idToken, hentEntraJwks(), { audience }));
  } catch (err) {
    // Logg jose-feilkoden + hvilket claim som sviktet — ALDRI tokenet eller
    // claim-VERDIER. `claim` fra jose er et claim-NAVN (f.eks. "aud", "exp").
    const kode =
      err instanceof Error && "code" in err ? String(err.code) : "ukjent";
    const claim =
      err instanceof joseErrors.JWTClaimValidationFailed
        ? err.claim
        : undefined;
    logg.warn({ kode, claim }, "Microsoft ID-token avvist ved jwtVerify");
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Ugyldig Microsoft-token.",
    });
  }

  // Flertenant iss-validering: iss MÅ være Microsofts well-formed v2-issuer for
  // tokenets egen tenant (tid). Fanger forfalsket eller uoverensstemmende iss/tid.
  const tid = typeof payload.tid === "string" ? payload.tid : null;
  const forventetIss = tid
    ? `https://login.microsoftonline.com/${tid}/v2.0`
    : null;
  if (!tid || payload.iss !== forventetIss) {
    logg.warn(
      { kode: "iss_tid_mismatch", harTid: !!tid },
      "Microsoft ID-token: iss matcher ikke tid",
    );
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Ugyldig Microsoft-token.",
    });
  }

  const oid = typeof payload.oid === "string" ? payload.oid : null;
  // email-claim krever `email`-scope og et satt mail-attributt; faller tilbake
  // til preferred_username (UPN) — speiler den gamle mail ?? userPrincipalName.
  const email =
    (typeof payload.email === "string" && payload.email) ||
    (typeof payload.preferred_username === "string" &&
      payload.preferred_username) ||
    null;
  const name = typeof payload.name === "string" ? payload.name : null;

  if (!oid || !email) {
    logg.warn(
      { kode: "mangler_paakrevd_claim", manglerOid: !oid, manglerEpost: !email },
      "Microsoft ID-token mangler oid/e-post",
    );
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Microsoft-token mangler påkrevde felt (oid/e-post).",
    });
  }

  return { email, name, image: null, providerAccountId: oid };
}

export const mobilAuthRouter = router({
  /**
   * Bytt OAuth access_token fra mobil mot en sesjonstoken.
   * 1. Verifiser token mot provider (Google/Microsoft)
   * 2. Finn eller opprett bruker + account
   * 3. Opprett sesjon i databasen
   * 4. Returner sesjonstoken + brukerinfo
   */
  byttToken: publicProcedure
    .input(
      z
        .object({
          provider: providerSchema,
          // Google sender access_token (verifiseres mot userinfo); Microsoft
          // sender ID-tokenet (valideres mot Entras JWKS). Se providervalget under.
          accessToken: z.string().min(1).optional(),
          idToken: z.string().min(1).optional(),
        })
        .refine(
          (d) => (d.provider === "google" ? !!d.accessToken : !!d.idToken),
          { message: "Mangler token for valgt tilbyder." },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      const ip = hentKlientIp(ctx.req);
      if (!sjekkRateLimit("byttToken", ip, 10, 60 * 1000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "For mange innloggingsforsøk. Prøv igjen om litt." });
      }

      // 1. Verifiser mot provider
      let brukerinfo: UserInfo;
      if (input.provider === "google") {
        if (!input.accessToken) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Mangler Google-token." });
        }
        brukerinfo = await hentGoogleBrukerinfo(input.accessToken);
      } else {
        if (!input.idToken) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Mangler Microsoft-token." });
        }
        brukerinfo = await hentMicrosoftBrukerinfoFraIdToken(
          input.idToken,
          ctx.req.log,
        );
      }

      const providerNavn = input.provider === "google" ? "google" : "microsoft-entra-id";

      // 2. Orphan-guard + finn/opprett bruker. Speiler web-guarden
      // (apps/web/src/auth.ts): hindre at uinviterte OAuth-pålogginger
      // oppretter tomme orphan-kontoer som låser e-poster. Slipp KUN gjennom
      // hvis (a) eksisterende canLogin-bruker (dekker (d) sitedoc_admin),
      // (b) ventende invitasjon, eller (c) allerede koblet konto.

      // (a) Eksisterende canLogin-bruker på e-posten (case-insensitiv, eldste først).
      let bruker = await ctx.prisma.user.findFirst({
        where: { email: { equals: brukerinfo.email, mode: "insensitive" }, canLogin: true },
        orderBy: { createdAt: "asc" },
      });

      // (c) Returnerende bruker via allerede koblet konto — slå opp FØR
      // eventuell opprettelse, kritisk hvis DB-e-posten er endret bort fra
      // tilbyderens e-post (koblingen ligger på provider+providerAccountId).
      const eksisterendeKonto = await ctx.prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: providerNavn,
            providerAccountId: brukerinfo.providerAccountId,
          },
        },
      });
      if (!bruker && eksisterendeKonto) {
        bruker = await ctx.prisma.user.findUnique({ where: { id: eksisterendeKonto.userId } });
      }

      // Admission-gate (sak #2 2026-07-04): speiler web signIn-innstrammingen
      // (apps/web/src/auth.ts). En eksisterende canLogin-bruker funnet på
      // e-post — men uten allerede koblet konto — slippes bare inn hvis
      // sitedoc_admin, OrganizationMember/ProjectMember, eller ventende
      // invitasjon. Bruker fjernet fra alle firma/prosjekt avvises ved neste
      // innlogging (ønsket). Allerede koblet konto (eksisterendeKonto != null)
      // passerer alltid — samme unntak som web (c).
      if (bruker && !eksisterendeKonto) {
        const tilknytning = await ctx.prisma.user.findUnique({
          where: { id: bruker.id },
          select: {
            role: true,
            _count: { select: { organizationMembers: true, projects: true } },
          },
        });
        const harTilknytning =
          tilknytning?.role === "sitedoc_admin" ||
          (tilknytning?._count.organizationMembers ?? 0) > 0 ||
          (tilknytning?._count.projects ?? 0) > 0;
        if (!harTilknytning) {
          const invitasjon = await ctx.prisma.projectInvitation.findFirst({
            where: { email: brukerinfo.email.toLowerCase(), status: "pending" },
            select: { id: true },
          });
          if (!invitasjon) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "Du har ikke tilgang. Kontakt administrator for å bli lagt til i et firma eller prosjekt.",
            });
          }
        }
      }

      if (!bruker) {
        // (b) Opprett ny bruker KUN hvis det finnes en ventende invitasjon på
        // e-posten. Streng lowercase-equals — invitasjoner normaliseres til
        // lowercase ved opprettelse (jf. medlem.ts/gruppe.ts).
        const invitasjon = await ctx.prisma.projectInvitation.findFirst({
          where: { email: brukerinfo.email.toLowerCase(), status: "pending" },
          select: { id: true },
        });
        if (!invitasjon) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Du har ikke tilgang. Bruk e-posten du ble invitert med, eller kontakt administrator.",
          });
        }
        bruker = await ctx.prisma.user.create({
          data: {
            email: brukerinfo.email,
            name: brukerinfo.name,
            image: brukerinfo.image,
          },
        });
      }

      // 3. Opprett account-kobling hvis den mangler.
      if (!eksisterendeKonto) {
        await ctx.prisma.account.create({
          data: {
            userId: bruker.id,
            type: "oauth",
            provider: providerNavn,
            providerAccountId: brukerinfo.providerAccountId,
            // Microsoft-veien har ikke lenger et access_token (ID-token brukes
            // kun til validering, ikke lagring). Google beholder sitt.
            access_token: input.accessToken ?? null,
          },
        });
      }

      // 4. Opprett sesjon (30 dager). createdAt + lastRotatedAt får default
      // NOW() fra schema, men settes eksplisitt for klarhet og audit-spor.
      const sessionToken = randomBytes(32).toString("hex");
      const naa = new Date();
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);

      await ctx.prisma.session.create({
        data: {
          sessionToken,
          userId: bruker.id,
          expires,
          createdAt: naa,
          lastRotatedAt: naa,
        },
      });

      return {
        sessionToken,
        user: {
          id: bruker.id,
          name: bruker.name,
          email: bruker.email,
          image: bruker.image,
        },
      };
    }),

  /**
   * Verifiser at sesjonen er gyldig + forny utløpstid.
   * Lett endepunkt for mobilapp-oppstart (ingen tung data).
   */
  verifiser: protectedProcedure.query(async ({ ctx }) => {
    // Forny sesjonen med 30 nye dager ved aktiv bruk — men IKKE roter
    // sessionToken her. verifiser kjøres ved hver app-oppstart/reload, og
    // token-rotasjon på dette tidspunktet skapte et race: samtidige queries
    // (prosjekt.hentMine, refreshKatalog) som leste det gamle tokenet fra
    // SecureStore før det nye var lagret, traff en allerede-rotert sesjon →
    // UNAUTHORIZED → global retry-handler logget brukeren ut. Sikkerhets-
    // rotasjon (worst-case-eksponering) håndteres av H1-mutation-middleweren
    // (mobilTokenRotasjon i trpc/trpc.ts) som kun roterer ved mutations når
    // lastRotatedAt > 7 dager — der finnes ikke startup-racet.
    const gammelToken =
      ctx.req.headers.authorization?.replace("Bearer ", "") ?? null;

    if (gammelToken) {
      const nyUtloper = new Date();
      nyUtloper.setDate(nyUtloper.getDate() + 30);
      await ctx.prisma.session.updateMany({
        where: { sessionToken: gammelToken, userId: ctx.userId },
        data: { expires: nyUtloper },
      });
    }

    const bruker = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { id: true, name: true, email: true, image: true, language: true },
    });

    // nyttToken alltid null — token roteres ikke ved verifiser lenger.
    // Klienten (AuthProvider) tåler dette og beholder eksisterende token.
    return { valid: true, user: bruker, nyttToken: null };
  }),

  /**
   * Slett sesjonen fra databasen ved utlogging.
   */
  loggUt: protectedProcedure.mutation(async ({ ctx }) => {
    const sessionToken =
      ctx.req.headers.authorization?.replace("Bearer ", "") ?? null;

    if (sessionToken) {
      await ctx.prisma.session.deleteMany({
        where: { sessionToken, userId: ctx.userId },
      });
    }

    return { success: true };
  }),
});
