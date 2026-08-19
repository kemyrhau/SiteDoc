/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pakke A / A7: fjern «X-Powered-By: Next.js» (avslører rammeverk/versjon).
  poweredByHeader: false,
  experimental: {
    // `sharp` (2026-08-14): arkivmalens bilde-komprimering (`services/arkiv/bilde-inliner.ts`)
    // importerer sharp statisk. Den når web-bygget via router.ts → tRPC-ruten, og
    // Next forsøkte å bundle den ved «Collecting page data» → «Could not load the
    // "sharp" module using the linux-x64 runtime» (sharp har plattform-binærer som
    // ikke kan bundles). Ekstern-lista lar den lastes som vanlig node-modul i api.
    serverComponentsExternalPackages: ["pdf-parse", "exceljs", "fast-xml-parser", "pdfjs-dist", "@xenova/transformers", "onnxruntime-node", "sharp"],
    // Aktiverer src/instrumentation.ts (boot-guard for FIL_SIGNING_SECRET —
    // tRPC/signering kjører i web-prosessen). Next 14.2 krever eksplisitt flagg.
    instrumentationHook: true,
  },
  transpilePackages: ["@sitedoc/shared", "@sitedoc/ui"],
  webpack: (config, { isServer }) => {
    // pdfjs-dist bruker canvas som optional dependency — ignorer i webpack
    config.resolve.alias.canvas = false;

    // web-ifc WASM — tillat async WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Ikke bundle server-only pakker
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(
        "web-ifc", "@thatopen/components", "@thatopen/fragments",
        "@xenova/transformers", "onnxruntime-node", "onnxruntime-common",
        // sharp (2026-08-14): har plattform-spesifikke binærer som ikke kan
        // bundles. Når tRPC-ruten via api/src/routes/tegning.ts (og arkivmalens
        // bilde-inliner). `serverComponentsExternalPackages` er IKKE nok — den
        // gjelder Server Components, ikke route handlers i App Router, så
        // «Collecting page data» for /api/trpc/[...trpc] feilet med
        // «Could not load the "sharp" module using the linux-x64 runtime».
        // Her, i webpack-externals for isServer, er stedet den faktisk løses.
        "sharp",
      );
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
  // Pakke A / A7: sikkerhets-headere på hele flaten. Web (port 3100) er hele
  // den offentlige overflaten bak Cloudflare Tunnel — det finnes ingen egen
  // nginx/proxy i repoet, så headerne settes her.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // HSTS (High). Ett år. Bevisst UTEN includeSubDomains/preload:
          // sitedoc.no deler domene med api/test/ssh/embed + annen infra, og
          // preload er tungt reverserbart. Kan skjerpes når alle subdomener er
          // bekreftet HTTPS-only. Cloudflare terminerer TLS; nettleseren ser HTTPS.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },
          // Klikkjacking-vern (Medium). SAMEORIGIN, ikke DENY, fordi appen selv
          // rammer egne sider (split-view PDF, dokumentleser embed-modus).
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        // Del C: «Lokasjon» → «Byggeplass»-rename. Temporær redirect i
        // overgangsperiode (bokmerker/lenker).
        source: "/dashbord/oppsett/lokasjoner",
        destination: "/dashbord/oppsett/byggeplasser",
        permanent: false,
      },
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
