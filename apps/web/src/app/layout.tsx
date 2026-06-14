import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { RootShell } from "@/components/layout/RootShell";
import { Providers } from "@/components/providers";
import { appMetadata, appViewport } from "@/lib/app-metadata";
import { cn } from "@/lib/utils";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = appMetadata;
export const viewport: Viewport = appViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className={cn(geist.className)} suppressHydrationWarning>
        <script src="/theme-init.js" defer />
        <Providers>
          <RootShell>{children}</RootShell>
        </Providers>
      </body>
    </html>
  );
}
