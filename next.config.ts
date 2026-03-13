import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cloud.appwrite.io",
      },
      {
        protocol: "https",
        hostname: "*.appwrite.io",
      },
      {
        protocol: "https",
        hostname: "appwrite.io",
      },
    ],
  },
};

export default nextConfig;
