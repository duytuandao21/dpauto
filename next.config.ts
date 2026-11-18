import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  // shortcut: LAN IP of the dev machine for phone testing; update it if the IP changes.
  allowedDevOrigins: ["192.168.100.209"],
  rewrites() {
    const backend = process.env.API_INTERNAL_URL || "http://127.0.0.1:4002";
    return ["admin", "public"].map((area) => ({
      source: `/api/v1/${area}/:path*`,
      destination: `${backend}/api/v1/${area}/:path*`,
    }));
  },
  redirects() {
    return [
      {
        source: "/quanly/them",
        destination: "/co-van/tai-khoan",
        permanent: true,
      },
      {
        source: "/quanly/cai-dat",
        destination: "/co-van/tuy-chon",
        permanent: true,
      },
      { source: "/quanly/website", destination: "/co-van", permanent: true },
      {
        source: "/quanly/:path*",
        destination: "/co-van/:path*",
        permanent: true,
      },
      {
        source: "/co-van/them",
        destination: "/co-van/tai-khoan",
        permanent: true,
      },
      {
        source: "/co-van/cai-dat",
        destination: "/co-van/tuy-chon",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
