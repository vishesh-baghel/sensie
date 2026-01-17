import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Optimize lucide-react imports to avoid barrel file issues
    // This reduces bundle size by ~500KB and speeds up dev boot by 2-3s
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
