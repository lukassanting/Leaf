import type { NextConfig } from "next";

const WATCH_IGNORED = [
  // Prevents webpack from polling these directories.
  // node_modules is an anonymous volume in Docker but webpack doesn't know that.
  "**/node_modules/**",
  "**/.next/**",
  "**/.git/**",
  "**/dist/**",
  "**/__pycache__/**",
];

const nextConfig: NextConfig = {
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: WATCH_IGNORED,
        // Match WATCHPACK_POLLING_INTERVAL in docker-compose.yml.
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
