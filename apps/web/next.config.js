/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@dorsu/shared-types",
    "@dorsu/shared-schemas",
    "@dorsu/shared-services",
    "@dorsu/supabase-client",
    "@dorsu/ui-tokens",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "source.unsplash.com" },
      { protocol: "https", hostname: "illustrations.undraw.co" },
    ],
  },
};

module.exports = nextConfig;
