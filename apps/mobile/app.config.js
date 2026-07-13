// Dynamisk Expo-config som utvider den statiske app.json.
// Eneste formål: gi test-bygget eget ios.bundleIdentifier + navn slik at
// «SiteDoc TEST» kan installeres side om side med prod-«SiteDoc».
//
// Aktiveres av env-variabelen APP_VARIANT=test (satt i eas.json sin test-profil).
// MERK: scheme ("sitedoc") og android.package holdes DELT med vilje — auth.ts:84
// hardkoder makeRedirectUri({ scheme: "sitedoc" }), så scheme-separasjon krever
// også auth.ts + Google-redirect-registrering (egen oppfølger i BACKLOG).

module.exports = ({ config }) => {
  const erTest = process.env.APP_VARIANT === "test";

  // ATS-unntak KUN for lokal dev (expo start / expo run:ios). `EAS_BUILD` er satt
  // på ALLE EAS-profiler (inkl. prod), så et EAS-bygg får aldri dette. Lar
  // simulatoren nå test-API over http via localhost-port-forward (satt i .env:
  // EXPO_PUBLIC_API_URL=http://localhost:3301, med `ssh -N -L 3301:localhost:3301
  // server-ny`) — sikkerhetsnett for cleartext mot loopback. Krever native
  // dev-client-rebuild for å tre i kraft — ikke Fast Refresh. Prod/test/preview
  // beholder streng ATS (https-edge). Se docs/claude/dev-login-agent.md.
  const erLokalDev = !process.env.EAS_BUILD;

  // Build-identifiserende commit-hash (vises i VersjonsFooter):
  //  1) EAS-bygg: EAS_BUILD_GIT_COMMIT_HASH (full hash, verifisert mot EAS-docs) → 7 tegn.
  //  2) Lokal kjøring: `git rev-parse --short HEAD` (try/catch — kan mangle git/tre).
  //  3) Fallback "dev".
  let gitCommit = process.env.EAS_BUILD_GIT_COMMIT_HASH?.slice(0, 7);
  if (!gitCommit) {
    try {
      gitCommit = require("child_process")
        .execSync("git rev-parse --short HEAD", {
          stdio: ["ignore", "pipe", "ignore"],
        })
        .toString()
        .trim();
    } catch {
      gitCommit = "dev";
    }
  }

  return {
    ...config,
    name: erTest ? "SiteDoc TEST" : config.name,
    ios: {
      ...config.ios,
      bundleIdentifier: erTest
        ? "com.kemyrhau.sitedoc.test"
        : config.ios.bundleIdentifier,
      infoPlist: {
        ...config.ios.infoPlist,
        ...(erLokalDev
          ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } }
          : {}),
      },
    },
    extra: {
      // Bevarer router + eas.projectId fra app.json — ALDRI dropp disse.
      ...config.extra,
      // Synlig build-identifikator (vises i VersjonsFooter) — se utledning over.
      gitCommit,
      // Build-dato settes ved config-evaluering (= build-tidspunkt på EAS).
      byggDato: new Date().toISOString().slice(0, 10),
    },
  };
};
