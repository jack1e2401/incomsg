import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "react-router-dom";
import type { OrderDto } from "../../api/commerce-types";
import { Button } from "../../components/ui";

export interface MerchantRefundDialogProps { order: OrderDto | null; onClose: () => void; onRefundCompleted?: (updatedOrder: OrderDto, notice: string) => void }

/** Compatibility dialog: refunds now always go through merchant and admin request approvals. */
export function MerchantRefundDialog({ order, onClose }: MerchantRefundDialogProps) {
  if (!order) return null;
  return <Dialog.Root open onOpenChange={(open) => !open && onClose()}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45"/><Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"><Dialog.Title className="text-lg font-bold">Đơn #{order.id}</Dialog.Title><p className="my-4 text-sm">Yêu cầu hoàn tiền được xử lý qua quy trình phê duyệt của Merchant và Admin.</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Đóng</Button><Button asChild><Link to="/merchant/refund-requests" onClick={onClose}>Mở yêu cầu hoàn tiền</Link></Button></div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
