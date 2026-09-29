import type { NextConfig } from "next";

const isLocalSandbox = process.env.YSABAL_LOCAL_SANDBOX === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: isLocalSandbox
    ? {
        // Solo evita que el entorno de validación local intente abrir procesos
        // secundarios. Vercel usa la configuración estable de Next.js.
        workerThreads: true,
        webpackBuildWorker: false,
      }
    : {},
};

export default nextConfig;
