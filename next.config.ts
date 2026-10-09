import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Photos are pre-resized WebP served by Supabase Storage; the optimiser would only spend Netlify credits.
  images: { unoptimized: true },
  async redirects() {
    return [{ source: "/", destination: "/ru", permanent: false }];
  },
  // Demo through a tunnel (ngrok): serve the photos from this origin, so visitors never need the local Supabase.
  async rewrites() {
    if (process.env.PROXY_SUPABASE_STORAGE !== "1") return [];
    const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
    return [{ source: "/storage/v1/object/public/:path*", destination: `${supabase}/storage/v1/object/public/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // No X-Frame-Options: Telegram Web/Desktop open the Mini App in an iframe.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org" },
        ],
      },
    ];
  },
};

export default nextConfig;
