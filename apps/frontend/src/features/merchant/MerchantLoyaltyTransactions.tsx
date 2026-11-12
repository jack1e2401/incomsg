import { useEffect, useState, type FormEvent } from "react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { MerchantLedgerItemDto, PointTransactionType } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Select,
  StatusText,
} from "../../components/ui";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function useToken() {
  const { accessToken } = useAuthSession();
  if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn");
  return accessToken;
}

export function transactionTypeLabel(type: PointTransactionType): string {
  switch (type) {
    case "EARN":
      return "Tích điểm";
    case "REDEEM_DISCOUNT":
      return "Đổi ưu đãi";
    case "REDEEM_REWARD":
      return "Đổi quà";
    case "EARN_REVERSAL":
      return "Thu hồi tích điểm";
    case "REDEMPTION_REVERSAL":
      return "Hoàn điểm đổi thưởng";
    case "ADMIN_ADJUSTMENT":
      return "Điều chỉnh quản trị";
    case "LEGACY_BACKFILL":
      return "Khởi tạo ban đầu";
    default:
      return type;
  }
}

export function MerchantLoyaltyTransactions() {
  const token = useToken();
  const [memberIdInput, setMemberIdInput] = useState("");
  const [orderIdInput, setOrderIdInput] = useState("");
  const [typeInput, setTypeInput] = useState<PointTransactionType | "">("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [filters, setFilters] = useState<{
    memberId?: number;
    orderId?: number;
    type?: PointTransactionType;
    from?: string;
    to?: string;
    cursor?: string;
  }>({});

  const resource = useResource(() => api.listMerchantTransactions(filters, token), [filters, token]);
  const [transactions, setTransactions] = useState<MerchantLedgerItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    const page = resource.data;
    if (!page) return;

    setTransactions((current) => {
      if (filters.cursor === undefined) return page.items;
      const uniqueItems = new Map(current.map((item) => [item.id, item]));
      page.items.forEach((item) => uniqueItems.set(item.id, item));
      return [...uniqueItems.values()];
    });
    setNextCursor(page.nextCursor);
  }, [filters.cursor, resource.data]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTransactions([]);
    setNextCursor(null);
    setFilters({
      memberId: memberIdInput ? Number(memberIdInput) : undefined,
      orderId: orderIdInput ? Number(orderIdInput) : undefined,
      type: typeInput ? typeInput : undefined,
      from: fromInput ? fromInput : undefined,
      to: toInput ? toInput : undefined,
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <form onSubmit={applyFilters} className="grid gap-3 sm:grid-cols-6">
          <Field label="ID Thành viên">
            <Input
              type="number"
              placeholder="VD: 9"
              value={memberIdInput}
              onChange={(e) => setMemberIdInput(e.target.value)}
            />
          </Field>
          <Field label="ID Đơn hàng">
            <Input
              type="number"
              placeholder="VD: 41"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
            />
          </Field>
          <Field label="Loại giao dịch">
            <Select
              value={typeInput}
              onChange={(e) => setTypeInput(e.target.value as PointTransactionType | "")}
            >
              <option value="">Tất cả loại</option>
              <option value="EARN">Tích điểm (EARN)</option>
              <option value="EARN_REVERSAL">Thu hồi tích điểm (EARN_REVERSAL)</option>
              <option value="REDEEM_DISCOUNT">Đổi ưu đãi (REDEEM_DISCOUNT)</option>
              <option value="REDEEM_REWARD">Đổi quà (REDEEM_REWARD)</option>
              <option value="REDEMPTION_REVERSAL">Hoàn điểm đổi quà (REDEMPTION_REVERSAL)</option>
              <option value="ADMIN_ADJUSTMENT">Điều chỉnh quản trị (ADMIN_ADJUSTMENT)</option>
            </Select>
          </Field>
          <Field label="Từ ngày">
            <Input type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)} />
          </Field>
          <Field label="Đến ngày">
            <Input type="date" value={toInput} onChange={(e) => setToInput(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Tìm kiếm
            </Button>
          </div>
        </form>
      </Card>

      {resource.loading && !transactions.length ? (
        <LoadingState cards={2} />
      ) : resource.error && !transactions.length ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !transactions.length ? (
        <EmptyState
          title="Không có giao dịch"
          description="Chưa có giao dịch điểm nào khớp với tiêu chí tìm kiếm."
        />
      ) : (
        <div className="space-y-3">
          {resource.error && <ErrorState message={resource.error} retry={resource.reload} />}
          {transactions.map((tx) => {
            const isNeg = tx.delta.startsWith("-");
            return (
              <Card key={tx.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#5c7263]">#{tx.id}</span>
                    {tx.eventRef && (
                      <span className="rounded bg-[#f0f4ee] px-2 py-0.5 font-mono text-[11px] text-[#42594a]">
                        {tx.eventRef}
                      </span>
                    )}
                    <StatusText tone={isNeg ? "red" : "green"}>{transactionTypeLabel(tx.type)}</StatusText>
                  </div>
                  <p className="mt-1 font-bold text-[#20392a]">{tx.reason}</p>
                  <p className="mt-1 text-xs muted">
                    Thành viên #{tx.memberId} {tx.memberEmail && `(${tx.memberEmail})`} ·{" "}
                    {new Date(tx.createdAt).toLocaleString("vi-VN")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs muted">
                    {tx.orderId && <span>Đơn hàng #{tx.orderId}</span>}
                    {tx.memberVoucherId && <span>Voucher #{tx.memberVoucherId}</span>}
                    {tx.source && <span>Nguồn: {tx.source}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-extrabold text-lg ${isNeg ? "text-[#a4473a]" : "text-[#357044]"}`}>
                    {isNeg ? tx.delta : `+${tx.delta}`}
                  </p>
                  <p className="mt-1 text-xs muted">Số dư sau GD: {tx.balanceAfter}</p>
                  <p className="text-xs muted">Điểm khả dụng sau GD: {tx.availablePointsAfter}</p>
                  <p className="text-xs muted">Phần dư sau GD: {tx.fractionalCarryAfter}</p>
                  <p className={`text-xs ${tx.pointDebtAfter !== "0" ? "text-[#a4473a]" : "muted"}`}>
                    Nợ điểm sau GD: {tx.pointDebtAfter}
                  </p>
                </div>
              </Card>
            );
          })}
          {resource.loading && (
            <p role="status" className="text-center text-sm muted">
              Đang tải giao dịch tiếp theo…
            </p>
          )}
          {nextCursor && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={resource.loading}
                onClick={() => setFilters((f) => ({ ...f, cursor: nextCursor }))}
              >
                Xem thêm giao dịch
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
