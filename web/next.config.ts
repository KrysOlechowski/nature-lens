import type { NextConfig } from "next";
import "./env";

const nextConfig: NextConfig = {
  // Repository-wide agent instructions are maintained in ../AGENTS.md.
  agentRules: false,
  ...(process.env.NATURE_LENS_E2E === "true" ? { distDir: ".next-e2e" } : {}),
};

export default nextConfig;
