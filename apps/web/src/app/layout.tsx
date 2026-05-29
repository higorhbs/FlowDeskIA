import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ToasterHost } from "@/components/toaster-host";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AtendeJa — Atendimento automático no WhatsApp",
  description: "Resposta automática para WhatsApp de pequenos negócios",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable)}
    >
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          {children}
          <ToasterHost />
        </Providers>
      </body>
    </html>
  );
}
