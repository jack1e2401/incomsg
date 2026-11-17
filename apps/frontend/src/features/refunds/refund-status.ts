import type { RefundRequestStatus } from "../../api/refunds-types";

export function isRefundAwaitingMerchant(status: RefundRequestStatus) {
  return status === "PENDING_MERCHANT" || status === "PENDING_ADMIN";
}

export function refundRequestStatusLabel(status: RefundRequestStatus) {
  if (isRefundAwaitingMerchant(status)) return "Chờ cửa hàng duyệt";
  switch (status) {
    case "COMPLETED": return "Đã hoàn tiền";
    case "REJECTED": return "Từ chối hoàn tiền";
    case "FAILED": return "Yêu cầu hoàn tiền thất bại";
    default: return "Đang xử lý hoàn tiền";
  }
}
