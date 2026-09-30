/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Hex pubkey that publishes the app as the "ostrich" named nsite (optional). */
  readonly VITE_APP_NSITE_PUBKEY?: string;
}
