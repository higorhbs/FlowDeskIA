/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@zapflow/shared"],
  images: {
    remotePatterns: [
      // Imagens do catálogo via URL externa (ex: uploads S3, Cloudinary, etc.)
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudinary.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
    // Permite também data: URLs para QR Codes gerados localmente
    dangerouslyAllowSVG: false,
  },
  // Next 15: sem aviso sobre params assíncronos
  experimental: {},
};

module.exports = nextConfig;
