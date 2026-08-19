import os from "node:os";
import type { NextConfig } from "next";

/** IPv4 LAN addresses so phones on the same Wi‑Fi can reach `next dev`. */
function lanDevOrigins(): string[] {
  const origins = new Set<string>();
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        origins.add(addr.address);
      }
    }
  }
  return [...origins];
}

const lanOrigins = ["localhost", "127.0.0.1", ...lanDevOrigins()];

const nextConfig: NextConfig = {
  allowedDevOrigins: lanOrigins,
  experimental: {
    serverActions: {
      allowedOrigins: lanOrigins,
    },
  },
};

export default nextConfig;
