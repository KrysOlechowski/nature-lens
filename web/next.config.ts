import type { NextConfig } from "next";
import "./env";

const nextConfig: NextConfig = {
  // Repository-wide agent instructions are maintained in ../AGENTS.md.
  agentRules: false,
};

export default nextConfig;
