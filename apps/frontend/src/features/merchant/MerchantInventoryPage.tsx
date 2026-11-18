import { useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button, Input, Segmented } from "antd";
import { createCommerceClient } from "../../api/commerce-http";
import { useResource } from "../../api/useResource";
import { ErrorState, LoadingState } from "../../components/ui";
import { useToken } from "./merchant-page-support";
import { InventoryPanel, type InventoryAdjustment, type InventoryMovement } from "./InventoryPanel";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
type InventoryKind = "product" | "reward" | "voucher";

function csvCell(value: string | number | null | undefined) {
  if (typeof value === "number") return String(value);
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function exportMovements(movements: InventoryMovement[]) {
  const rows = [["Thời gian", "Loại", "Số lượng", "Trước", "Sau", "Đã giữ trước", "Đã giữ sau", "Ghi chú", "Người thực hiện"],
    ...movements.map((m) => [m.createdAt, m.movementType, m.quantityDelta, m.onHandBefore, m.onHandAfter, m.reservedBefore, m.reservedAfter, m.reason, m.actorEmail ?? (m.actorId == null ? "Hệ thống" : `#${m.actorId}`)])];
  const url = URL.createObjectURL(new Blob(["\ufeff", rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "lich-su-100-giao-dich.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function MerchantInventoryPage() {
  const { kind: rawKind, id: rawId } = useParams();
  const kind = rawKind as InventoryKind;
  const id = Number(rawId);
  const valid = ["product", "reward", "voucher"].includes(kind) && Number.isSafeInteger(id) && id > 0;
  const token = useToken();
  const [params, setParams] = useSearchParams();
  const mode = params.get("tab") === "history" ? "history" : "adjust";
  const [query, setQuery] = useState("");
  const retry = useRef<{ signature: string; key: string } | null>(null);
  const resource = useResource(() => {
    if (!valid) return Promise.reject(new Error("Mã tồn kho không hợp lệ."));
    return kind === "voucher" ? api.getVoucherInventory(id, token) : kind === "reward" ? api.getRewardInventory(id, token) : api.getProductInventory(id, token);
  }, [id, kind, token, valid]);
  const isVoucher = kind === "voucher";

  async function adjust(input: InventoryAdjustment) {
    const signature = JSON.stringify([kind, id, input.direction, input.quantity, input.reason.trim()]);
    if (retry.current?.signature !== signature) retry.current = { signature, key: globalThis.crypto?.randomUUID?.() ?? `stock-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const body = { quantity: input.quantity, reason: input.reason };
    const key = retry.current.key;
    if (isVoucher) await api.adjustVoucherInventory(id, input.direction, body, token, key);
    else if (kind === "reward") await api.adjustRewardInventory(id, input.direction, body, token, key);
    else await api.adjustProductInventory(id, input.direction, body, token, key);
    const updated = isVoucher ? await api.getVoucherInventory(id, token) : kind === "reward" ? await api.getRewardInventory(id, token) : await api.getProductInventory(id, token);
    resource.setData(updated);
    retry.current = null;
  }

  const movements = (resource.data?.movements ?? []).filter((m) => [m.reason, m.actorEmail, m.movementType, String(m.id)].some((value) => value?.toLocaleLowerCase("vi-VN").includes(query.trim().toLocaleLowerCase("vi-VN"))));
  return <section className="mx-auto grid w-full max-w-6xl gap-6">
    <Link to={isVoucher ? "/merchant/vouchers" : "/merchant/products"}>← {isVoucher ? "Quay lại voucher" : "Quay lại sản phẩm"}</Link>
    <h1 className="text-2xl font-bold">{isVoucher ? "Lượt phát hành voucher" : kind === "reward" ? "Tồn kho quà tặng" : "Tồn kho sản phẩm"} #{id}</h1>
    <div><Segmented aria-label="Chế độ tồn kho" value={mode} onChange={(value) => setParams(value === "history" ? { tab: "history" } : {})} options={[{ label: "Điều chỉnh", value: "adjust" }, { label: "Lịch sử", value: "history" }]} /></div>
    {resource.loading ? <LoadingState /> : resource.error || !resource.data ? <ErrorState message={resource.error ?? "Không tải được tồn kho."} retry={resource.reload} /> : <div className="surface min-w-0 rounded-2xl p-5 sm:p-7">
      {mode === "history" && <div className="mb-5 grid gap-3"><p className="text-sm text-[#53645a]">Tìm kiếm và xuất tối đa 100 giao dịch gần nhất.</p><div className="flex flex-wrap gap-3"><Input aria-label="Tìm lịch sử" placeholder="Ghi chú, loại hoặc người thực hiện" value={query} onChange={(event) => setQuery(event.target.value)} style={{ maxWidth: 360 }} allowClear /><Button disabled={!movements.length} onClick={() => exportMovements(movements)}>Xuất CSV</Button></div></div>}
      {mode === "history" && query.trim() && !movements.length && resource.data.movements.length ? <p className="text-sm text-[#53645a]">Không có giao dịch phù hợp.</p> : <InventoryPanel balance={resource.data.inventory} movements={movements} onAdjust={adjust} mode={mode} subject={isVoucher ? "voucher" : "product"} />}
    </div>}
  </section>;
}
