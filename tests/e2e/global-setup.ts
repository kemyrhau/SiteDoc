/**
 * Global oppsett: mint session-tokens via dev-login (ingen OAuth), skriv
 * storageState-cookies per rolle, og slå opp flyt-IDer fra det seedede
 * agentprosjektet. Alt deles til testene via .runtime.json (gitignored).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { devLogin, ApiKlient } from "./lib/api";
import { slåOppFlyt } from "./lib/flyt";
import {
  AUTH_DIR,
  BASE_URL,
  COOKIE_NAVN,
  RUNTIME_FIL,
  TESTBRUKERE,
  nyRunId,
  type Rolle,
  type Runtime,
} from "./lib/miljo";

function storageState(token: string) {
  const host = new URL(BASE_URL).hostname;
  const utløper = Math.floor(Date.now() / 1000) + 25 * 24 * 60 * 60; // < 30d token-levetid
  return {
    cookies: [
      {
        name: COOKIE_NAVN,
        value: token,
        domain: host,
        path: "/",
        expires: utløper,
        httpOnly: true,
        secure: BASE_URL.startsWith("https"),
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };
}

export default async function globalSetup() {
  await mkdir(AUTH_DIR, { recursive: true });

  const roller = Object.keys(TESTBRUKERE) as Rolle[];
  const tokens = {} as Record<Rolle, string>;

  for (const rolle of roller) {
    const { sessionToken } = await devLogin(TESTBRUKERE[rolle]);
    tokens[rolle] = sessionToken;
    await writeFile(
      resolve(AUTH_DIR, `${rolle}.json`),
      JSON.stringify(storageState(sessionToken), null, 2),
    );
  }

  // Flyt-oppslag som firma (prosjektadmin + registrator-medlem).
  const flyt = await slåOppFlyt(new ApiKlient(tokens.firma));

  const runtime: Runtime = { runId: nyRunId(), tokens, ...flyt };
  await writeFile(RUNTIME_FIL, JSON.stringify(runtime, null, 2));

  console.log(
    `[e2e] runId=${runtime.runId} · prosjekt=${runtime.projectId} · ledd=${runtime.antallLedd}`,
  );
}
