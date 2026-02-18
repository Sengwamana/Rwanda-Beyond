/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_ENABLE_VOICE_ASSISTANT: string;
  readonly VITE_ENABLE_ANALYTICS: string;
  readonly VITE_MAPBOX_ACCESS_TOKEN: string;
  readonly VITE_SENTRY_DSN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
