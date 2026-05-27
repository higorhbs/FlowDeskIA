import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildApp } from "../src/app";

let appPromise: ReturnType<typeof buildApp> | null = null;

function getApp() {
  if (!appPromise) {
    appPromise = buildApp().then(async (app) => {
      await app.ready();
      return app;
    });
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();
    await new Promise<void>((resolve, reject) => {
      res.on("finish", resolve);
      res.on("error", reject);
      app.server.emit("request", req, res);
    });
  } catch (err) {
    console.error("[vercel-handler]", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal Server Error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
}
