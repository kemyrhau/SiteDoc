module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // require.resolve — pnpm-monorepo: presets må resolves eksplisitt fra
      // apps/mobile, ellers finner ikke babel dem ved lokalt bygg (transitiv
      // hoisting varierer mellom sky-EAS og lokal pnpm).
      [require.resolve("babel-preset-expo"), { jsxImportSource: "nativewind" }],
      require.resolve("nativewind/babel"),
    ],
  };
};
