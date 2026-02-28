/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@siteflow/shared", "@siteflow/ui"],
  eslint: {
    // Lint kjøres separat via turbo lint
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
