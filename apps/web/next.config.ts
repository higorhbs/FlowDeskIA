import type { NextConfig } from "next";

const firebaseHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
if (!firebaseHost) {
  throw new Error("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN é obrigatório.");
}

const staticHosting = process.env.FIREBASE_STATIC === "1";

const nextConfig: NextConfig = {
  output: staticHosting ? "export" : undefined,
  transpilePackages: ["@zapflow/shared", "@zapflow/firebase"],
  serverExternalPackages: ["firebase-admin"],
  redirects: async () => [{ source: "/landing", destination: "/", permanent: true }],
  rewrites: async () => [
    {
      source: "/__/auth/:path*",
      destination: `https://${firebaseHost}/__/auth/:path*`,
    },
    {
      source: "/__/firebase/:path*",
      destination: `https://${firebaseHost}/__/firebase/:path*`,
    },
  ],
  images: {
    unoptimized: staticHosting,
    remotePatterns: [
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudinary.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
