import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { dev }) {
    if (dev) {
      // Tell webpack's watcher to skip directories it should never need to scan.
      // Each ignored path reduces the number of concurrent scandir calls when
      // WATCHPACK_POLLING is true, which prevents ENOMEM on memory-constrained
      // Docker Desktop environments (especially on Windows).
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          // Already excluded by the anonymous volume in docker-compose, but
          // webpack doesn't know that — listing it here stops the poll entirely.
          "**/node_modules/**",
          "**/.next/**",
          "**/.git/**",
          // Build artefacts and OS noise
          "**/dist/**",
          "**/__pycache__/**",
          "**/.mypy_cache/**",
        ],
        // 1 s poll matches WATCHPACK_POLLING_INTERVAL in docker-compose.yml.
        // The default (300 ms) multiplied by thousands of files is the main
        // source of memory pressure.
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
