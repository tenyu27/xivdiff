/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the FFLogs proxy worker. */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
