import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@sitedoc/db";

/**
 * Dev-bypass-innlogging for mobil-simulator.
 *
 * Aktiv kun når:
 *   - NODE_ENV !== "production"  (lokal `pnpm dev`)
 *   - ELLER ENABLE_DEV_LOGIN === "true" (eksplisitt opt-in på test.sitedoc.no)
 *
 * Returnerer 404 i produksjon (ENABLE_DEV_LOGIN må aldri settes på prod-server).
 *
 * Returnerer en gyldig session-token for en eksisterende test-bruker
 * (default: kemyrhau@gmail.com — Kenneth). Ingen ny bruker opprettes.
 *
 * Token har samme TTL og format som mobilAuth.byttToken (30 dager,
 * 64 hex-tegn fra crypto.randomBytes).
 */

const TEST_BRUKER_EMAIL = "kemyrhau@gmail.com";

function erDevAktiv(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.ENABLE_DEV_LOGIN === "true") return true;
  return false;
}

export async function POST() {
  if (!erDevAktiv()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const bruker = await prisma.user.findFirst({
    where: { email: TEST_BRUKER_EMAIL, canLogin: true },
    orderBy: { createdAt: "asc" },
  });

  if (!bruker) {
    return NextResponse.json(
      {
        error: "TEST_BRUKER_MANGLER",
        melding: `Test-bruker ${TEST_BRUKER_EMAIL} finnes ikke i denne databasen. Logg inn med vanlig OAuth først.`,
      },
      { status: 404 },
    );
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  await prisma.session.create({
    data: {
      sessionToken,
      userId: bruker.id,
      expires,
    },
  });

  return NextResponse.json({
    sessionToken,
    user: {
      id: bruker.id,
      name: bruker.name,
      email: bruker.email,
      image: bruker.image,
    },
  });
}

export async function GET() {
  // GET kun for diagnose: viser om dev-login er aktiv eller ikke
  if (!erDevAktiv()) {
    return new NextResponse("Not Found", { status: 404 });
  }
  return NextResponse.json({
    aktiv: true,
    testBruker: TEST_BRUKER_EMAIL,
    melding: "POST hit for å bytte mot session-token",
  });
}
