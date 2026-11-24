import type { NextConfig } from "next";
import { renamedPaths } from "./src/lib/public-paths";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  // shortcut: LAN IP of the dev machine for phone testing; update it if the IP changes.
  allowedDevOrigins: ["192.168.100.209"],
  experimental: {
    // The /api rewrite buffers request bodies (default 10 MB) and times out after 30 s;
    // CMS uploads allow 20 MB images and 100 MB videos.
    proxyClientMaxBodySize: 110 * 1024 * 1024,
    proxyTimeout: 10 * 60 * 1000,
  },
  rewrites() {
    const backend = process.env.API_INTERNAL_URL || "http://127.0.0.1:4002";
    return ["admin", "public"].map((area) => ({
      source: `/api/v1/${area}/:path*`,
      destination: `${backend}/api/v1/${area}/:path*`,
    }));
  },
  redirects() {
    return [
      ...Object.entries(renamedPaths).flatMap(([from, to]) => [
        { source: from, destination: to, permanent: true },
        { source: `${from}/:path*`, destination: `${to}/:path*`, permanent: true },
      ]),
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
