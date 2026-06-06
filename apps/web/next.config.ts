import type { NextConfig } from "next";

const firebaseHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
if (!firebaseHost) {
  throw new Error("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN é obrigatório.");
}

const nextConfig: NextConfig = {
  transpilePackages: ["@flowdesk/shared", "@flowdesk/firebase"],
  serverExternalPackages: ["firebase-admin"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  redirects: async () => [],
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
    remotePatterns: [
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudinary.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

export default nextConfig;
