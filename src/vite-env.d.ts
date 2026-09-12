/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 是否使用前端 Mock 数据（"true" 启用，默认 true） */
  readonly VITE_USE_MOCK?: string;
  /** 真实后端 API 基础地址 */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
