import { useId, useState } from "react";

export type InventoryBalance = {
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
};

export type InventoryMovement = {
  id: number | string;
  movementType: string;
  quantityDelta: number;
  onHandBefore: number;
  onHandAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  reason: string;
  actorId?: number | null;
  actorEmail?: string | null;
  createdAt: string;
};

export type InventoryAdjustment = {
  direction: "in" | "out";
  quantity: number;
  reason: string;
  returnToStock?: boolean;
};

export type InventoryPanelProps = {
  balance: InventoryBalance;
  movements: InventoryMovement[];
  onAdjust: (adjustment: InventoryAdjustment) => Promise<unknown>;
  mode?: "adjust" | "history";
  availableLabel?: string;
};

const dateTime = (value: string) => new Date(value).toLocaleString("vi-VN");

const movementLabels: Record<string, string> = {
  INITIAL_STOCK: "Tồn kho ban đầu",
  MANUAL_IN: "Nhập kho thủ công",
  MANUAL_OUT: "Xuất kho thủ công",
  RETURN_IN: "Nhập lại hàng trả",
  ORDER_RESERVE: "Giữ hàng cho đơn",
  ORDER_RELEASE: "Hoàn hàng giữ của đơn",
  SALE_OUT: "Đã bán",
  REWARD_RESERVE: "Giữ hàng đổi thưởng",
  REWARD_CANCEL_RELEASE: "Hoàn giữ quà bị hủy",
  REWARD_FULFILL_OUT: "Đã trao quà",
  VOUCHER_REDEMPTION_OUT: "Đã phát hành ưu đãi",
  REDEMPTION_REVERSAL_IN: "Hoàn số lượng ưu đãi",
  REWARD_LEGACY_RESERVE: "Giữ hàng cho lượt đổi trước đây",
  LEGACY_BACKFILL: "Chuyển dữ liệu tồn kho",
};

function actorLabel(movement: InventoryMovement) {
  if (movement.actorEmail) return movement.actorEmail;
  if (movement.actorId !== null && movement.actorId !== undefined) return `Tài khoản #${movement.actorId}`;
  return "Hệ thống";
}

export function InventoryPanel({
  balance,
  movements,
  onAdjust,
  mode,
  availableLabel = "Có thể bán",
}: InventoryPanelProps) {
  const titleId = useId();
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: { preventDefault: () => void }, direction: InventoryAdjustment["direction"]) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const parsedQuantity = Number(quantity);
    const trimmedReason = reason.trim();
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError("Số lượng phải là số nguyên dương.");
      return;
    }
    if (!trimmedReason) {
      setError("Vui lòng nhập ghi chú.");
      return;
    }

    setLoading(true);
    try {
      await onAdjust({ direction, quantity: parsedQuantity, reason: trimmedReason });
      setSuccess("Tồn kho đã được cập nhật.");
      setQuantity("");
      setReason("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật tồn kho.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      className={mode ? "space-y-5" : "space-y-5 rounded-2xl border border-[#e4e9e1] bg-white p-5"}
    >
      <h2 id={titleId} className={mode ? "sr-only" : "text-lg font-bold"}>
        Tồn kho
      </h2>
      {mode !== "history" && (
        <>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="muted">Tồn thực tế</dt>
              <dd className="mt-1 text-xl font-bold">{balance.onHandQuantity}</dd>
            </div>
            <div>
              <dt className="muted">Đã giữ chỗ</dt>
              <dd className="mt-1 text-xl font-bold">{balance.reservedQuantity}</dd>
            </div>
            <div>
              <dt className="muted">{availableLabel}</dt>
              <dd className="mt-1 text-xl font-bold">{balance.availableQuantity}</dd>
            </div>
          </dl>

          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
            <label className="grid gap-1 text-sm font-semibold">
              Số lượng
              <input
                aria-label="Số lượng"
                className="rounded-lg border px-3 py-2"
                inputMode="numeric"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Ghi chú
              <input
                aria-label="Ghi chú"
                className="rounded-lg border px-3 py-2"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="button"
                disabled={loading}
                onClick={(event) => void submit(event, "in")}
                className="rounded-lg bg-[#315c3c] px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {loading ? "Đang lưu…" : "Nhập kho"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={(event) => void submit(event, "out")}
                className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-60"
              >
                {loading ? "Đang lưu…" : "Xuất kho"}
              </button>
            </div>
            {error && (
              <p role="alert" className="sm:col-span-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {success && (
              <p role="status" className="sm:col-span-2 text-sm text-green-800">
                {success}
              </p>
            )}
          </form>
        </>
      )}

      {mode !== "adjust" && (
        <div>
          {mode !== "history" && <h3 className="mb-2 font-bold">Lịch sử điều chỉnh</h3>}
          {movements.length === 0 ? (
            <p className="text-sm muted">Chưa có lịch sử tồn kho.</p>
          ) : (
            <ul className="divide-y divide-[#edf1ea]">
              {movements.map((movement) => (
                <li key={movement.id} className="py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">{movement.reason}</span>
                    <span>
                      {movement.quantityDelta > 0 ? "+" : ""}
                      {movement.quantityDelta}
                    </span>
                  </div>
                  <p className="mt-1">{movementLabels[movement.movementType] ?? movement.movementType}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 muted">
                    <span>
                      Tồn: {movement.onHandBefore} → {movement.onHandAfter}
                    </span>
                    <span>
                      Đã giữ: {movement.reservedBefore} → {movement.reservedAfter}
                    </span>
                    <span>Thực hiện bởi {actorLabel(movement)}</span>
                    <time dateTime={movement.createdAt}>{dateTime(movement.createdAt)}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
