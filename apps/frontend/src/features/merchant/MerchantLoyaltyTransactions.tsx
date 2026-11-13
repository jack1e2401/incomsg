import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { MerchantLedgerItemDto, PointTransactionType } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { financeDateTime } from "../finance/finance-format";
import { pastYearRange, vietnamDateBounds } from "../../lib/vietnam-date";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Select,
  StatCard,
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
  const [defaultRange] = useState(pastYearRange);
  const [fromInput, setFromInput] = useState(defaultRange.from);
  const [toInput, setToInput] = useState(defaultRange.to);
  const [filters, setFilters] = useState<{
    memberId?: number;
    orderId?: number;
    type?: PointTransactionType;
    from?: string;
    to?: string;
    cursor?: string;
  }>(() => vietnamDateBounds(defaultRange.from, defaultRange.to));

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
      ...vietnamDateBounds(fromInput, toInput),
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
            </Select>
          </Field>
          <Field label="Từ ngày">
            <Input
              type="date"
              max={toInput || defaultRange.to}
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
            />
          </Field>
          <Field label="Đến ngày">
            <Input
              type="date"
              min={fromInput || undefined}
              max={defaultRange.to}
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Tìm kiếm
            </Button>
          </div>
        </form>
      </Card>

      {resource.data?.summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Điểm đã tích" value={resource.data.summary.earned} />
          <StatCard label="Điểm đã đổi" value={resource.data.summary.redeemed} />
          <StatCard label="Điểm thu hồi" value={resource.data.summary.reversed} />
          <StatCard label="Điểm đã hoàn" value={resource.data.summary.restored} />
        </div>
      )}

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
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Sổ giao dịch điểm">
              <thead className="bg-[#f7f9f5] text-xs muted">
                <tr>
                  {["Thời gian", "Giao dịch", "Thành viên", "Điểm (+/−)", "Số dư sau", "Thao tác"].map(
                    (heading) => (
                      <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-[#edf2eb]">
                    <td className="whitespace-nowrap px-4 py-3">{financeDateTime(tx.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      #{tx.id} · {transactionTypeLabel(tx.type)}
                    </td>
                    <td className="px-4 py-3">{tx.memberEmail ?? `#${tx.memberId}`}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      <StatusText tone={tx.delta.startsWith("-") ? "red" : "green"}>
                        {signedPoints(tx.delta)}
                      </StatusText>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{tx.balanceAfter}</td>
                    <td className="px-4 py-3">
                      <PointTransactionDetail transaction={tx} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
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

function signedPoints(delta: string) {
  return delta === "0" || delta.startsWith("-") ? delta : `+${delta}`;
}

function PointTransactionDetail({ transaction: tx }: { transaction: MerchantLedgerItemDto }) {
  const fields = [
    ["Thành viên", tx.memberEmail ?? `#${tx.memberId}`],
    ["Thay đổi", signedPoints(tx.delta)],
    ["Số dư sau giao dịch", tx.balanceAfter],
    ["Điểm khả dụng", tx.availablePointsAfter],
    ["Điểm lẻ", tx.fractionalCarryAfter],
    ["Nợ điểm", tx.pointDebtAfter],
    ["Mã sự kiện", tx.eventRef],
  ];
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" size="sm" className="whitespace-nowrap">
          Chi tiết
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-6 shadow-2xl outline-none">
          <Dialog.Title className="text-lg font-extrabold">
            {transactionTypeLabel(tx.type)} #{tx.id}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm muted">
            {tx.reason} · {financeDateTime(tx.createdAt)}
          </Dialog.Description>
          <dl className="mt-4 divide-y divide-[#edf2eb] text-sm">
            {fields.map(
              ([label, value]) =>
                value != null && (
                  <div key={label} className="grid grid-cols-2 gap-3 py-2">
                    <dt className="muted">{label}</dt>
                    <dd className="break-words text-right font-semibold tabular-nums">{value}</dd>
                  </div>
                ),
            )}
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            {tx.orderId && (
              <Link className="underline underline-offset-2" to={`/merchant/orders?orderId=${tx.orderId}`}>
                Đơn hàng #{tx.orderId}
              </Link>
            )}
            {tx.memberVoucherId &&
              (tx.voucherSummary?.type === "REWARD" ? (
                <Link
                  className="underline underline-offset-2"
                  to={`/merchant/orders?voucherId=${tx.memberVoucherId}`}
                >
                  Quà đổi thưởng #{tx.memberVoucherId}
                </Link>
              ) : (
                <span>
                  {tx.voucherSummary?.title ?? "Voucher"} #{tx.memberVoucherId}
                </span>
              ))}
            <Dialog.Close asChild>
              <Button type="button" variant="outline" size="sm" className="ml-auto">
                Đóng
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
