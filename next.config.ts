import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Netlify handles output — no standalone needed */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
      },
    ],
  },
  allowedDevOrigins: [
    "preview-chat-8b085902-3657-49bf-bfe6-9a5d473f5836.space.z.ai",
    "*.space.z.ai",
  ],
};

export default nextConfig;
