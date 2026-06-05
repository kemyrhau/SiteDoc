import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc/trpc";
import { randomBytes } from "crypto";
import { sjekkRateLimit, hentKlientIp } from "../utils/rateLimiter";

const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const MICROSOFT_USERINFO_URL = "https://graph.microsoft.com/v1.0/me";

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

async function hentMicrosoftBrukerinfo(
  accessToken: string,
): Promise<UserInfo> {
  const res = await fetch(MICROSOFT_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Kunne ikke verifisere Microsoft-token");
  }

  const data = (await res.json()) as {
    mail?: string;
    userPrincipalName: string;
    displayName?: string;
    id: string;
  };
  return {
    email: data.mail ?? data.userPrincipalName,
    name: data.displayName ?? null,
    image: null,
    providerAccountId: data.id,
  };
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
      z.object({
        provider: providerSchema,
        accessToken: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ip = hentKlientIp(ctx.req);
      if (!sjekkRateLimit("byttToken", ip, 10, 60 * 1000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "For mange innloggingsforsøk. Prøv igjen om litt." });
      }

      // 1. Verifiser mot provider
      const brukerinfo =
        input.provider === "google"
          ? await hentGoogleBrukerinfo(input.accessToken)
          : await hentMicrosoftBrukerinfo(input.accessToken);

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
            access_token: input.accessToken,
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
