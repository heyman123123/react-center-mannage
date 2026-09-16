/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端 API 基础地址（默认 /api/v1，由 Vite 代理到 :8080） */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
