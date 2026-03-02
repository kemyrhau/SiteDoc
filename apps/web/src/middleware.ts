import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Enkel middleware som sjekker om bruker har sesjonscookie.
 * Unngår å bruke PrismaAdapter på edge runtime (som ikke støttes).
 * Faktisk sesjonsvalidering skjer i API-rutene via auth().
 */
export default function middleware(request: NextRequest) {
  const _sessionCookie =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  // Tillat API-ruter og auth-ruter uansett
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Offentlige sider som ikke krever innlogging
  if (
    request.nextUrl.pathname === "/logg-inn" ||
    request.nextUrl.pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Hvis ingen sesjonscookie → redirect til innlogging
  // Deaktivert i dev for enklere testing:
  // if (!sessionCookie) {
  //   return NextResponse.redirect(new URL("/logg-inn", request.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)|api/auth).*)",
  ],
};
