import type { Metadata, Viewport } from "next";
import { APP_META_DESCRIPTION, APP_PAGE_TITLE } from "@flowdesk/shared";

export const appMetadata: Metadata = {
  title: APP_PAGE_TITLE,
  description: APP_META_DESCRIPTION,
  applicationName: "FlowDesk",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
    other: [{ rel: "mask-icon", url: "/apple-icon.svg", color: "#16a34a" }],
  },
};

export const appViewport: Viewport = {
  themeColor: "#16a34a",
};
