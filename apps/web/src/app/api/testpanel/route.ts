import { NextResponse } from "next/server";
import { postSchema, testpanelPå } from "@/components/testpanel/schema";
import {
  aktivFil,
  lagreForbedring,
  lagrePause,
  lagreSvar,
  lesRunde,
  TestpanelFeil,
} from "@/components/testpanel/lagring";

// Testpanel for lokal testflate (lokal-dev.md § 7). Finnes i prod-bygget, men svarer
// alltid 404 der: vilkåret sjekkes før noe annet, og ingen fil leses.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ikkeFunnet = () => new NextResponse(null, { status: 404 });

function feilsvar(e: unknown) {
  if (e instanceof TestpanelFeil) return NextResponse.json({ feil: e.message }, { status: e.status });
  return NextResponse.json({ feil: String(e) }, { status: 500 });
}

export async function GET() {
  if (!testpanelPå()) return ikkeFunnet();
  try {
    const fil = await aktivFil();
    const runde = fil ? await lesRunde(fil) : null;
    return NextResponse.json({ runde });
  } catch (e) {
    return feilsvar(e);
  }
}

export async function POST(request: Request) {
  if (!testpanelPå()) return ikkeFunnet();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ feil: "Ugyldig JSON" }, { status: 400 });
  }
  const tolket = postSchema.safeParse(body);
  if (!tolket.success) {
    return NextResponse.json({ feil: tolket.error.issues[0]?.message ?? "Ugyldig svar" }, { status: 400 });
  }
  const p = tolket.data;
  try {
    const runde =
      p.type === "svar"
        ? await lagreSvar(p)
        : p.type === "pause"
          ? await lagrePause(p.pause)
          : await lagreForbedring(p.nr, p.tekst);
    return NextResponse.json({ runde });
  } catch (e) {
    return feilsvar(e);
  }
}
