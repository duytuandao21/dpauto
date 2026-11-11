import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
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
