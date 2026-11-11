/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_MODE?: "mock" | "http";
  readonly VITE_PAYMENT_MODE?: "mock" | "vnpay";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
