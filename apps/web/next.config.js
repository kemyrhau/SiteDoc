/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@sitedoc/shared", "@sitedoc/ui", "pdfjs-dist"],
  webpack: (config, { isServer }) => {
    // pdfjs-dist bruker canvas som optional dependency — ignorer i webpack
    config.resolve.alias.canvas = false;

    // web-ifc WASM — tillat async WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Ikke bundle @thatopen/web-ifc på server (bruker WebGL/WASM)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("web-ifc", "@thatopen/components", "@thatopen/fragments");
    }

    // @thatopen bruker ESM med inlinet Three.js — SWC må gjenkjenne .mjs som ESM
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules\/@thatopen/,
      type: "javascript/auto",
    });

    return config;
  },
  eslint: {
    // Lint kjøres separat via turbo lint
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/dashbord/prosjekter/:id",
        destination: "/dashbord/:id",
        permanent: false,
      },
      {
        source: "/dashbord/prosjekter/:id/sjekklister",
        destination: "/dashbord/:id/sjekklister",
        permanent: false,
      },
      {
        source: "/dashbord/prosjekter/:id/sjekklister/:sjekklisteId",
        destination: "/dashbord/:id/sjekklister/:sjekklisteId",
        permanent: false,
      },
      {
        source: "/dashbord/prosjekter/:id/oppgaver",
        destination: "/dashbord/:id/oppgaver",
        permanent: false,
      },
      {
        source: "/dashbord/prosjekter/:id/maler",
        destination: "/dashbord/:id/maler",
        permanent: false,
      },
      {
        source: "/dashbord/prosjekter/:id/maler/:malId",
        destination: "/dashbord/:id/maler/:malId",
        permanent: false,
      },
      {
        source: "/dashbord/prosjekter/:id/entrepriser",
        destination: "/dashbord/:id/entrepriser",
        permanent: false,
      },
      {
        source: "/dashbord/:id/punktskyer",
        destination: "/dashbord/:id/3d-visning",
        permanent: false,
      },
      {
        source: "/dashbord/:id/modeller",
        destination: "/dashbord/:id/3d-visning",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const apiPort = process.env.API_PORT || "3001";
    return [
      {
        source: "/api/upload",
        destination: `http://localhost:${apiPort}/upload`,
      },
      {
        source: "/api/uploads/:path*",
        destination: `http://localhost:${apiPort}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
