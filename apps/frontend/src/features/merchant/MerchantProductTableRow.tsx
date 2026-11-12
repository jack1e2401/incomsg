import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DotsThreeVertical, Eye, EyeSlash } from "@phosphor-icons/react";
import { createCommerceClient } from "../../api/commerce-http";
import type { ProductDto } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { money } from "../../lib/utils";
import type { InventoryAdjustment } from "./InventoryPanel";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

type Props = {
  product: ProductDto;
  token: string;
  refreshKey: number;
  onEdit(): void;
  onStatusChange(): void;
};

const movementLabels: Record<string, string> = {
  INITIAL_STOCK: "Tồn kho ban đầu",
  MANUAL_IN: "Nhập kho",
  MANUAL_OUT: "Xuất kho",
  RETURN_IN: "Nhập hàng trả",
  ORDER_RESERVE: "Giữ hàng cho đơn",
  ORDER_RELEASE: "Hoàn hàng giữ của đơn",
  SALE_OUT: "Đã bán",
  REWARD_RESERVE: "Giữ hàng đổi thưởng",
  REWARD_CANCEL_RELEASE: "Hoàn giữ quà bị hủy",
  REWARD_FULFILL_OUT: "Đã trao quà",
  VOUCHER_REDEMPTION_OUT: "Đã phát hành ưu đãi",
  REDEMPTION_REVERSAL_IN: "Hoàn số lượng ưu đãi",
  REWARD_LEGACY_RESERVE: "Giữ hàng đổi trước đây",
  LEGACY_BACKFILL: "Chuyển dữ liệu tồn kho",
};

function newRequestKey(productId: number) {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `stock-${productId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function MerchantProductTableRow({ product, token, refreshKey, onEdit, onStatusChange }: Props) {
  const resource = useResource(
    () => product.kind === "REWARD"
      ? api.getRewardInventory(product.id, token)
      : api.getProductInventory(product.id, token),
    [product.id, product.kind, token, refreshKey],
  );
  const [dialog, setDialog] = useState<"adjust" | "history" | null>(null);
  const [direction, setDirection] = useState<InventoryAdjustment["direction"]>("in");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [manualRequestKey, setManualRequestKey] = useState("");

  async function adjust() {
    const parsedQuantity = Number(quantity);
    const trimmedNote = note.trim();
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError("Số lượng phải là số nguyên dương.");
      return;
    }
    if (!trimmedNote) {
      setError("Vui lòng ghi chú nội dung điều chỉnh.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const requestKey = manualRequestKey || newRequestKey(product.id);
      setManualRequestKey(requestKey);
      const body = { quantity: parsedQuantity, reason: trimmedNote };
      if (product.kind === "REWARD") {
        await api.adjustRewardInventory(product.id, direction, body, token, requestKey);
        resource.setData(await api.getRewardInventory(product.id, token));
      } else {
        await api.adjustProductInventory(product.id, direction, body, token, requestKey);
        resource.setData(await api.getProductInventory(product.id, token));
      }
      setNotice("Đã cập nhật tồn kho.");
      setQuantity("");
      setNote("");
      setManualRequestKey("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật tồn kho.");
    } finally {
      setBusy(false);
    }
  }

  const movements = resource.data?.movements ?? [];
  const dateTime = (value: string) => new Date(value).toLocaleString("vi-VN");

  return (
    <>
      <tr className="border-t border-[#edf1ea] align-middle">
        <td className="px-5 py-4">
          <p className="font-bold text-[#20392a]">{product.name}</p>
          <p className="mt-1 text-xs muted">Mã sản phẩm #{product.id}</p>
        </td>
        <td className="px-4 py-4 text-sm">{product.kind === "REWARD" ? "Đổi thưởng" : "Bán"}</td>
        <td className="px-4 py-4 text-sm font-semibold whitespace-nowrap">
          {product.kind === "REWARD" ? "—" : money(Number(product.price))}
        </td>
        <td className="px-4 py-4 text-sm whitespace-nowrap">
          {resource.loading ? <span className="muted">Đang tải…</span> : resource.error || !resource.data ? (
            <span className="text-[#a4473a]" title={resource.error ?? undefined}>Chưa có dữ liệu</span>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <span className="whitespace-nowrap"><b>{resource.data.inventory.onHandQuantity}</b><span className="ml-1 text-xs muted">tồn</span></span>
              <span className="whitespace-nowrap"><b>{resource.data.inventory.reservedQuantity}</b><span className="ml-1 text-xs muted">giữ</span></span>
              <span className="whitespace-nowrap"><b>{resource.data.inventory.availableQuantity}</b><span className="ml-1 text-xs muted">có thể bán</span></span>
            </div>
          )}
        </td>
        <td className="px-4 py-4">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${product.status === "ACTIVE" ? "bg-[#edf4e9] text-[#357044]" : "bg-[#fff3dd] text-[#97682a]"}`}>
            {product.status === "HIDDEN" ? "Đã ẩn" : product.kind === "REWARD" ? "Đang hoạt động" : "Đang bán"}
          </span>
        </td>
        <td className="px-4 py-4 text-right">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label={`Thao tác sản phẩm ${product.name}`}
                className="inline-grid h-9 w-9 place-items-center rounded-full text-[#516357] hover:bg-[#edf3e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8eae91]"
              >
                <DotsThreeVertical size={20} weight="bold" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className="surface z-50 min-w-48 rounded-2xl p-1.5 shadow-xl">
                <DropdownMenu.Item className="cursor-pointer rounded-xl px-3 py-2 text-sm outline-none hover:bg-[#edf4e9] focus:bg-[#edf4e9]" onSelect={() => { setDialog("adjust"); setError(""); setNotice(""); }}>
                  Điều chỉnh tồn kho
                </DropdownMenu.Item>
                <DropdownMenu.Item className="cursor-pointer rounded-xl px-3 py-2 text-sm outline-none hover:bg-[#edf4e9] focus:bg-[#edf4e9]" onSelect={() => setDialog("history")}>
                  Lịch sử tồn kho
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-[#edf1ea]" />
                <DropdownMenu.Item className="cursor-pointer rounded-xl px-3 py-2 text-sm outline-none hover:bg-[#edf4e9] focus:bg-[#edf4e9]" onSelect={onEdit}>
                  Chỉnh sửa sản phẩm
                </DropdownMenu.Item>
                <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none hover:bg-[#edf4e9] focus:bg-[#edf4e9]" onSelect={onStatusChange}>
                  {product.status === "ACTIVE" ? <EyeSlash size={16} /> : <Eye size={16} />}
                  {product.status === "ACTIVE" ? "Ẩn sản phẩm" : "Hiển thị sản phẩm"}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </td>
      </tr>

      <Dialog.Root open={dialog !== null} onOpenChange={(open) => !busy && !open && setDialog(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
          <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
            {dialog === "adjust" ? (
              <>
                <Dialog.Title className="text-xl font-extrabold text-[#20392a]">Điều chỉnh tồn kho</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm muted">{product.name}</Dialog.Description>
                {resource.data && <p className="mt-4 rounded-xl bg-[#f7f9f5] p-3 text-sm">Có thể bán: <b>{resource.data.inventory.availableQuantity}</b></p>}
                <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-[#f3f6f0] p-1">
                  <button type="button" onClick={() => { setDirection("in"); setManualRequestKey(""); }} className={`rounded-lg px-3 py-2 text-sm font-bold ${direction === "in" ? "bg-white text-[#335e3d] shadow-sm" : "muted"}`}>Tăng</button>
                  <button type="button" onClick={() => { setDirection("out"); setManualRequestKey(""); }} className={`rounded-lg px-3 py-2 text-sm font-bold ${direction === "out" ? "bg-white text-[#335e3d] shadow-sm" : "muted"}`}>Giảm</button>
                </div>
                <label className="mt-4 grid gap-1 text-sm font-semibold">Số lượng
                  <input aria-label="Số lượng" className="rounded-xl border border-[#dce6da] px-3 py-2.5" inputMode="numeric" min="1" max="2147483647" step="1" type="number" value={quantity} onChange={(event) => { setQuantity(event.target.value); setManualRequestKey(""); }} />
                </label>
                <label className="mt-4 grid gap-1 text-sm font-semibold">Ghi chú
                  <input aria-label="Ghi chú" className="rounded-xl border border-[#dce6da] px-3 py-2.5" maxLength={255} value={note} onChange={(event) => { setNote(event.target.value); setManualRequestKey(""); }} placeholder="Ví dụ: Nhập hàng từ nhà cung cấp" />
                </label>
                {error && <p role="alert" className="mt-4 text-sm text-[#a4473a]">{error}</p>}
                {notice && <p role="status" className="mt-4 text-sm text-[#357044]">{notice}</p>}
                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" disabled={busy} onClick={() => setDialog(null)} className="rounded-full px-4 py-2 text-sm font-bold text-[#516357] hover:bg-[#edf3e9]">Đóng</button>
                  <button type="button" disabled={busy} onClick={() => void adjust()} className="rounded-full bg-[#335e3d] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang lưu…" : direction === "in" ? "Tăng tồn kho" : "Giảm tồn kho"}</button>
                </div>
              </>
            ) : (
              <>
                <Dialog.Title className="text-xl font-extrabold text-[#20392a]">Lịch sử tồn kho</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm muted">{product.name}</Dialog.Description>
                {!resource.data && <p className="mt-5 text-sm muted">{resource.loading ? "Đang tải lịch sử…" : "Không tải được lịch sử tồn kho."}</p>}
                {resource.data && movements.length === 0 && <p className="mt-5 text-sm muted">Chưa có thay đổi tồn kho.</p>}
                <ol className="mt-5 divide-y divide-[#edf1ea]">
                  {movements.map((movement) => (
                    <li key={movement.id} className="py-4 first:pt-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold">{movementLabels[movement.movementType] ?? "Thay đổi tồn kho"}</p>
                          <p className="mt-1 text-xs muted">{movement.actorEmail ?? (movement.actorId ? `Tài khoản #${movement.actorId}` : "Hệ thống")} · {dateTime(movement.createdAt)}</p>
                        </div>
                        <span className={`font-extrabold ${movement.quantityDelta > 0 ? "text-[#357044]" : "text-[#a4473a]"}`}>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</span>
                      </div>
                      <p className="mt-2 text-sm">Tồn: {movement.onHandBefore} → {movement.onHandAfter} <span className="mx-1 muted">·</span> Đã giữ: {movement.reservedBefore} → {movement.reservedAfter}</p>
                      {movement.reason && <p className="mt-1 text-sm muted">Ghi chú: {movement.reason}</p>}
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex justify-end"><button type="button" onClick={() => setDialog(null)} className="rounded-full px-4 py-2 text-sm font-bold text-[#516357] hover:bg-[#edf3e9]">Đóng</button></div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
