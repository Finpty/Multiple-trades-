import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "sharp", "bcryptjs"],
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  images: { unoptimized: true },
  // Tenant sites are served from many hostnames; never assume a single origin.
  poweredByHeader: false,
};

export default nextConfig;
