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

  return {
    ...config,
    name: erTest ? "SiteDoc TEST" : config.name,
    ios: {
      ...config.ios,
      bundleIdentifier: erTest
        ? "com.kemyrhau.sitedoc.test"
        : config.ios.bundleIdentifier,
    },
  };
};
