import type { PlatformFeeFilters } from "../contracts/finance";
import type { ProductListQuery, PublicProductListQuery } from "../contracts/catalog";

type FetchLike = typeof fetch;

export function translateApiError(code: string): string {
  const translations: Record<string, string> = {
    ACCOUNT_SUSPENDED: "Tài khoản đang bị tạm khóa. Vui lòng liên hệ quản trị viên.",
    ACCOUNT_BANNED: "Tài khoản đã bị cấm khỏi hệ thống.",
    EMAIL_BLACKLISTED: "Địa chỉ email đã bị chặn trong danh sách đen.",
    MERCHANT_NOT_ACTIVE: "Cửa hàng đã bị tạm ngưng hoạt động.",
    UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
    MEMBER_NOT_FOUND: "Không tìm thấy thành viên trong cửa hàng.",
    ORDER_NOT_FOUND: "Không tìm thấy đơn hàng tương ứng.",
    INSUFFICIENT_PRODUCT_STOCK: "Sản phẩm không còn đủ số lượng. Hãy tải lại giỏ hàng.",
    VOUCHER_OUT_OF_STOCK: "Voucher đã hết lượt phát hành.",
    REWARD_OUT_OF_STOCK: "Quà đang hết hàng, merchant chưa thể xác nhận trao.",
    INSUFFICIENT_AVAILABLE_INVENTORY: "Số lượng xuất vượt quá hàng hiện có, bao gồm hàng đã giữ chỗ.",
    ORDER_RESERVATION_EXPIRED: "Thời gian giữ hàng đã hết. Vui lòng tạo đơn mới.",
    IDEMPOTENCY_KEY_CONFLICT: "Mã yêu cầu đã được dùng cho thao tác khác. Hãy thử lại.",
    CATEGORY_ALREADY_EXISTS: "Danh mục hoặc đường dẫn (slug) đã tồn tại.",
    CATEGORY_NOT_FOUND: "Không tìm thấy danh mục.",
    SKU_ALREADY_EXISTS: "Mã SKU đã tồn tại trong cửa hàng.",
    PRODUCT_NOT_FOUND: "Không tìm thấy sản phẩm.",
  };
  return translations[code] ?? code;
}

export async function requestJson<T>(
  fetcher: FetchLike,
  baseUrl: string,
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headers.set(key, value);
    }
  }
  const response = await fetcher(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Yêu cầu thất bại (${response.status})`;
    throw new Error(error);
  }
  return payload as T;
}

/** Only endpoints currently mounted by apps/backend/src/app.ts. */
export function financePath(path: string, filters: PlatformFeeFilters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return query.size ? `${path}?${query}` : path;
}

export function productQueryPath(path: string, filters: ProductListQuery | PublicProductListQuery = {}) {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.categoryId !== undefined) query.set("categoryId", String(filters.categoryId));
  if ("status" in filters && filters.status) query.set("status", filters.status);
  if ("kind" in filters && filters.kind) query.set("kind", filters.kind);
  if ("lowStock" in filters && filters.lowStock) query.set("lowStock", "true");
  if (filters.sort) query.set("sort", filters.sort);
  if (filters.page !== undefined) query.set("page", String(filters.page));
  if (filters.limit !== undefined) query.set("limit", String(filters.limit));
  return query.size ? `${path}?${query}` : path;
}
