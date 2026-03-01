/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@siteflow/shared", "@siteflow/ui"],
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
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/upload",
        destination: "http://localhost:3001/upload",
      },
      {
        source: "/api/uploads/:path*",
        destination: "http://localhost:3001/uploads/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
