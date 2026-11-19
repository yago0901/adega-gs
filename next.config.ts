import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;