/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporary override so a production build can run beside `next dev`
  // without both processes writing the same .next directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
