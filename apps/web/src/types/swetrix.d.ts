interface SwetrixInitOptions {
  apiURL?: string;
  devMode?: boolean;
  disabled?: boolean;
  respectDNT?: boolean;
  profileId?: string;
}

interface SwetrixClient {
  init: (projectId: string, options?: SwetrixInitOptions) => unknown;
  trackViews: (options?: Record<string, unknown>) => Promise<unknown>;
}

declare global {
  interface Window {
    swetrix?: SwetrixClient;
  }
}

export {};
