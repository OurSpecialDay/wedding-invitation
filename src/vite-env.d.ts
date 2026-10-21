/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RSVP_ADMIN_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
